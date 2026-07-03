FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Copy server's package.json since pnpm workspace requires it to build dependency graph
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY . .

ARG TAG_NAME
ENV TAG_NAME=$TAG_NAME
ENV VERBOSE=true
RUN pnpm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]