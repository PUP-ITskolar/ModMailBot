FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev --build-from-source=sqlite3

FROM node:24-bookworm-slim

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./

COPY src ./src
COPY knexfile.js ./
RUN mkdir -p db logs attachments && chown -R node:node /app

USER node
EXPOSE 8890

CMD ["node", "src/index.js"]
