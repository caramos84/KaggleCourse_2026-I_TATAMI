FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Forzamos la instalación limpia resolviendo las dependencias nativas de Tailwind
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
EXPOSE 3000
CMD ["node", "dist/server.js"]