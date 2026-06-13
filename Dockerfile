# ---- Build ----
# IMPORTANT : node:22-slim (Debian/glibc), PAS alpine (musl).
# Sous node:22-alpine, Next.js 15.5.19 prérendait la landing (/) à vide.
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Variables factices pour le build (les vraies sont injectées au runtime)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# openssl requis par le moteur Prisma ; création d'un utilisateur non-root (syntaxe Debian)
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app app

# Build standalone Next.js + assets + client Prisma généré
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=app:app /app/prisma ./prisma

USER app
EXPOSE 3000
CMD ["node", "server.js"]
