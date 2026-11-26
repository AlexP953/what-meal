FROM node:24.22.3-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS source
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts postcss.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public

FROM source AS db-prepare
COPY scripts/db-prepare.ts scripts/db-diagnose.ts ./scripts/
COPY deploy/start-whatmeal.mjs ./deploy/
USER node
ENTRYPOINT ["node", "deploy/start-whatmeal.mjs"]
CMD ["--conditions=react-server", "--import", "tsx", "scripts/db-prepare.ts"]

FROM source AS builder
RUN NEXT_PUBLIC_NOTIFICATIONS_ENABLED=false npm run build

FROM node:24.22.3-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY deploy/start-whatmeal.mjs ./deploy/
USER node
EXPOSE 3000
ENTRYPOINT ["node", "deploy/start-whatmeal.mjs"]
CMD ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]

FROM runner AS local
ENTRYPOINT []
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
