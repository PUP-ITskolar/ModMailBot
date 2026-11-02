FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY knexfile.js ./
RUN mkdir -p db logs attachments && chown -R node:node /app

USER node
EXPOSE 8890

CMD ["node", "src/index.js"]
