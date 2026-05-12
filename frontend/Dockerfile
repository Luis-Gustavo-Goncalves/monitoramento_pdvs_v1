# ── Frontend — PDV Monitor ─────────────────────────────────────────────────────

# Estágio 1: Build do React
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

# Variável de ambiente para apontar para o backend
# Local usa localhost; pipeline/docker-compose podem sobrescrever no build.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Estágio 2: Serve os arquivos estáticos com Nginx
FROM nginx:alpine

# Remove config padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia config customizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia arquivos do build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
