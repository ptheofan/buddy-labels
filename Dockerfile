# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "server/index.mjs"]
