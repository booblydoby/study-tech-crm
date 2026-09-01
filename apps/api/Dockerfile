FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @study-crm/api prisma:generate
RUN pnpm --filter @study-crm/api build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
COPY --from=build /app/packages ./packages
RUN chmod +x /app/apps/api/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 4000
WORKDIR /app/apps/api
ENTRYPOINT ["./docker-entrypoint.sh"]
