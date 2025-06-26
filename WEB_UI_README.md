# Gemini CLI - Web UI Project

This project provides a web-based user interface for the Gemini CLI, allowing users to interact with the Gemini AI model through a web browser.

## Project Structure

The project is a monorepo structure (simulated) containing two main packages created for this Web UI:

-   `web_backend/`: A Node.js Express application that serves as the backend. It integrates with `@google/gemini-cli-core` to handle chat logic, file system operations (within a secure workspace), and communication with the Gemini API.
-   `web_frontend/`: A React application (built with Vite and TypeScript) that provides the user interface in the browser. It communicates with the `web_backend` via HTTP APIs.
-   `packages/core/`: (Assumed to be the existing `@google/gemini-cli-core` package from the original CLI tool).

## Features (Current Implementation)

-   Chat interface for sending messages to and receiving replies from the Gemini model.
-   Markdown rendering for model responses.
-   File browser UI to select local files (from a predefined server-side workspace) to be used as context for chat queries.
-   Basic security measures for file system access on the backend.
-   Integration tests骨架 for backend APIs.

## Prerequisites

-   Node.js (version specified in `web_backend/package.json` and `web_frontend/package.json`, typically >=18.x)
-   npm or yarn for package management.
-   (For Backend) A valid `GEMINI_API_KEY` environment variable set for the backend to communicate with the Gemini API.

## Local Development Setup

### 1. Backend (`web_backend/`)

```bash
cd web_backend

# Install dependencies
npm install
# or
# yarn install

# Set up environment variables
# Create a .env file in the web_backend/src directory (or web_backend/ if you adjust dotenv load path)
# Example .env:
# PORT=3001
# GEMINI_API_KEY=your_actual_api_key_here
# NODE_ENV=development

# Create the user workspace directory (if not automatically created by the server on first run)
# This is where the file browser will look for files.
# From the project root:
mkdir -p user_workspace
# You can add some test files here, e.g., user_workspace/sample.txt

# Run the development server (with hot reloading via nodemon)
npm run dev

# To build for production:
# npm run build
# To run production build (after build):
# npm start
```

The backend server will typically start on `http://localhost:3001`.

### 2. Frontend (`web_frontend/`)

```bash
cd web_frontend

# Install dependencies
npm install
# or
# yarn install

# Run the development server (Vite)
npm run dev
```

The frontend development server will typically start on `http://localhost:3000` and will proxy API requests to the backend on port 3001 (as configured in `vite.config.ts`).

### 3. Running Tests (Backend)

```bash
cd web_backend
npm test
```

## Deployment (Conceptual Overview)

This application can be deployed in various ways. Here are a few common approaches:

### Option 1: Docker Compose (Single Server)

Using Docker Compose to run both frontend and backend containers on a single server.

1.  **Build Docker images** for both frontend and backend (see `Dockerfile` examples below).
2.  **Create a `docker-compose.yml` file** to define the services, networks, and environment variables.
3.  Run `docker-compose up`.

### Option 2: Separate Deployment

-   **Backend (`web_backend/`)**:
    -   Build a Docker image (see `web_backend/Dockerfile`).
    -   Deploy the container to a platform like Google Cloud Run, AWS ECS/Fargate, Heroku, DigitalOcean App Platform, or any server that can run Docker containers or Node.js applications.
    -   Ensure `GEMINI_API_KEY` and other necessary environment variables are set in the deployment environment.
    -   Configure a persistent volume for `user_workspace` if its contents need to persist across deployments/restarts.
-   **Frontend (`web_frontend/`)**:
    -   Build the static assets: `cd web_frontend && npm run build`. This will create a `dist/` directory.
    -   Deploy the contents of the `dist/` directory to a static web hosting service like:
        -   Netlify
        -   Vercel
        -   Firebase Hosting
        -   Google Cloud Storage (with a load balancer for HTTPS)
        -   AWS S3 (with CloudFront for HTTPS and CDN)
    -   Alternatively, serve the static assets using the provided `web_frontend/Dockerfile` with Nginx, and deploy that container.
    -   Ensure the frontend is configured to make API calls to the deployed backend URL (this might involve setting an environment variable at build time for the frontend, e.g., `VITE_API_BASE_URL`).

## API Endpoints (Backend - `web_backend/`)

-   `POST /api/chat`: Handles chat messages and file contexts.
-   `GET /api/files/list?path=<relativePath>`: Lists files and directories within the user workspace.
-   `GET /api/files/content?path=<filePath>`: Retrieves the content of a specific file from the workspace.
-   Other placeholder APIs for session, tools, auth.

## Further Development & Considerations

-   **Authentication**: Implement robust user authentication for the web UI.
-   **Streaming Responses**: Fully implement streaming for chat responses from backend to frontend for better UX.
-   **Tool Integration**: Securely implement or proxy more CLI tools to the Web UI.
-   **Error Handling**: Enhance global error handling and user-facing error messages.
-   **Scalability**: Design backend for scalability if high traffic is expected.
-   **Security Hardening**: Implement more comprehensive security measures (HTTPS, rate limiting, advanced XSS/CSRF protection, regular dependency audits, Content Security Policy, etc.).
-   **Configuration Management**: Use a more robust configuration system for the backend (e.g., `dotenv` for local, environment variables for production).
-   **Frontend State Management**: For more complex frontend state, consider libraries like Redux, Zustand, or Jotai.
-   **CI/CD Pipeline**: Set up a CI/CD pipeline for automated testing and deployment.
---
*This README pertains to the Web UI sub-project created for the Gemini CLI.*
