# Multi-stage: build Vite UI, then run one Node process (UI + API + Socket.IO).
# Connects to an *external* Postgres (Attendence DB) via DATABASE_URL — does not start a DB.

FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# Same-origin /api in the browser; never bake localhost into the client
ENV VITE_USE_MOCK=false
ENV VITE_API_URL=
RUN npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci
COPY server/prisma ./prisma
RUN npx prisma generate \
  && npm prune --omit=dev

COPY server/src ./src
COPY server/public ./public
COPY --from=frontend /app/dist /app/dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
