# Multi-stage build: bundle Vite SPA, then serve via nginx:alpine.
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

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
