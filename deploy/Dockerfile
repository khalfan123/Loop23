FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY shared ./shared
COPY client ./client
COPY server ./server
COPY script ./script
COPY migrations ./migrations
COPY vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js drizzle.config.ts build-version.json ./

RUN npm run build

FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r agentlabs && useradd -r -g agentlabs -m agentlabs

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/build-version.json ./build-version.json
COPY --from=builder /app/client/public ./client/public

RUN mkdir -p client/public/uploads client/public/images public/audio public/avatars public/widget \
             kyc exports data data/invoices data/refund-notes logs public/images \
    && chown -R agentlabs:agentlabs /app

USER agentlabs

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/index.cjs"]
