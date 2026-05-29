FROM node:22-slim

WORKDIR /app

COPY package.json ./

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN pnpm install --prod

COPY . .

# Cloud Run injects the PORT environment variable, defaulting to 8080
ENV PORT=8080
EXPOSE 8080

CMD ["node", "main.js"]
