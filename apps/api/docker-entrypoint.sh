#!/bin/sh
set -e

cd /app

echo "Applying database migrations..."
pnpm --filter @study-crm/api prisma:migrate:deploy

echo "Starting API server..."
exec pnpm --filter @study-crm/api start
