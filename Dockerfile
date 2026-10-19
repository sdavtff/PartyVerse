# Build de produção: um único container serve API, Socket.IO e o front-end compilado
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN npm prune --omit=dev --include= --workspaces --include-workspace-root=false || true
EXPOSE 3001
# as migrations pendentes são aplicadas pelo próprio servidor ao iniciar
CMD ["node", "server.js"]
