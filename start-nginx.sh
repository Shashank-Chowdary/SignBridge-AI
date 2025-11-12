#!/bin/sh

if [ -n "$BACKEND_URL" ]; then
  sed -i "s|\${BACKEND_URL}|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
else
  sed -i "s|\${BACKEND_URL}|http://localhost:5000|g" /etc/nginx/conf.d/default.conf
fi

nginx -g "daemon off;"
