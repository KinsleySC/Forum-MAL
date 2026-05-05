FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application code
COPY . .

# Create data and uploads directories
RUN mkdir -p data static/uploads

EXPOSE 4300

CMD ["node", "server/index.js"]
