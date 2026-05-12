# Multi-stage build for the public release image.
# Used by .github/workflows/release.yml on tag pushes.
#
# Run anywhere:
#   docker run -d -p 8080:80 ghcr.io/zuiho-kai/api-web-agent:latest
# Then open http://localhost:8080/ in a browser.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
