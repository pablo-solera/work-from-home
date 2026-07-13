FROM oven/bun:1.3 AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Runner uses a glibc base (Debian slim) instead of Alpine/musl because the
# Oracle Instant Client (required by node-oracledb thick mode for Oracle 11g)
# is not supported on musl.
FROM node:lts-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient \
    LD_LIBRARY_PATH=/opt/oracle/instantclient

# Oracle Instant Client Basic Light + its runtime dependency (libaio).
ARG INSTANTCLIENT_ZIP=instantclient-basiclite-linux.x64-21.13.0.0.0dbru.zip
ARG INSTANTCLIENT_URL=https://download.oracle.com/otn_software/linux/instantclient/2113000/${INSTANTCLIENT_ZIP}
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip libaio1 \
    && mkdir -p /opt/oracle \
    && curl -fsSL -o /tmp/instantclient.zip "${INSTANTCLIENT_URL}" \
    && unzip -q /tmp/instantclient.zip -d /opt/oracle \
    && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
    && rm -f /tmp/instantclient.zip \
    && apt-get purge -y curl unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
