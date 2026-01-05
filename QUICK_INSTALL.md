# 🚀 AnisuPlayer Quick Install

Automated installation script for AnisuPlayer on VPS.

## 📋 Usage

### Option 1: Install directly from Gist

```bash
curl -fsSL https://gist.githubusercontent.com/nuril22/efa981e23d2c88e267df26714088f7e9/raw/040fe6613603ea6d8fa77df27c45ec413d47ba77/quick-install.sh | sudo bash
```

### Option 2: Download and install

```bash
# Download script
wget https://gist.githubusercontent.com/nuril22/efa981e23d2c88e267df26714088f7e9/raw/040fe6613603ea6d8fa77df27c45ec413d47ba77/quick-install.sh -O quick-install.sh

# Make executable
chmod +x quick-install.sh

# Run as root
sudo ./quick-install.sh
```

## ⚙️ What Will Be Installed

The script will automatically:

1. ✅ Update system packages
2. ✅ Install Node.js 20.x (LTS)
3. ✅ Install FFmpeg, PM2, and Nginx
4. ✅ Clone repository from GitHub
5. ✅ Install dependencies (npm install)
6. ✅ Build project (frontend & backend)
7. ✅ Setup environment variables (.env)
8. ✅ Create storage directories
9. ✅ Configure PM2 for process management
10. ✅ Configure Nginx as reverse proxy
11. ✅ Setup firewall (UFW)

## 📝 Required Inputs

When running the script, you will be prompted for:

- **Domain name** (optional, press Enter to use IP)
- **Admin username** (default: admin)
- **Admin password** (required)
- **Installation directory** (default: /var/www/AnisuPlayer)

## 🔐 Default Credentials

After installation, login with:
- **Username**: (what you entered during installation)
- **Password**: (what you entered during installation)

## 🌐 Access Application

After installation is complete, access the application via:

- **With domain**: `http://your-domain.com`
- **Without domain**: `http://your-vps-ip`

## 🛠️ Useful Commands

```bash
# View application logs
pm2 logs anisuplayer

# Restart application
pm2 restart anisuplayer

# Check application status
pm2 status

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx
```

## 🔒 Setup SSL (Optional)

After installation, setup SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📦 Update Application

To update the application to the latest version:

```bash
cd /var/www/AnisuPlayer
git pull origin main
npm install
npm run build
npm run build:server
pm2 restart anisuplayer
```

## 🐛 Troubleshooting

### Application not running

```bash
# Check PM2 logs
pm2 logs anisuplayer

# Check status
pm2 status

# Restart application
pm2 restart anisuplayer
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs anisuplayer

# Restart Nginx
sudo systemctl restart nginx
```

### Port 3001 "Cannot GET"

**This is normal!** Port 3001 is only for internal use. Access your application via:
- `http://your-vps-ip` (not `:3001`)
- Or `http://your-domain.com`

### "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

This error occurs when the server returns HTML instead of JSON. Solutions:

1. **Check if backend is running:**
   ```bash
   pm2 status
   pm2 logs anisuplayer
   ```

2. **Verify Nginx configuration:**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

3. **Check if /cdn route is proxied correctly:**
   - Ensure `/cdn` location block in Nginx proxies to `http://localhost:3001`
   - Verify backend is listening on port 3001

4. **In development mode:**
   - Make sure Vite proxy is configured for `/cdn` in `vite.config.ts`
   - Restart development server

## 📄 License

MIT License - Copyright (c) 2026 VTX Group
