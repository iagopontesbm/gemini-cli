# Stage 1: Build the React application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend application source code
COPY . .

# Build the application
# This command might need VITE_API_BASE_URL if your API is on a different domain in production
# Example: RUN VITE_API_BASE_URL=https://api.example.com npm run build
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration file (optional, but often needed for SPAs)
# Create nginx.conf in web_frontend/ directory if needed
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
