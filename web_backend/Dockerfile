# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Copy the core package dependency if it's locally referenced
# This assumes 'packages/core' is one level up from 'web_backend'
# Adjust the path if your monorepo structure is different.
# If @google/gemini-cli-core is published to a registry, this copy is not needed.
COPY ../packages/core ./packages/core

# Install dependencies
# Using --omit=dev for a smaller production image if devDependencies are not needed for build
RUN npm install --omit=dev

# Copy the rest of the backend application source code
COPY ./src ./src
COPY tsconfig.json .

# Build the TypeScript application
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production
# Expose the port the app runs on
EXPOSE 3001

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy the 'user_workspace' directory if it needs to be pre-populated in the image.
# Often, this would be a volume mounted at runtime instead.
# COPY --from=builder /app/user_workspace ./user_workspace
# For now, we assume the server creates it or it's mounted.

# Command to run the application
CMD ["node", "dist/server.js"]

# Healthcheck (optional, but good practice)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
#   CMD curl -f http://localhost:3001/api/health || exit 1
# (Assumes you add a /api/health endpoint to your server)
