#!/bin/sh
# Substitute ${BACKEND_URL} and ${PORT} in the nginx config template.
# sed targets only our explicit ${...} placeholders, leaving nginx's own
# $host, $uri, $remote_addr, etc. completely unchanged.
set -e

: "${BACKEND_URL:?BACKEND_URL environment variable is required}"
: "${PORT:=80}"

sed \
  -e "s|\${BACKEND_URL}|${BACKEND_URL}|g" \
  -e "s|\${PORT}|${PORT}|g" \
  /etc/nginx/conf.d/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
