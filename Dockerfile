# syntax=docker/dockerfile:1
# Duet 生产镜像：Next.js standalone + 启动时 prisma migrate

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="mysql://duet:duet@127.0.0.1:3306/duet"

RUN pnpm exec prisma generate && pnpm build \
  && mkdir -p /app/prisma-export/.prisma /app/prisma-export/@prisma \
  && CLIENT_DOT=$(find /app/node_modules -type d -path "*/.prisma/client" | head -1) \
  && cp -a "$(dirname "$CLIENT_DOT")/." /app/prisma-export/.prisma/ \
  && CLIENT_PKG=$(find /app/node_modules -type d -path "*/node_modules/@prisma/client" | head -1) \
  && cp -a "$CLIENT_PKG/." /app/prisma-export/@prisma/client/

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && npm install -g prisma@6.19.3

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 覆盖/补齐 Prisma Client（pnpm 嵌套路径在 standalone 里常不完整）
RUN rm -rf ./node_modules/.prisma ./node_modules/@prisma/client \
  && mkdir -p ./node_modules/.prisma ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/prisma-export/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma-export/@prisma/client ./node_modules/@prisma/client

COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
