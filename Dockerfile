# --- build the React client ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
RUN npm run build

# --- runtime: Express serves the API and the built client ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DATABASE_FILE=/data/krushimitra.db
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server server
COPY --from=build /app/client/dist client/dist
# Run as the unprivileged "node" user; the database lives on a mounted volume.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "server/src/index.js"]
