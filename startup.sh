#!/bin/sh

set -e  # Exit on first error

cd /home/site/wwwroot || exit 1

export NODE_PATH=/usr/local/lib/node_modules:$NODE_PATH
export PORT=${PORT:-8080}

echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci --omit=dev  # Production install
fi

echo "Starting server..."
npm start
