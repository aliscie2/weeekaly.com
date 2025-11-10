#!/bin/bash

# React 19 Migration Script
# This script upgrades the project from React 18 to React 19.2.0

set -e  # Exit on error

echo "🚀 Starting React 19 Migration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Backup current package.json
echo "📦 Step 1: Creating backup..."
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup 2>/dev/null || true
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Step 2: Update React packages
echo "⬆️  Step 2: Updating React packages..."
npm install react@19.2.0 react-dom@19.2.0
echo -e "${GREEN}✓ React packages updated${NC}"
echo ""

# Step 3: Update TypeScript types
echo "📝 Step 3: Updating TypeScript types..."
npm install -D @types/react@19.2.0 @types/react-dom@19.2.0
echo -e "${GREEN}✓ TypeScript types updated${NC}"
echo ""

# Step 4: Check for peer dependency issues
echo "🔍 Step 4: Checking dependencies..."
npm ls react react-dom || echo -e "${YELLOW}⚠️  Some peer dependency warnings (usually safe to ignore)${NC}"
echo ""

# Step 5: Update other dependencies
echo "📦 Step 5: Updating other dependencies..."
npm update @tanstack/react-query
npm update motion
npm update react-router-dom
echo -e "${GREEN}✓ Dependencies updated${NC}"
echo ""

# Step 6: Clear caches
echo "🧹 Step 6: Clearing caches..."
rm -rf node_modules/.vite
rm -rf dist
echo -e "${GREEN}✓ Caches cleared${NC}"
echo ""

# Step 7: Reinstall to ensure consistency
echo "🔄 Step 7: Reinstalling dependencies..."
rm -rf node_modules
npm install
echo -e "${GREEN}✓ Dependencies reinstalled${NC}"
echo ""

# Step 8: Build to check for errors
echo "🏗️  Step 8: Testing build..."
npm run build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Review reactMigrationChecklist.md"
echo "2. Test the application: npm start"
echo "3. Run tests: npm test"
echo ""
echo "If you encounter issues, rollback with:"
echo "  mv package.json.backup package.json"
echo "  mv package-lock.json.backup package-lock.json"
echo "  rm -rf node_modules && npm install"
