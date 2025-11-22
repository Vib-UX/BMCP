#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🔒 BMCP Security Verification Script            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check 1: .env exists
echo "1. Checking .env file..."
if [ -f .env ]; then
    echo -e "   ${GREEN}✅ .env file exists${NC}"
else
    echo -e "   ${RED}❌ .env file not found${NC}"
    echo "   Run: cp .env.example .env"
fi

# Check 2: .env is gitignored
echo "2. Checking .env is gitignored..."
if git status --ignored | grep -q "\.env"; then
    echo -e "   ${GREEN}✅ .env is properly gitignored${NC}"
else
    echo -e "   ${RED}❌ .env is NOT gitignored${NC}"
fi

# Check 3: .env.example is tracked
echo "3. Checking .env.example is tracked..."
if git ls-files | grep -q "\.env.example"; then
    echo -e "   ${GREEN}✅ .env.example is tracked${NC}"
else
    echo -e "   ${RED}❌ .env.example is not tracked${NC}"
fi

# Check 4: No API keys in tracked files
echo "4. Checking for API keys in tracked files..."
if git grep -q "t-6921f4822a9f4bf66c8503de" -- ':(exclude).env' 2>/dev/null; then
    echo -e "   ${RED}❌ API key found in tracked files!${NC}"
    git grep -n "t-6921f4822a9f4bf66c8503de" -- ':(exclude).env'
else
    echo -e "   ${GREEN}✅ No API keys in tracked files${NC}"
fi

# Check 5: dotenv is installed
echo "5. Checking dotenv package..."
if grep -q '"dotenv"' package.json; then
    echo -e "   ${GREEN}✅ dotenv package is installed${NC}"
else
    echo -e "   ${RED}❌ dotenv package not found${NC}"
fi

# Check 6: Environment variables are loaded in scripts
echo "6. Checking scripts use environment variables..."
if grep -r "process.env.TATUM_API_KEY" examples/ > /dev/null; then
    echo -e "   ${GREEN}✅ Scripts use environment variables${NC}"
else
    echo -e "   ${RED}❌ Scripts don't use environment variables${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   Security Check Complete                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
