# ── Stage 1: dependencies ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create logs dir and give the non-root user ownership before switching
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs \
    && rm -rf .git 2>/dev/null || true

USER appuser

EXPOSE 5001

ENV NODE_ENV=production

CMD ["node", "server.js"]
