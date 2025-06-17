import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

const phoneRegex = /^\+\d{2}[0-9]{1,13}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CustomerUser {
	id: string
	isPhoneNumber: boolean
	verified: boolean
	password?: string
	nonMobileId?: string
	verificationRequestId?: string
}

interface NumberVerificationResponse {
	verified: boolean
}

declare global {
	var users: CustomerUser[]
	var accessTokens: Map<string, string>
}

dotenv.config()

const api = express()
api.use(express.json())
api.use(cors())

const saveUser = async (user: CustomerUser) => {
	global.users?.push(user)
}

const sendVerificationCode = async (recipient: CustomerUser, channel: "sms" | "email") => {
	const to = recipient.id.startsWith('+') ? recipient.id.slice(1) : recipient.id
	const headers = new Headers()
	headers.append('Content-Type', 'application/json')
	headers.append('Authorization', `Basic ${btoa(process.env.API_KEY + ':' + process.env.API_SECRET)}`)
	fetch(`${process.env.API_GATEWAY}/v2/verify`, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify({
			brand: "Mock company",
			workflow: [{ channel, to }]
		})
	})
		.then(response => {
			if (!response.ok) throw new Error(`Failed to send verification code: ${response.statusText}`)
			return response.json()
		}).then(data => {
			const { request_id } = data as { request_id: string }
			saveUser({
				...recipient,
				verificationRequestId: request_id
			} as CustomerUser)
		}).catch(error => {
			console.error(`Error sending verification code to ${to} via ${channel}:`, error)
		})
}

const checkVerificationCode = async (user: CustomerUser, code: string): Promise<boolean> => {
	const headers = new Headers()
	headers.append('Content-Type', 'application/x-www-form-urlencoded')
	headers.append('Authorization', `Basic ${btoa(process.env.API_KEY + ':' + process.env.API_SECRET)}`)
	try {
		const response = await fetch(`${process.env.API_GATEWAY}/v2/verify/${user.verificationRequestId}`, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify({ code })
		})
		return response.ok
	} catch (error) {
		return false
	}
}

api.get('/callback', (req, res) => {
	const code = req.query.code
	const error = req.query.error
	const requestId = req.query.state as string
	if (error) {
		const errorDescription = req.query.error_description || 'Unknown error'
		if (errorDescription === 'Unknown user') {
			res.status(404).send('User not found as an operator subscriber')
			return
		}
		res.status(400).send(`Error: ${errorDescription}`)
		return
	}
	if (!code || !requestId) {
		res.status(400).send('Bad Request: code and state, containing requestId, are required')
		return
	}
	const headers = new Headers()
	headers.append('Content-Type', 'application/x-www-form-urlencoded')
	headers.append('Authorization', `Basic ${btoa(process.env.API_KEY + ':' + process.env.API_SECRET)}`)
	const urlencoded = new URLSearchParams()
	urlencoded.append('grant_type', 'authorization_code')
	urlencoded.append('code', code as string)
	urlencoded.append('redirect_uri', `${process.env.HOST}:${process.env.PORT}/callback`)
	fetch(`${process.env.API_GATEWAY}/token`, {
		method: 'POST',
		headers: headers,
		body: urlencoded,
	})
		.then(response => response.json())
		.then(async data => {
			const { access_token } = data as { access_token: string }
			global.accessTokens = global.accessTokens || new Map()
			global.accessTokens.set(requestId, access_token)
			setTimeout(() => {
				global.accessTokens.delete(requestId)
			}, 2 * 60 * 60 * 1000)
			res.status(201).send()
		})
})

api.post('/signup', async (req, res) => {
	const { id: userId, password } = req.body
	const isEmail = emailRegex.test(userId || '')
	if (!userId || (isEmail && !password)) {
		res.status(400).send('Bad Request: phone number or email and password are required')
		return
	}
	global.users = global.users || []
	const existingUser = global.users.find(user => user.id.toLowerCase() === userId.toLowerCase())
	if (existingUser) {
		res.status(409).send('Conflict: User already exists')
		return
	}
	const newUser: CustomerUser = {
		id: userId,
		isPhoneNumber: phoneRegex.test(userId),
		verified: false,
		...(password ? { password } : {}),
	}
	global.users.push(newUser)
	sendVerificationCode(newUser, isEmail ? "email" : "sms")
	res.status(202).json({
		verified: false,
	} as NumberVerificationResponse)
})

api.post('/verify', async (req, res) => {
	const { id: userId, code } = req.body
	if (!userId || !code) {
		res.status(400).send('Bad Request: phone number or email as id, and code are required')
		return
	}
	if (!phoneRegex.test(userId) && !emailRegex.test(userId)) {
		res.status(400).send('Bad Request: Invalid phone number or email format for id')
		return
	}
	if (!code || !/^\d+$/.test(code)) {
		res.status(400).send('Bad Request: code must be a number')
		return
	}
	const user = global.users?.find(user => user.id === userId)
	if (!user) {
		res.status(404).send('Not Found: User not found')
		return
	}
	if (user.verified) {
		res.status(304).send()
		return
	}
	user.verified = await checkVerificationCode(user, code)
	await saveUser(user)
	res.status(200).json({ verified: user.verified })
})

api.listen(process.env.PORT, async () => {
	console.log(`Server is running on ${process.env.HOST}:${process.env.PORT}`)
})
