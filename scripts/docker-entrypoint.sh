#!/bin/sh
set -eu

echo "[duet] prisma migrate deploy…"
prisma migrate deploy --schema=./prisma/schema.prisma

echo "[duet] starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}…"
exec node server.js
