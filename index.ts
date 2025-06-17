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

api.get('/callback', async (req, res) => {
	const code = req.query.code
	const error = req.query.error
	const requestId = req.query.state as string
	if (error) {
		res.status(400).send(`Error: ${req.query.error_description || 'Unknown error'}`)
		return
	}
	if (!code || !requestId) {
		res.status(400).send('Bad Request: code and state are required')
		return
	}
	const headers = new Headers()
	headers.append('Content-Type', 'application/x-www-form-urlencoded')
	headers.append('Authorization', `Bearer ${process.env.API_JWT}`)
	headers.append('Accept', 'application/json')
	const params = new URLSearchParams()
	params.append('grant_type', 'authorization_code')
	params.append('code', code as string)
	params.append('redirect_uri', `${process.env.HOST}:${process.env.PORT}/callback`)
	try {
		const response = await fetch(`${process.env.API_GATEWAY_OAUTH}/oauth2/token`, {
			method: 'POST',
			headers,
			body: params.toString()
		})
		if (!response.ok) {
			const errorText = await response.text()
			console.error('Token error:', response.status, errorText)
			res.status(response.status).send(errorText)
			return
		}
		const data = await response.json()
		const { access_token } = data
		global.accessTokens = global.accessTokens || new Map()
		global.accessTokens.set(requestId, access_token)
		setTimeout(() => {
			global.accessTokens.delete(requestId)
		}, 2 * 60 * 60 * 1000)
		res.status(201).send(`
			<html lang="en">
				<body>
					<script>
						window.opener.postMessage({ status: 'authorized', requestId: '${requestId}' }, '*');
						window.close();
					</script>
					<p>You can close this window.</p>
				</body>
			</html>
		`)
	} catch (err) {
		console.error('Unexpected fetch error', err)
		res.status(500).send('Internal Server Error')
	}
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

api.post('/authorize', async (req, res) => {
	try {
		const { phone, state } = req.body || {}
		if (!phone) {
			res.status(400).json({ error: "Phone number is required." })
			return
		}
		const response = await fetch(`${process.env.API_GATEWAY_NETWORK_APIS}/v0.1/network-enablement`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${process.env.API_JWT}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				phone_number: phone,
				scopes: [process.env.NV_SCOPE],
				state,
			})
		})
		if (!response.ok) {
			const errorText = await response.text()
			console.error('Vonage API error:', errorText)
			res.status(response.status).json({ error: "Failed to initialize authentication flow." })
			return
		}
		const data = await response.json()
		if (!process.env.NV_SCOPE) {
			res.status(500).json({ error: "NV_SCOPE environment variable is not set." })
			return
		}
		const { auth_url } = data.scopes[process.env.NV_SCOPE]
		res.status(200).json({ auth_url })
	} catch (error) {
		console.error('Unexpected error with /login:', error)
		if (error instanceof Error) {
			res.status(500).json({ error: error.message })
		} else {
			res.status(500).json({ error: 'Internal server error' })
		}
	}
})

api.listen(process.env.PORT, async () => {
	console.log(`Server is running on ${process.env.HOST}:${process.env.PORT}`)
})
