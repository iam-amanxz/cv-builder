# Playwright image ships Node + Chromium; version must match the `playwright` package.
ARG PW_IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble

FROM ${PW_IMAGE} AS build
COPY --from=oven/bun:1.3.1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM ${PW_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /data && chown pwuser:pwuser /data
USER pwuser
VOLUME /data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
