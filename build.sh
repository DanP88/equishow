#!/bin/bash
set -e

echo "Building Equishow web app..."
cd web
npm install
npm run build
echo "Build complete!"
