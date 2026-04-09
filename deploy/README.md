# AgentLabs — AWS EC2 Deployment Guide

This guide walks you through deploying the AgentLabs AI Calling Platform to a dedicated AWS EC2 instance. Two deployment methods are covered:

- **Option A**: Bare-metal (Node.js + Nginx + systemd) — recommended for production
- **Option B**: Docker Compose — simpler setup, good for testing or smaller deployments

---

## Prerequisites

- AWS account with IAM access to EC2
- A domain name pointed to your server's IP (for SSL)
- Your project code in a Git repository (GitHub, GitLab, etc.)

---

## 1. Provision the EC2 Instance

### Recommended Instance

| Spec | Recommendation |
|------|---------------|
| Instance type | `t3.medium` (2 vCPU, 4 GB RAM) minimum; `t3.large` for production |
| OS | Ubuntu 22.04 LTS (ami) |
| Storage | 30 GB gp3 SSD minimum |
| Region | Choose closest to your users |

### Security Group Rules

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | Server management |
| HTTP | 80 | 0.0.0.0/0 | Redirect to HTTPS |
| HTTPS | 443 | 0.0.0.0/0 | Application traffic |
| Custom TCP | 5000 | 127.0.0.1 | Node.js app (local only) |

### Launch & Connect

1. Go to **EC2 > Launch Instance** in the AWS Console
2. Choose Ubuntu 22.04 LTS AMI
3. Select your instance type
4. Configure the security group as above
5. Create or select a key pair for SSH access
6. Launch the instance
7. Allocate and associate an **Elastic IP** so the IP doesn't change on restart

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

## 2. Server Setup

Run these commands on your EC2 instance:

### 2.1 System Updates

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx jq
```

### 2.2 Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Should show v20.x
npm -v
```

### 2.3 Install PostgreSQL 16 with pgvector

```bash
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install pgvector extension
sudo apt install -y postgresql-16-pgvector

# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2.4 Create Database

```bash
sudo -u postgres psql <<EOF
CREATE USER agentlabs WITH PASSWORD 'your-strong-password-here';
CREATE DATABASE agentlabs OWNER agentlabs;
GRANT ALL PRIVILEGES ON DATABASE agentlabs TO agentlabs;
\c agentlabs
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

### 2.5 Create Application User

```bash
sudo useradd -m -s /bin/bash agentlabs
sudo mkdir -p /home/agentlabs/app
sudo chown agentlabs:agentlabs /home/agentlabs/app
```

---

## 3. Option A — Bare-Metal Deployment

### 3.1 Clone & Build

```bash
sudo su - agentlabs
cd /home/agentlabs/app
git clone https://github.com/your-org/agentlabs.git .

# Copy and edit environment variables
cp deploy/.env.production.example .env
nano .env
# Fill in all [REQUIRED] variables, especially:
#   DATABASE_URL=postgresql://agentlabs:your-strong-password-here@localhost:5432/agentlabs
#   APP_DOMAIN=yourdomain.com
#   JWT_SECRET, SESSION_SECRET, INTERNAL_API_SECRET
#   API keys for your AI/telephony/payment providers

# Install dependencies
npm ci

# Build for production
npm run build

# Push database schema
npx drizzle-kit push

# Create required directories
mkdir -p client/public/uploads client/public/images public/audio public/avatars public/widget

# Test that it starts
NODE_ENV=production node dist/index.cjs
# You should see "serving on port 5000" — press Ctrl+C to stop

exit  # Back to ubuntu user
```

### 3.2 Install Systemd Service

```bash
sudo cp /home/agentlabs/app/deploy/agentlabs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agentlabs
sudo systemctl start agentlabs

# Allow agentlabs user to restart the service without password (for deploy.sh)
echo 'agentlabs ALL=(ALL) NOPASSWD: /bin/systemctl restart agentlabs, /bin/systemctl status agentlabs' | sudo tee /etc/sudoers.d/agentlabs
sudo chmod 440 /etc/sudoers.d/agentlabs

# Verify it's running
sudo systemctl status agentlabs
sudo journalctl -u agentlabs -f  # Watch logs
```

### 3.3 Configure Nginx

```bash
# Copy the config
sudo cp /home/agentlabs/app/deploy/nginx.conf /etc/nginx/sites-available/agentlabs

# Replace domain placeholder
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/agentlabs

# Enable the site
sudo ln -sf /etc/nginx/sites-available/agentlabs /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# For initial setup WITHOUT SSL (to get Certbot working):
# Comment out the SSL server block and uncomment this temporary config,
# or simply get the certificate first:
```

