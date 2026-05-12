# Multi-stage build: bundle Vite SPA, then serve via nginx:alpine.
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first for better layer caching.
# Using `npm install` (not `npm ci`) to tolerate lock-file drift between
# the developer's local npm version and the container's, which happens
# when newer transitive deps (e.g. esbuild 0.28) get pulled in.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --omit=optional=false

# Source + build
COPY . .
RUN npm run build

# Runtime: tiny nginx serving the dist/
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
