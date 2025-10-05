#!/bin/bash

# Start the Node.js server for Princeton Wildlife website
echo "Starting Princeton Wildlife website..."
echo ""

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
echo "🌲 Starting server..."
echo "📍 Open your browser and go to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.js
