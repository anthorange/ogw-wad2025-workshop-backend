# WeAreDevelopers World Congress 2025
## Workshop's Backend Server

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- (Optional) [Git](https://git-scm.com/) for cloning the repository

## Setting up Environment Variables

1. Copy the example environment file (if provided) or create a new `.env` file in the project root.
2. Add the required environment variables. Example:

BACKEND_URL=http://localhost:3000
API_GATEWAY=https://api.nexmo.com
API_KEY=<yours from the Vonage API Dashboard>
API_SECRET=<yours from the Vonage API Dashboard>

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

3. The Express server should now be running at `http://localhost:<PORT>` (default port is 3000 unless overridden in `.env` as PORT of BACKEND_URL if this matches the format <HOST>:<PORT>).

## License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

## Other resources

Check the workshop's full project, abstract and other repos at [Workshop: "Integrating Open Gateway in your application to shift to a better sign-up experience"](https://github.com/Telefonica/ogw-wad2025-workshop).