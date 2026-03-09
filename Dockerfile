FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 8080

ENV PORT=8080

CMD ["node", "--import", "tsx", "server/index.ts"]
