
# Stage 1: Build the React frontend
FROM node:22-alpine AS build

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install dependencies
RUN npm ci

# Copy both client and server
# The frontend translation checker needs server crop data
COPY client client
COPY server server

# Build frontend
RUN npm run build


# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_FILE=/data/krushimitra.db

# Copy package files
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install production dependencies for the server
RUN npm ci --omit=dev -w server && npm cache clean --force

# Copy backend source
COPY server server

# Copy built frontend from the build stage
COPY --from=build /app/client/dist client/dist

# Create persistent database directory
RUN mkdir -p /data && chown -R node:node /data /app

USER node

VOLUME /data

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/api/health || exit 1

# Start server
CMD ["node", "server/src/index.js"]
