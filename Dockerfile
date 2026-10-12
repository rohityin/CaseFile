# Multi-stage build: compile the React app, then run the Express server that
# serves the built assets and the API from one process.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Only production deps are needed to run the server.
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
# Hosts inject PORT; default to 8787 for local `docker run`.
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/index.js"]
