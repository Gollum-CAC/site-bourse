#!/bin/bash
# ============================================================
# Script de déploiement — Site Bourse
# À exécuter sur le VPS lors des mises à jour
# Usage : bash deploy.sh
# ============================================================

set -e  # Arrêter si une commande échoue

echo "🚀 [Deploy] Démarrage du déploiement..."

# --- 1. Récupérer les dernières modifications ---
echo "📥 [Deploy] Git pull..."
git pull origin main

# --- 2. Installer les dépendances backend ---
echo "📦 [Deploy] Installation dépendances backend..."
cd backend
npm install --omit=dev
cd ..

# --- 3. Installer et builder le frontend ---
echo "🔨 [Deploy] Build du frontend React..."
cd frontend
npm install
npm run build
cd ..

# --- 4. Copier le build dans le dossier Nginx ---
echo "📂 [Deploy] Copie du build vers /var/www/site-bourse-front..."
sudo rm -rf /var/www/site-bourse-front/*
sudo cp -r frontend/dist/* /var/www/site-bourse-front/

# --- 5. Redémarrer le backend avec PM2 ---
echo "🔄 [Deploy] Redémarrage PM2..."
pm2 reload ecosystem.config.js --update-env

echo "✅ [Deploy] Déploiement terminé !"
echo "🌐 Site accessible sur http://192.210.181.169"
