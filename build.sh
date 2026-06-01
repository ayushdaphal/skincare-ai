#!/bin/bash
# Railway build script - installs dependencies before starting the app
echo "Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt
echo "Dependencies installed successfully!"
