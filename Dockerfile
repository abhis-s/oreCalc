FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Copy server's package.json since pnpm workspace requires it to build dependency graph
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY . .

ENV VERBOSE=true
RUN pnpm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]