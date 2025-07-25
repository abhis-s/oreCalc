# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# to install dependencies
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on. Cloud Run will use this.
# Your proxy-server.js listens on process.env.PORT or 3000.
# Cloud Run injects the PORT environment variable.
ENV PORT=8080
EXPOSE 8080

# Run the server
CMD ["node", "main.js"]
