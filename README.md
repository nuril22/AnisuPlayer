# 🎬 AnisuPlayer

A modern, feature-rich video player with multi-resolution support, built with React, TypeScript, and Node.js.

![AnisuPlayer](https://img.shields.io/badge/AnisuPlayer-Video%20Player-00f5d4?style=for-the-badge&logo=youtube&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

## ✨ Features

### Video Player
- 🎮 **Keyboard Shortcuts** - Full keyboard control for seamless navigation
- 📝 **Subtitles Support** - Multiple subtitle tracks with easy switching
- 🎯 **Multi-Resolution** - Automatic quality selection with manual override
- ⚡ **Playback Speed** - Variable speed control (0.25x to 3x)
- ⏱️ **Skip Forward/Backward** - Jump 10 seconds with a click or keyboard
- 👁️ **Progress Preview** - Time preview on progress bar hover
- ⚙️ **Settings Panel** - Comprehensive settings menu
- 📱 **Responsive Design** - Works on desktop and mobile
- 🖱️ **Custom Context Menu** - Right-click menu with "Powered by AnisuPlayer"

### Dashboard
- 🔐 **Protected Access** - Secure authentication with JWT
- 📤 **Dual Upload Methods**:
  - **Direct Upload** - Upload video files directly (with auto-encoding)
  - **Link Upload** - Add videos via URL with custom resolution labels
- 🔄 **Auto Encoding** - Automatic video encoding to multiple resolutions
- 📊 **Encoding Progress** - Real-time progress tracking with ETA
- 🎥 **Video Management** - Full CRUD operations for videos
- 📋 **Copy CDN Links** - Easy sharing with one-click copy

### Encoding System (Local Development)
- 🎬 Automatic encoding to 1080p, 720p, 480p, 360p
- 📈 Real-time progress with estimated time remaining
- 🖼️ Automatic thumbnail generation
- 📦 Efficient storage with H.264 encoding

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.19+ or 22.12+ (required - Vite 7.3+ requires Node.js 20.19+ or 22.12+)
- **npm** or **yarn**
- **FFmpeg** (required for video encoding - local development only)

**⚠️ Important:** Make sure your Node.js version is 20.19+ or 22.12+. You can check with:
```bash
node --version
```
If you see a version lower than v20.19.0, please upgrade Node.js before proceeding.

### Installation

```bash
# Clone the repository
git clone https://github.com/nuril22/AnisuPlayer.git
cd AnisuPlayer

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development servers
npm run dev
```

Then open http://localhost:5173/login

### Default Credentials

```
Username: admin
Password: anisuplayer123
```

## 🔐 Environment Variables

Create a `.env.local` file with these variables:

```env
# Dashboard Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your_random_secret_key

# Server Configuration
PORT=3001
NODE_ENV=development
```

### How to Generate a JWT Secret

You can generate a secure JWT secret using one of these methods:

**Option 1: Using Node.js (recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 64
```

**Option 3: Online Generator**
Visit https://generate-secret.vercel.app/64 for a random secret

**⚠️ Important:** Never share or commit your JWT secret. Keep it safe!

## ☁️ Deploy to Vercel

AnisuPlayer is fully compatible with Vercel deployment.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/nuril22/AnisuPlayer.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3: Configure Environment Variables

In Vercel dashboard, go to **Settings → Environment Variables** and add:

| Name | Value |
|------|-------|
| `ADMIN_USERNAME` | Your admin username |
| `ADMIN_PASSWORD` | Your admin password |
| `JWT_SECRET` | Your JWT secret key |

### Step 4: Add Vercel KV (Optional)

For persistent video storage on Vercel:

1. Go to **Storage** in your Vercel dashboard
2. Create a new **KV Database**
3. Connect it to your project

The environment variables will be automatically added.

### Step 5: Deploy

Click **Deploy** and wait for the build to complete!

Your AnisuPlayer will be available at: `https://your-project.vercel.app`

## 🖥️ Deploy to VPS

AnisuPlayer can be deployed on any VPS (Virtual Private Server) with Node.js support. This guide covers deployment using PM2 for process management and Nginx as a reverse proxy.

### Prerequisites

- **VPS** with Ubuntu 20.04+ or similar Linux distribution
- **SSH access** to your VPS
- **Domain name** (optional, but recommended)
- **Node.js** 18.x or higher
- **FFmpeg** (for video encoding)

### Step 1: Connect to Your VPS

```bash
ssh root@your-vps-ip
# or
ssh username@your-vps-ip
```

### Step 2: Install Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Remove old Node.js if exists (optional)
sudo apt remove nodejs npm -y 2>/dev/null || true

# Install Node.js 20.x (LTS) - Required for Vite 7.3+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js version (should be 20.19+ or 22.12+)
node --version
npm --version

# If version is still old, try alternative installation method:
# For Node.js 22.x:
# curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
# sudo apt install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

**⚠️ Important:** Make sure Node.js version is **20.19+ or 22.12+**. Vite 7.3+ requires Node.js 20.19+ or 22.12+ for proper functionality.

### Step 3: Clone and Setup Project

```bash
# Navigate to your preferred directory
cd /var/www

# Clone the repository
sudo git clone https://github.com/nuril22/AnisuPlayer.git
cd AnisuPlayer

# Verify Node.js version before proceeding
node --version
# Should show v20.19.x or higher (or v22.12.x+)

# If version is incorrect, check Node.js installation:
# which node
# /usr/bin/node --version

# Install dependencies
sudo npm install

# Verify TypeScript can run
npx tsc --version

# Build the project
sudo npm run build
sudo npm run build:server
```

**Troubleshooting Build Issues:**

If you encounter `SyntaxError: Unexpected token '?'`:
1. **Check Node.js version:** `node --version` (must be 18.x or higher)
2. **Reinstall Node.js 18+** using the commands in Step 2
3. **Clear npm cache:** `sudo npm cache clean --force`
4. **Remove node_modules and reinstall:**
   ```bash
   sudo rm -rf node_modules package-lock.json
   sudo npm install
   ```

### Step 4: Configure Environment Variables

```bash
# Create .env file
sudo nano .env
```

Add the following configuration:

```env
# Dashboard Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your_random_secret_key

# Server Configuration
PORT=3001
NODE_ENV=production

# Storage Path (adjust as needed)
STORAGE_PATH=/var/www/AnisuPlayer/storage
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 5: Create Storage Directories

```bash
# Create storage directories
sudo mkdir -p storage/videos
sudo mkdir -p storage/subtitles
sudo mkdir -p storage/thumbnails

# Set proper permissions
sudo chown -R $USER:$USER storage
sudo chmod -R 755 storage
```

### Step 6: Setup PM2 Process Manager

```bash
# Create PM2 ecosystem file (using .cjs extension for CommonJS compatibility)
sudo nano ecosystem.config.cjs
```

Add the following configuration:

```javascript
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
```

**Note:** The file must be named `ecosystem.config.cjs` (not `.js`) because the project uses ES modules (`"type": "module"` in package.json), and PM2 requires CommonJS format.

```bash
# Create logs directory
sudo mkdir -p logs

# Start application with PM2
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the command
```

### Step 7: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/anisuplayer
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Increase upload size limit for video files
    client_max_body_size 2G;
    client_body_timeout 300s;

    # Frontend (React App)
    location / {
        root /var/www/AnisuPlayer/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # CDN Route
    location /cdn {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        root /var/www/AnisuPlayer/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/anisuplayer /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 8: Setup SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will automatically configure Nginx for HTTPS
# Certificates auto-renew via cron job
```

### Step 9: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 10: Verify Deployment

1. **Check PM2 Status:**
   ```bash
   pm2 status
   pm2 logs anisuplayer
   ```

2. **Check Nginx Status:**
   ```bash
   sudo systemctl status nginx
   ```

3. **Access Your Application:**
   - With domain: `http://your-domain.com` or `https://your-domain.com`
   - Without domain: `http://your-vps-ip`

### Useful Commands

**PM2 Management:**
```bash
pm2 restart anisuplayer    # Restart application
pm2 stop anisuplayer       # Stop application
pm2 logs anisuplayer       # View logs
pm2 monit                  # Monitor resources
```

**Nginx Management:**
```bash
sudo systemctl restart nginx    # Restart Nginx
sudo systemctl reload nginx     # Reload configuration
sudo nginx -t                   # Test configuration
```

**Update Application:**
```bash
cd /var/www/AnisuPlayer
git pull origin main
npm install
npm run build
npm run build:server
pm2 restart anisuplayer
```

### Troubleshooting

**Application not starting:**
- Check PM2 logs: `pm2 logs anisuplayer`
- Verify environment variables in `.env`
- Check if port 3001 is available: `sudo netstat -tulpn | grep 3001`

**Nginx 502 Bad Gateway:**
- Verify backend is running: `pm2 status`
- Check backend logs: `pm2 logs anisuplayer`
- Verify proxy_pass URL in Nginx config

**Permission Issues:**
- Check storage directory permissions: `ls -la storage`
- Fix permissions: `sudo chown -R $USER:$USER storage`

**SSL Certificate Issues:**
- Renew certificate: `sudo certbot renew`
- Check certificate status: `sudo certbot certificates`

**Build errors:**
- **"Vite requires Node.js version 20.19+ or 22.12+"** or **"SyntaxError: Unexpected token '?'"**:
  - **This means Node.js version is too old!**
  - Check version: `node --version` (must be 20.19+ or 22.12+)
  - Reinstall Node.js 20.x:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    node --version  # Verify it's 20.19.x or higher
    ```
  - Or install Node.js 22.x:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    node --version  # Verify it's 22.12.x or higher
    ```
  - Clear cache and rebuild:
    ```bash
    sudo npm cache clean --force
    sudo rm -rf node_modules package-lock.json
    sudo npm install
    sudo npm run build
    ```

- **"crypto.hash is not a function"**:
  - This error occurs when Node.js version is incompatible with Vite 7.3+
  - **Solution 1 (Recommended):** Upgrade to Node.js 20.19+ or 22.12+ (see above)
  - **Solution 2 (Alternative):** If you cannot upgrade Node.js, downgrade Vite to 5.x:
    ```bash
    cd /var/www/AnisuPlayer
    sudo npm install vite@^5.4.11 --save-dev
    sudo npm install
    sudo npm run build
    ```
    Note: Vite 5.x supports Node.js 18.x, but we still recommend upgrading to Node.js 20+ for better compatibility.

## 📖 Usage

### Accessing Videos

Videos can be accessed via the CDN route:
```
https://your-domain.com/cdn/[video-id]
```

### Adding Videos via Link (Recommended for Vercel)

Since Vercel doesn't support video encoding, use the **Link Upload** feature:

1. Go to Dashboard → Upload
2. Select "Add by Link" tab
3. Add video URLs with their resolutions:
   - Example: `https://cdn.example.com/video-1080p.mp4` → 1080p
   - Example: `https://cdn.example.com/video-720p.mp4` → 720p
4. Fill in title and description
5. Click "Add Video"

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `←` / `J` | Rewind 10 seconds |
| `→` / `L` | Forward 10 seconds |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute/Unmute |
| `F` | Toggle fullscreen |
| `<` | Decrease playback speed |
| `>` | Increase playback speed |
| `0-9` | Seek to 0%-90% |
| `,` | Previous frame (when paused) |
| `.` | Next frame (when paused) |
| `?` | Show keyboard shortcuts |

## 🔧 Local Development

For local development with video encoding support:

### Install FFmpeg

**Windows:**
```bash
choco install ffmpeg
# or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update && sudo apt install ffmpeg
```

### Run Development Servers

```bash
npm run dev
```

This starts both frontend (port 5173) and backend (port 3001).

### Direct Upload (Local Only)

When running locally with FFmpeg:
1. Go to Dashboard → Upload
2. Select "Upload File" tab
3. Drop or select a video file
4. The system will encode to multiple resolutions automatically

## 📝 API Reference

### Authentication

```
POST /api/auth/login     - Login with username/password
POST /api/auth/logout    - Clear authentication
GET  /api/auth/verify    - Verify current session
```

### Videos

```
GET    /api/videos           - List all videos (auth required)
GET    /api/videos/:id       - Get video by ID
POST   /api/videos/link      - Add video by link (auth required)
POST   /api/videos/upload    - Upload video file (auth required, local only)
PUT    /api/videos/:id       - Update video (auth required)
DELETE /api/videos/:id       - Delete video (auth required)
```

### CDN

```
GET /cdn/:id              - Get video data for player
```

### Encoding (Local Only)

```
GET /api/encoding/jobs      - List all encoding jobs
GET /api/encoding/jobs/:id  - Get specific job status
GET /api/encoding/active    - List active jobs
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite + SWC, React Router
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: SQLite (local), Vercel KV (production)
- **Video Processing**: FFmpeg (local only)
- **Authentication**: JWT, bcryptjs
- **Hosting**: Vercel

## 🔒 Security Notes

1. **Always use strong passwords** - Change default credentials immediately
2. **Keep JWT secret secure** - Never expose in client-side code
3. **Use HTTPS** - Vercel provides this automatically
4. **Regular updates** - Keep dependencies updated

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 VTX Group

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Powered by AnisuPlayer** 🎬
