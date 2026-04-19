FROM node:20-alpine AS build
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx.conf contains ${BACKEND_URL} and ${PORT} placeholders that are
# substituted at container start by docker-entrypoint.sh using sed.
COPY nginx.conf /etc/nginx/conf.d/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
