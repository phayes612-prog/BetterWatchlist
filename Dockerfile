FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src
COPY tsconfig.json ./

RUN mkdir -p /app/data

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
