#!/bin/bash
# ============================================================
# Script d'installation initiale — Site Bourse VPS
# Ubuntu 22.04 / 24.04 — UNE SEULE FOIS en root
# Usage : bash setup-vps.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Site Bourse — Installation VPS     ║"
echo "  ║   Ubuntu 22.04/24.04 · Node.js 24    ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Ce script doit être exécuté en root${NC}"; exit 1
fi

# ─────────────────────────────────────────
# 1. Mise à jour système
# ─────────────────────────────────────────
info "[1/9] Mise à jour du système..."
apt update -qq && apt upgrade -y -qq
apt install -y -qq curl wget git nano unzip htop
success "Système à jour"

# ─────────────────────────────────────────
# 2. Node.js 24 LTS (via NodeSource)
# ─────────────────────────────────────────
info "[2/9] Installation Node.js 24 LTS..."
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - > /dev/null 2>&1
apt install -y -qq nodejs
success "Node.js $(node --version) · npm $(npm --version)"

# ─────────────────────────────────────────
# 3. PostgreSQL
# ─────────────────────────────────────────
info "[3/9] Installation PostgreSQL..."
apt install -y -qq postgresql postgresql-contrib
systemctl enable postgresql --quiet
systemctl start postgresql

# Créer la DB et l'utilisateur
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'flo';" > /dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE DATABASE site_bourse;" > /dev/null 2>&1 || \
  warn "Base site_bourse déjà existante"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE site_bourse TO postgres;" > /dev/null 2>&1 || true
# Permissions sur le schéma public (PostgreSQL 15+)
sudo -u postgres psql -d site_bourse -c "GRANT ALL ON SCHEMA public TO postgres;" > /dev/null 2>&1 || true
success "PostgreSQL · DB site_bourse créée (user: postgres / flo)"

# ─────────────────────────────────────────
# 4. Nginx
# ─────────────────────────────────────────
info "[4/9] Installation Nginx..."
apt install -y -qq nginx
systemctl enable nginx --quiet
systemctl start nginx
success "Nginx installé"

# ─────────────────────────────────────────
# 5. PM2
# ─────────────────────────────────────────
info "[5/9] Installation PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
success "PM2 $(pm2 --version)"

# ─────────────────────────────────────────
# 6. Dossiers
# ─────────────────────────────────────────
info "[6/9] Création des dossiers..."
mkdir -p /var/www/site-bourse
mkdir -p /var/www/site-bourse-front
mkdir -p /var/log/site-bourse
# Permissions logs
chown root:root /var/log/site-bourse
chmod 755 /var/log/site-bourse
success "Dossiers créés"

# ─────────────────────────────────────────
# 7. Configuration Nginx
# ─────────────────────────────────────────
info "[7/9] Configuration Nginx..."

# Récupérer l'IP publique du VPS
VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "_")

cat > /etc/nginx/sites-available/site-bourse <<NGINX
server {
    listen 80;
    server_name ${VPS_IP} _;

    # Build React (fichiers statiques)
    root /var/www/site-bourse-front;
    index index.html;

    # SPA — toutes les routes → index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API → backend Node.js
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        add_header X-Backend "site-bourse-api" always;
    }

    # Compression gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Cache fichiers statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Logs
    access_log /var/log/nginx/site-bourse.access.log;
    error_log  /var/log/nginx/site-bourse.error.log;
}
NGINX

ln -sf /etc/nginx/sites-available/site-bourse /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
success "Nginx configuré (IP: ${VPS_IP})"

# ─────────────────────────────────────────
# 8. Firewall UFW
# ─────────────────────────────────────────
info "[8/9] Configuration firewall UFW..."
if command -v ufw &> /dev/null; then
  ufw --force reset > /dev/null 2>&1
  ufw default deny incoming > /dev/null 2>&1
  ufw default allow outgoing > /dev/null 2>&1
  ufw allow ssh > /dev/null 2>&1
  ufw allow http > /dev/null 2>&1
  ufw allow https > /dev/null 2>&1
  ufw --force enable > /dev/null 2>&1
  success "UFW activé (SSH + HTTP + HTTPS)"
else
  warn "UFW non disponible — firewall à configurer manuellement"
fi

# ─────────────────────────────────────────
# 9. Résumé final
# ─────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Installation terminée !                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}Prochaines étapes :${NC}"
echo ""
echo -e "  ${BLUE}1.${NC} Cloner le repo :"
echo -e "     ${YELLOW}cd /var/www/site-bourse${NC}"
echo -e "     ${YELLOW}git clone <REPO_URL> .${NC}"
echo ""
echo -e "  ${BLUE}2.${NC} Créer le fichier .env :"
echo -e "     ${YELLOW}cp .env.production.example .env && nano .env${NC}"
echo ""
echo -e "  ${BLUE}3.${NC} Déployer :"
echo -e "     ${YELLOW}bash deploy.sh${NC}"
echo ""
echo -e "  ${BLUE}4.${NC} Optionnel — migrer la DB depuis votre PC :"
echo -e "     ${YELLOW}# Sur votre PC : pg_dump -U postgres -d site_bourse -F c -f backup.dump${NC}"
echo -e "     ${YELLOW}# Transférer : scp backup.dump root@VPS_IP:/tmp/${NC}"
echo -e "     ${YELLOW}# Sur le VPS : pg_restore -U postgres -d site_bourse -v /tmp/backup.dump${NC}"
echo ""
