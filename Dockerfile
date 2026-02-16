# Stage 1: Build
FROM node:20-alpine AS builder

# Install build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
RUN npm rebuild better-sqlite3

# Copy source code
COPY . .

# Build API server and web frontend
RUN npm run build:server
RUN npm run build:web

# Stage 2: Production
FROM node:20-alpine

# Install nginx and build tools for better-sqlite3
RUN apk add --no-cache nginx python3 make g++

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

# Copy server build
COPY --from=builder /app/build/server ./build/server

# Copy web build to nginx
COPY --from=builder /app/build/web /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data/backups

# Default environment
ENV MASSCODE_PORT=4321
ENV MASSCODE_STORAGE_PATH=/data
ENV MASSCODE_BACKUP_PATH=/data/backups
ENV MASSCODE_API_URL=/api
ENV MASSCODE_BACKUP_ENABLED=true
ENV MASSCODE_BACKUP_INTERVAL=6
ENV MASSCODE_MAX_BACKUPS=5

EXPOSE 8080

VOLUME /data

CMD ["/docker-entrypoint.sh"]
