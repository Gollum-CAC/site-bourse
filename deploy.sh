#!/bin/bash
# ============================================================
# Script de déploiement — Site Bourse
# À exécuter sur le VPS après chaque git push
# Usage : bash deploy.sh
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()    { echo -e "\n${BLUE}▶ $1${NC}"; }
success() { echo -e "${GREEN}  ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠ $1${NC}"; }

echo -e "${BLUE}"
echo "  ╔════════════════════════════════════╗"
echo "  ║   Site Bourse — Déploiement        ║"
echo "  ╚════════════════════════════════════╝"
echo -e "${NC}"

# Vérifier qu'on est dans le bon dossier
if [ ! -f "backend/src/server.js" ]; then
  echo -e "${RED}❌ Exécutez ce script depuis /var/www/site-bourse${NC}"; exit 1
fi

# ─────────────────────────────────────────
# 1. Git pull
# ─────────────────────────────────────────
step "[1/5] Récupération des mises à jour git..."
git pull origin main
success "Code à jour"

# ─────────────────────────────────────────
# 2. Dépendances backend
# ─────────────────────────────────────────
step "[2/5] Installation dépendances backend..."
cd backend
npm install --omit=dev --silent
cd ..
success "Dépendances backend OK"

# ─────────────────────────────────────────
# 3. Build frontend
# ─────────────────────────────────────────
step "[3/5] Build frontend React..."
cd frontend
npm install --silent
npm run build
cd ..
success "Frontend buildé → frontend/dist/"

# ─────────────────────────────────────────
# 4. Copier le build dans le dossier Nginx
# ─────────────────────────────────────────
step "[4/5] Déploiement du frontend..."
rm -rf /var/www/site-bourse-front/*
cp -r frontend/dist/* /var/www/site-bourse-front/
success "Frontend déployé dans /var/www/site-bourse-front/"

# ─────────────────────────────────────────
# 5. Redémarrer le backend PM2
# ─────────────────────────────────────────
step "[5/5] Redémarrage du backend..."
if pm2 list | grep -q "site-bourse-backend"; then
  pm2 reload ecosystem.config.js --update-env
  success "Backend rechargé (PM2)"
else
  pm2 start ecosystem.config.js
  pm2 save
  success "Backend démarré pour la première fois (PM2)"
fi

# ─────────────────────────────────────────
# Résumé
# ─────────────────────────────────────────
VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "VPS_IP")
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Déploiement terminé !                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Site    : ${YELLOW}http://${VPS_IP}${NC}"
echo -e "  📊 API     : ${YELLOW}http://${VPS_IP}/api/health${NC}"
echo -e "  📋 PM2     : ${YELLOW}pm2 status${NC}"
echo -e "  📄 Logs    : ${YELLOW}pm2 logs site-bourse-backend${NC}"
echo ""
