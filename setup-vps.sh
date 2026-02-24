#!/bin/bash
# ============================================================
# Script d'installation initiale — Site Bourse VPS
# Ubuntu 24.04 — À exécuter UNE SEULE FOIS en root/sudo
# Usage : bash setup-vps.sh
# ============================================================

set -e

echo "========================================"
echo "  Installation Site Bourse sur VPS"
echo "========================================"

# --- 1. Mise à jour système ---
echo ""
echo "📦 [1/9] Mise à jour du système..."
apt update && apt upgrade -y

# --- 2. Installation Node.js 20 LTS ---
echo ""
echo "🟢 [2/9] Installation Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version

# --- 3. Installation PostgreSQL ---
echo ""
echo "🐘 [3/9] Installation PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# --- 4. Installation Nginx ---
echo ""
echo "🌐 [4/9] Installation Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# --- 5. Installation PM2 ---
echo ""
echo "⚙️  [5/9] Installation PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# --- 6. Installation Git ---
echo ""
echo "📂 [6/9] Installation Git..."
apt install -y git

# --- 7. Création des dossiers ---
echo ""
echo "📁 [7/9] Création des dossiers..."
mkdir -p /var/www/site-bourse
mkdir -p /var/www/site-bourse-front
mkdir -p /var/log/site-bourse
chown -R www-data:www-data /var/www/site-bourse-front

# --- 8. Configuration PostgreSQL ---
echo ""
echo "🐘 [8/9] Configuration de la base de données..."
# Créer l'utilisateur et la base de données
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    CREATE USER postgres WITH PASSWORD 'flo';
  ELSE
    ALTER USER postgres WITH PASSWORD 'flo';
  END IF;
END
\$\$;
CREATE DATABASE site_bourse OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE site_bourse TO postgres;
EOF
echo "✅ Base de données 'site_bourse' créée"

# --- 9. Configuration Nginx ---
echo ""
echo "🌐 [9/9] Configuration Nginx..."
cat > /etc/nginx/sites-available/site-bourse <<'NGINX'
server {
    listen 80;
    server_name 192.210.181.169;

    # Frontend React (fichiers statiques buildés)
    root /var/www/site-bourse-front;
    index index.html;

    # SPA React — toutes les routes renvoient index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy vers le backend Node.js
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Logs
    access_log /var/log/nginx/site-bourse-access.log;
    error_log  /var/log/nginx/site-bourse-error.log;
}
NGINX

# Activer le site
ln -sf /etc/nginx/sites-available/site-bourse /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "========================================"
echo "✅ Installation terminée !"
echo "========================================"
echo ""
echo "👉 Prochaine étape : cloner le repo et configurer le .env"
echo "   cd /var/www/site-bourse"
echo "   git clone <URL_DU_REPO> ."
echo "   nano .env"
echo ""
