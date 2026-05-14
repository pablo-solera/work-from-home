FROM oven/bun:1.3.2 AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.2 AS builder
WORKDIR /app
ARG DEPLOYMENT_VERSION=local
ENV NEXT_TELEMETRY_DISABLED=1 \
    DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DEPLOYMENT_VERSION=local \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
