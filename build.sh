#!/bin/bash

# Build script for Ambient Anki

echo "Building Ambient Anki..."

# Clean dist directory
rm -rf dist
mkdir -p dist

# Copy source files
cp -r src dist/
cp manifest.json dist/
cp -r icons dist/

# Copy libraries
mkdir -p dist/src/lib
cp node_modules/@mozilla/readability/Readability.js dist/src/lib/

# Create production manifest (remove test permissions if any)
cp manifest.json dist/

echo "Build complete! Extension ready in dist/"
echo "To create a zip file, run: npm run zip"