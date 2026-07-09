# Image RUNTIME uniquement.
#
# IMPORTANT : on ne lance PAS `next build` ici. Sur le serveur de prod,
# `docker build` prérend la grande page d'accueil à vide (bug overlayfs/
# containerd : la page bascule en rendu client, ~5,9 Ko au lieu de ~71 Ko),
# alors que `docker run ... next build` la rend correctement.
#
# Le build est donc fait AVANT, sur l'hôte, via :
#   docker run --rm -v "$PWD":/app -w /app node:22-slim \
#     bash -c 'npm ci && npx prisma generate && npx next build'
# puis cette image ne fait que COPIER le résultat (la copie, elle, marche).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# openssl requis par le moteur Prisma ; utilisateur non-root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app app

# Build standalone Next.js déjà produit sur l'hôte + assets + client Prisma
COPY --chown=app:app .next/standalone ./
COPY --chown=app:app .next/static ./.next/static
COPY --chown=app:app node_modules/.prisma ./node_modules/.prisma
# Fonts @fontsource lues via fs.readFileSync à l'exécution (non tracées par le
# build standalone) — copie explicite, sinon ENOENT sur les .woff en prod
COPY --chown=app:app node_modules/@fontsource ./node_modules/@fontsource
COPY --chown=app:app prisma ./prisma

USER app
EXPOSE 3000
CMD ["node", "server.js"]
