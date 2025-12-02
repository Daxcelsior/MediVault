#!/bin/bash

# EC2 Deployment Script for HealthChain Backend
# Usage: ./ec2-deploy.sh

echo "🚀 HealthChain Backend Deployment Script"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create .env file with required variables."
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 already installed${NC}"
fi

# Stop existing process if running
echo -e "${YELLOW}🛑 Stopping existing process...${NC}"
pm2 stop healthchain-backend 2>/dev/null || true
pm2 delete healthchain-backend 2>/dev/null || true

# Start the application
echo -e "${YELLOW}🚀 Starting application...${NC}"
pm2 start server.js --name healthchain-backend

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✅ Application started!${NC}"
echo ""
echo "📊 Application Status:"
pm2 list
echo ""
echo "📝 View logs: pm2 logs healthchain-backend"
echo "🔄 Restart: pm2 restart healthchain-backend"
echo "🛑 Stop: pm2 stop healthchain-backend"

