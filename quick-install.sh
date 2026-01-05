#!/bin/bash

# AnisuPlayer Quick Install Script
# This script automates the installation of AnisuPlayer on a VPS
# Usage: bash quick-install.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_info "=========================================="
print_info "AnisuPlayer Quick Install Script"
print_info "=========================================="
echo ""

# Get user inputs
read -p "Enter your domain name (or press Enter to use IP): " DOMAIN
read -p "Enter admin username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
read -sp "Enter admin password: " ADMIN_PASSWORD
echo ""
read -p "Enter installation directory [/var/www/AnisuPlayer]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/var/www/AnisuPlayer}

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 64)

print_info "Starting installation..."
echo ""

# Step 1: Update system
print_info "Step 1/10: Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install Node.js 20.x
print_info "Step 2/10: Installing Node.js 20.x..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        print_success "Node.js $(node --version) already installed"
    else
        print_warning "Node.js version is too old, upgrading..."
        apt remove nodejs npm -y 2>/dev/null || true
    fi
fi

if ! command -v node &> /dev/null || [ "$NODE_VERSION" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_success "Node.js $(node --version) installed"
else
    print_success "Node.js $(node --version) already installed"
fi

# Step 3: Install required software
print_info "Step 3/10: Installing required software (FFmpeg, PM2, Nginx)..."
apt install -y ffmpeg nginx
npm install -g pm2
print_success "Required software installed"

# Step 4: Clone repository
print_info "Step 4/10: Cloning repository..."
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Do you want to remove it and reinstall? (y/N): " REMOVE_DIR
    if [[ $REMOVE_DIR =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        print_info "Using existing directory"
        cd "$INSTALL_DIR"
    fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$(dirname $INSTALL_DIR)"
    git clone https://github.com/nuril22/AnisuPlayer.git "$INSTALL_DIR"
    print_success "Repository cloned"
fi

cd "$INSTALL_DIR"

# Step 5: Install dependencies
print_info "Step 5/10: Installing dependencies..."
npm install
print_success "Dependencies installed"

# Step 6: Build project
print_info "Step 6/10: Building project..."
npm run build
npm run build:server
print_success "Project built"

# Step 7: Setup environment variables
print_info "Step 7/10: Setting up environment variables..."
cat > .env << EOF
# Dashboard Authentication
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

# JWT Configuration
JWT_SECRET=$JWT_SECRET

# Server Configuration
PORT=3001
NODE_ENV=production

# Storage Path
STORAGE_PATH=$INSTALL_DIR/storage
EOF
print_success "Environment variables configured"

# Step 8: Create storage directories
print_info "Step 8/10: Creating storage directories..."
mkdir -p storage/videos storage/subtitles storage/thumbnails
chown -R $SUDO_USER:$SUDO_USER storage
chmod -R 755 storage
print_success "Storage directories created"

# Step 9: Setup PM2
print_info "Step 9/10: Setting up PM2..."
mkdir -p logs

# Check if ecosystem.config.cjs exists
if [ ! -f "ecosystem.config.cjs" ]; then
    cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'anisuplayer',
    script: './dist-server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
EOF
fi

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
print_success "PM2 configured and started"

# Step 10: Setup Nginx
print_info "Step 10/10: Setting up Nginx..."

# Determine server_name
if [ -z "$DOMAIN" ]; then
    SERVER_NAME="_"
    print_warning "No domain specified, using catch-all server_name"
else
    SERVER_NAME="$DOMAIN www.$DOMAIN"
fi

# Create Nginx configuration
cat > /etc/nginx/sites-available/anisuplayer << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Increase upload size limit for video files
    client_max_body_size 2G;
    client_body_timeout 300s;

    # Storage files (videos, thumbnails, subtitles) - MUST be first
    location /storage {
        alias $INSTALL_DIR/storage;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers 'Range';
        add_header Accept-Ranges bytes;
        
        # Set proper MIME types for HLS
        location ~* \.m3u8\$ {
            add_header Content-Type 'application/vnd.apple.mpegurl';
            add_header Access-Control-Allow-Origin *;
        }
        
        location ~* \.ts\$ {
            add_header Content-Type 'video/mp2t';
            add_header Access-Control-Allow-Origin *;
        }
        
        # CORS preflight
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods 'GET, OPTIONS';
            add_header Access-Control-Allow-Headers 'Range';
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # CDN Route - proxy to backend for API calls
    location /cdn {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Access-Control-Allow-Origin *;
    }

    # Static files caching (JS, CSS, fonts, etc.)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)\$ {
        root $INSTALL_DIR/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;
    }

    # Frontend (React App) - MUST be last to catch all routes
    location / {
        root $INSTALL_DIR/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
        add_header Access-Control-Allow-Origin *;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/anisuplayer /etc/nginx/sites-enabled/

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl restart nginx
print_success "Nginx configured and started"

# Setup firewall
print_info "Setting up firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    print_success "Firewall configured"
fi

# Final summary
echo ""
print_success "=========================================="
print_success "Installation completed successfully!"
print_success "=========================================="
echo ""
print_info "Installation Details:"
echo "  - Installation Directory: $INSTALL_DIR"
echo "  - Admin Username: $ADMIN_USERNAME"
echo "  - Domain: ${DOMAIN:-IP Address}"
echo ""
print_info "Access your application:"
if [ -n "$DOMAIN" ]; then
    echo "  - http://$DOMAIN"
    echo "  - http://www.$DOMAIN"
else
    IP=$(hostname -I | awk '{print $1}')
    echo "  - http://$IP"
fi
echo ""
print_info "Useful commands:"
echo "  - View logs: pm2 logs anisuplayer"
echo "  - Restart app: pm2 restart anisuplayer"
echo "  - Check status: pm2 status"
echo "  - Restart Nginx: systemctl restart nginx"
echo ""
print_warning "Next steps:"
echo "  1. Setup SSL certificate (optional but recommended):"
echo "     sudo certbot --nginx -d $DOMAIN"
echo "  2. Access your application and login with:"
echo "     Username: $ADMIN_USERNAME"
echo "     Password: [the password you entered]"
echo ""
print_success "Installation complete! 🎬"

