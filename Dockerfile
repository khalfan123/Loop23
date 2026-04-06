FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --fund=false

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies for a smaller runtime image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --fund=false

# Copy compiled app assets.
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
