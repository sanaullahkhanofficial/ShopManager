# EduManage — web/server deployment image.
# Builds the React frontend and runs the plain Node/Express server (server.cjs),
# which serves the same business logic as the Electron desktop app over HTTP.
# This image is NOT the desktop app — see README.md for the Electron/Windows build.

# ---- Stage 1: build the static frontend only (devDependencies needed, but
# not Electron's native rebuild — nothing here ever requires better-sqlite3) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run build:web

# ---- Stage 2: production runtime — only prod dependencies, so
# better-sqlite3 gets its native binary built/fetched for THIS Node runtime,
# and electron-builder (a devDependency, absent here) is never invoked. ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY electron ./electron
COPY server.cjs ./server.cjs

# Persistent volume for the SQLite database + backups. Mount a real volume at
# this path on your hosting provider (Render/Railway/Fly.io disk) — otherwise
# all data is lost whenever the container restarts.
VOLUME ["/app/data"]
ENV DATA_DIR=/app/data
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.cjs"]
