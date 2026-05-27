#!/bin/bash
echo "Installing dependencies..."
npm ci --omit=dev
echo "Applying database migrations..."
npx prisma migrate deploy
echo "Generating Prisma client..."
npx prisma generate
echo "Starting server..."
node src/server.js
