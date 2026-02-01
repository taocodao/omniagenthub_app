# Use a specific Node.js version
FROM node:21.7

# Set the working directory inside the container
WORKDIR /app

# Copy package files
COPY package*.json ./


# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your application will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
