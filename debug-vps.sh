#!/bin/bash

# AnisuPlayer VPS Debugging Script
# This script helps diagnose connection issues on VPS

echo "=========================================="
echo "AnisuPlayer VPS Debugging Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Checking PM2 status..."
pm2 status
echo ""

echo "2. Checking if backend is listening on port 3001..."
if sudo netstat -tulpn | grep -q ":3001"; then
    echo -e "${GREEN}✓${NC} Port 3001 is listening"
    sudo netstat -tulpn | grep ":3001"
else
    echo -e "${RED}✗${NC} Port 3001 is NOT listening"
fi
echo ""

echo "3. Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health || echo "FAILED")
if [ "$HEALTH_RESPONSE" != "FAILED" ]; then
    echo -e "${GREEN}✓${NC} Backend is responding: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗${NC} Backend is NOT responding"
fi
echo ""

echo "4. Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${RED}✗${NC} Nginx is NOT running"
fi
echo ""

echo "5. Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓${NC} Nginx configuration is valid"
else
    echo -e "${RED}✗${NC} Nginx configuration has errors:"
    sudo nginx -t
fi
echo ""

echo "6. Checking recent PM2 logs (last 20 lines)..."
pm2 logs anisuplayer --lines 20 --nostream
echo ""

echo "7. Checking Nginx error logs (last 10 lines)..."
if [ -f /var/log/nginx/error.log ]; then
    sudo tail -n 10 /var/log/nginx/error.log
else
    echo "Nginx error log not found"
fi
echo ""

echo "8. Checking environment variables..."
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    if grep -q "ADMIN_USERNAME" .env && grep -q "ADMIN_PASSWORD" .env && grep -q "JWT_SECRET" .env; then
        echo -e "${GREEN}✓${NC} Required environment variables are set"
    else
        echo -e "${YELLOW}⚠${NC} Some environment variables may be missing"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
fi
echo ""

echo "9. Checking if dist directory exists..."
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} dist directory exists"
    echo "   Files in dist: $(ls -1 dist | wc -l) files"
else
    echo -e "${RED}✗${NC} dist directory not found - need to build!"
fi
echo ""

echo "10. Checking if dist-server directory exists..."
if [ -d "dist-server" ]; then
    echo -e "${GREEN}✓${NC} dist-server directory exists"
else
    echo -e "${RED}✗${NC} dist-server directory not found - need to build server!"
fi
echo ""

echo "=========================================="
echo "Debugging complete!"
echo "=========================================="
echo ""
echo "Common fixes:"
echo "1. If backend is not running: pm2 restart anisuplayer"
echo "2. If Nginx has errors: sudo nginx -t && sudo systemctl restart nginx"
echo "3. If dist is missing: npm run build && npm run build:server"
echo "4. If port 3001 is not listening: pm2 restart anisuplayer"
echo ""