### 3.4 SSL Certificate with Let's Encrypt

```bash
# Get SSL certificate (Nginx must be serving on port 80 first)
# Temporarily modify nginx config to serve on port 80 without SSL redirect:
sudo tee /etc/nginx/sites-available/agentlabs-temp <<EOF
server {
    listen 80;
    server_name your-actual-domain.com www.your-actual-domain.com;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/agentlabs-temp /etc/nginx/sites-enabled/agentlabs
sudo nginx -t && sudo systemctl reload nginx

# Now get the certificate
sudo certbot --nginx -d your-actual-domain.com -d www.your-actual-domain.com

# Restore the full config with SSL
sudo cp /home/agentlabs/app/deploy/nginx.conf /etc/nginx/sites-available/agentlabs
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/agentlabs
sudo ln -sf /etc/nginx/sites-available/agentlabs /etc/nginx/sites-enabled/agentlabs
sudo rm -f /etc/nginx/sites-available/agentlabs-temp
sudo nginx -t && sudo systemctl reload nginx

# Auto-renewal is set up automatically by Certbot
sudo certbot renew --dry-run  # Test auto-renewal
```

### 3.5 Verify Deployment

```bash
# Health check
curl -s https://your-actual-domain.com/health | jq

# Or use the included health check script
bash /home/agentlabs/app/deploy/healthcheck.sh
```

---

## 3. Option B — Docker Compose Deployment

### 3.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# Log out and back in for group change to take effect
```

### 3.2 Configure & Launch

```bash
cd /home/ubuntu
git clone https://github.com/your-org/agentlabs.git
cd agentlabs

# Copy and edit environment variables
cp deploy/.env.production.example .env
nano .env
# IMPORTANT: Set POSTGRES_PASSWORD to a strong random password (required, no default)
# Note: DATABASE_URL is overridden by docker-compose.yml to use the Postgres container
# Fill in all other [REQUIRED] variables (JWT_SECRET, API keys, etc.)

# Build and start (migrations run automatically on startup)
docker compose -f deploy/docker-compose.yml up -d --build

# Check logs (you should see "Running database migrations..." in the output)
docker compose -f deploy/docker-compose.yml logs -f app
```

### 3.3 Nginx & SSL for Docker

Follow the same Nginx and Certbot steps from Option A (sections 3.3 and 3.4), just ensure the proxy points to port 5000 where the Docker container is listening.

---

## 4. Ongoing Operations

### Updating the Application

**Bare-metal:**
```bash
sudo su - agentlabs
cd /home/agentlabs/app
bash deploy/deploy.sh
```

**Docker:**
```bash
cd /path/to/agentlabs
git pull origin main
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec app npx drizzle-kit push
```

### Monitoring

```bash
# Service status
sudo systemctl status agentlabs

# Live logs
sudo journalctl -u agentlabs -f

# Health check
bash deploy/healthcheck.sh

# Detailed health with integration status
curl -s https://yourdomain.com/health/detailed | jq
```

### Database Backup

```bash
# Create a backup
sudo -u postgres pg_dump agentlabs > /home/agentlabs/backups/agentlabs-$(date +%Y%m%d).sql

# Automate with cron (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * sudo -u postgres pg_dump agentlabs | gzip > /home/agentlabs/backups/agentlabs-$(date +\%Y\%m\%d).sql.gz
```

### Log Rotation

Create `/etc/logrotate.d/agentlabs`:
```
/var/log/agentlabs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
}
```

---

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check `.env` file, especially `DATABASE_URL`. Run `sudo journalctl -u agentlabs -n 100` |
| 502 Bad Gateway | App not running or wrong port. Check `sudo systemctl status agentlabs` |
| Database connection refused | Verify PostgreSQL is running: `sudo systemctl status postgresql` |
| WebSocket not connecting | Ensure Nginx config has the `Upgrade` and `Connection` headers |
| SSL certificate expired | Run `sudo certbot renew` |
| Out of memory | Upgrade instance type or add swap: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Permission denied on uploads | Check ownership: `sudo chown -R agentlabs:agentlabs /home/agentlabs/app/client/public/uploads` |
| pgvector not found | Run `CREATE EXTENSION IF NOT EXISTS vector;` in psql |

---

## 6. Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] SSH key-only access (disable password login)
- [ ] Firewall: only ports 22, 80, 443 open
- [ ] Regular OS security updates (`sudo unattended-upgrades`)
- [ ] Database not exposed to internet (localhost only)
- [ ] HTTPS enforced via Nginx redirect
- [ ] Regular database backups
- [ ] Monitor disk space and memory usage
