#!/bin/bash

# Stop the Node.js server for Princeton Wildlife website
echo "Stopping Princeton Wildlife website..."

# Find and kill the Node.js server process
PID=$(lsof -ti:8000)

if [ -z "$PID" ]; then
    echo "No server running on port 8000"
else
    kill $PID
    echo "✅ Server stopped successfully"
fi
