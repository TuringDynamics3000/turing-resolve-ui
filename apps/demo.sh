#!/bin/bash

# Risk Brain Governance UI - Local Demo Launcher
# This script starts both the UI Gateway mock server and the Next.js UI

set -e

echo "🚀 Starting Risk Brain Governance UI Demo..."
echo ""

# Check if node_modules exist
if [ ! -d "risk-brain-ui-gateway/node_modules" ]; then
  echo "📦 Installing UI Gateway dependencies..."
  cd risk-brain-ui-gateway && npm install && cd ..
fi

if [ ! -d "risk-brain-ui/node_modules" ]; then
  echo "📦 Installing UI dependencies..."
  cd risk-brain-ui && npm install && cd ..
fi

echo ""
echo "✅ Starting services..."
echo ""

# Start UI Gateway in background
cd risk-brain-ui-gateway && npm start &
GATEWAY_PID=$!

# Wait for gateway to start
sleep 2

# Start Next.js UI in background
cd ../risk-brain-ui && npm run dev &
UI_PID=$!

echo ""
echo "✅ Risk Brain Governance UI is starting..."
echo ""
echo "📊 UI Gateway:  http://localhost:8080"
echo "🖥️  Web UI:      http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for Ctrl+C
trap "kill $GATEWAY_PID $UI_PID 2>/dev/null; exit" INT

wait
