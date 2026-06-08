# ---------- Stage 1: build ----------
FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# do this before copying source code to leverage Docker cache
COPY package.json pnpm-lock.yaml ./
# install exact version from lockfile to ensure reproducible builds
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# remove dev dependencies to reduce image size
RUN pnpm prune --prod

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 8000

CMD ["node", "dist/index.js"]
