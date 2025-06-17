# WeAreDevelopers World Congress 2025
## Workshop's Backend Server

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- (Optional) [Git](https://git-scm.com/) for cloning the repository

## Setting up Environment Variables

1. Copy the example environment file (if provided) or create a new `.env` file in the project root.
2. Add the required environment variables. Example:

```
HOST=http://localhost
PORT=3000
API_GATEWAY=https://api.nexmo.com
API_GATEWAY_OAUTH=https://api-eu-3.vonage.com
API_GATEWAY_NETWORK_APIS=https://api-eu.vonage.com
API_KEY=<yours from the Vonage API Dashboard>
API_SECRET=<yours from the Vonage API Dashboard>
API_JWT=<your JWT token>
NV_SCOPE="dpv:FraudPreventionAndDetection#number-verification-verify-read"
```

- You can generate a pair of public and private keys for your application on the Vonage dashboard, and then use Vonage's [JWT Generator](https://developer.vonage.com/en/jwt) to create a JWT token.
- The Number Verification API requires the `dpv:FraudPreventionAndDetection#number-verification-verify-read` scope to be set in the `VITE_NV_SCOPE` variable, following the [CAMARA](https://github.com/camaraproject) standard scope.

3. Save the `.env` file.

## Running the Server

1. Install dependencies:

    ```
    npm install
    ```

2. Start the server in development mode (with automatic restarts on file changes):

    ```
    npm run dev
    ```

3. The Express server should now be running at `http://localhost:<PORT>` (default port is 3000 unless overridden in `.env`).

## License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

## Other resources

Check the workshop's full project, abstract and other repos at [Workshop: "Integrating Open Gateway in your application to shift to a better sign-up experience"](https://github.com/Telefonica/ogw-wad2025-workshop).