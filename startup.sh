#!/bin/sh
cd /home/site/wwwroot
export NODE_PATH=/usr/local/lib/node_modules:$NODE_PATH
export PORT=${PORT:-8080}
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Running CSS build..."
npm run build:css
echo "Running Vite build..."
npm run build
echo "Starting server..."
npm start