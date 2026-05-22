# 🚀 Hasibha — Docker VPS Deployment Guide

> Complete guide to deploying the entire Hasibha backend on a VPS (Virtual Private Server) using **Docker Compose**.
> Last Updated: **May 2026**

---

## 📋 Project Overview

We are deploying:
1. **auth-backend** (Node.js, Port 3210)
2. **home-backend** (Node.js, Port 5001)
3. **ai-service** (Python FastAPI, Port 8000)

All three services run inside Docker containers on a shared virtual network.

> **Note:** MongoDB is hosted externally on **MongoDB Atlas**, so we don't need to run a local database container.

---

## 💻 Step 1: VPS Minimum Specifications

For running the AI models and Node services smoothly:
- **CPU:** 2 vCPUs (4 recommended)
- **RAM:** 4 GB (8 GB recommended)
- **Storage:** 40+ GB SSD
- **OS:** Ubuntu 22.04 LTS or 24.04 LTS

**Recommended Providers:** Hetzner (CPX21), Contabo (VPS M), or DigitalOcean (4GB Basic Droplet).

---

## 📦 Step 2: Initial Server Setup

SSH into your new VPS using the IP address provided by your host:

```bash
ssh root@YOUR_VPS_IP
```

Update the system:
```bash
apt update && apt upgrade -y
```

Install Git and Curl:
```bash
apt install git curl -y
```

---

## 🐳 Step 3: Install Docker & Docker Compose

Docker is the only major dependency you need to install.

```bash
# 1. Download and run the official Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Verify installation
docker --version
docker compose version
```

---

## 📂 Step 4: Clone the Project & Setup Secrets

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Graduation_Project1.git /opt/hasibha
cd /opt/hasibha
```

Now, create the `.env` files based on the examples. **You must do this for all three folders.**

```bash
cp auth-backend/.env.example auth-backend/.env
cp home-backend/.env.example home-backend/.env
cp grad_project_ai/.env.example grad_project_ai/.env
```

Use `nano` to edit each file and put your real production secrets in:

```bash
nano auth-backend/.env
nano home-backend/.env
nano grad_project_ai/.env
```

> ⚠️ **CRITICAL:** 
> - Make sure `JWT_SECRET` is exactly the same in both `auth-backend` and `home-backend`.
> - Add your MongoDB Atlas connection string to all three `.env` files.

### Upload the Firebase Key

You need to securely upload the Firebase JSON key from your local computer to the server. Run this command **from your local computer terminal** (not the VPS):

```bash
# Run on your local computer
scp hasibha-notificatio-firebase-adminsdk-fbsvc-ac5586ab12.json root@YOUR_VPS_IP:/opt/hasibha/
```

---

## 🚀 Step 5: Build and Start Containers

Back on your VPS, run the following commands to build the images and start the services:

```bash
cd /opt/hasibha

# Build the images (This takes ~5 minutes as it installs Python ML libraries)
docker compose build

# Start the services in the background
docker compose up -d
```

Verify everything is running and healthy:
```bash
docker compose ps
```
*(Wait about 40 seconds; the status should change from `starting` to `healthy`)*.

---

## 🌐 Step 6: Setup Nginx & SSL (Reverse Proxy)

To expose your APIs to the internet securely via HTTPS, we'll install Nginx and Certbot.

```bash
apt install nginx certbot python3-certbot-nginx -y
```

Create the Nginx configuration:
```bash
nano /etc/nginx/sites-available/hasibha
```

Paste the following (replace `yourdomain.com` with your actual domain name):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 25M; # Allow large audio/image uploads

    # Auth Backend
    location /api/auth/ { proxy_pass http://127.0.0.1:3210; }
    location /api/security/ { proxy_pass http://127.0.0.1:3210; }
    location /api/sms/ { proxy_pass http://127.0.0.1:3210; }

    # Home Backend (everything else under /api/)
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_read_timeout 120s; # AI endpoints can take a while
    }

    # Root
    location / {
        return 200 '{"status":"Hasibha API is running"}';
        add_header Content-Type application/json;
    }
}
```

Enable the site and restart Nginx:
```bash
ln -s /etc/nginx/sites-available/hasibha /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Get your free SSL certificate:
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🛠️ Maintenance Commands

Whenever you push new code to GitHub, here is how you update the server:

```bash
cd /opt/hasibha

# Pull the latest code
git pull origin main

# Rebuild only the images that changed and restart them seamlessly
docker compose up --build -d

# Clean up old unused Docker images to save disk space
docker image prune -f
```

To view logs for debugging:
```bash
docker compose logs -f                # View all logs
docker compose logs -f auth-backend   # View specific service logs
```
