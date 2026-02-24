# 🚀 Guide de déploiement — Site Bourse sur VPS

**VPS :** 192.210.181.169 (Ubuntu 24.04)  
**Stack :** Node.js + PostgreSQL + Nginx + PM2

---

## ÉTAPE 1 — Se connecter au VPS

Depuis votre PC Windows, ouvrez **PowerShell** ou **CMD** et tapez :

```bash
ssh root@192.210.181.169
```

Il vous demandera le mot de passe root de votre VPS (fourni par RackNerd).

---

## ÉTAPE 2 — Installation automatique (une seule fois)

Une fois connecté en SSH, copiez-collez ces commandes **une par une** :

### 2a. Récupérer le script d'installation depuis git

D'abord, trouvez l'URL de votre repo GitHub. Allez sur github.com,  
copiez l'URL HTTPS (ex: `https://github.com/VotreUser/site-bourse.git`)

```bash
# Cloner temporairement pour récupérer le script
cd /tmp
git clone https://github.com/VotreUser/site-bourse.git setup-tmp
bash setup-tmp/setup-vps.sh
```

> ⚠️ Remplacez `https://github.com/VotreUser/site-bourse.git` par votre vraie URL

### 2b. Le script installe automatiquement :
- Node.js 20 LTS
- PostgreSQL (avec la DB `site_bourse` et l'user `postgres/flo`)
- Nginx (serveur web)
- PM2 (gestionnaire de processus)
- Tous les dossiers nécessaires

---

## ÉTAPE 3 — Cloner le projet sur le VPS

```bash
cd /var/www/site-bourse
git clone https://github.com/VotreUser/site-bourse.git .
```

---

## ÉTAPE 4 — Créer le fichier .env sur le VPS

```bash
nano /var/www/site-bourse/.env
```

Copiez-collez ce contenu :

```env
FMP_API_KEY="tKuQW8v6mePiCu52T345K1HYt27FB4Kn"
COINGECKO_API_KEY="CG-bLS4uCxqWgE9mc9fLyuJVVBb"
NEWSAPI_API_KEY="17bb8a4e077540db9d5d1631ba844502"
DATABASE_URL="postgresql://postgres:flo@localhost:5432/site_bourse"
PORT=3001
NODE_ENV=production
```

Sauvegarder : **Ctrl+O** puis **Entrée**, quitter : **Ctrl+X**

---

## ÉTAPE 5 — Migrer la base de données depuis votre PC

### 5a. Sur votre PC Windows, exportez la DB actuelle

Ouvrez **PowerShell** sur votre PC (pas le VPS) :

```powershell
pg_dump -U postgres -d site_bourse -F c -f C:\Users\jpbau\Desktop\site_bourse_backup.dump
```

### 5b. Transférez le dump vers le VPS

```powershell
scp C:\Users\jpbau\Desktop\site_bourse_backup.dump root@192.210.181.169:/tmp/
```

### 5c. Sur le VPS, importez le dump

```bash
pg_restore -U postgres -d site_bourse -v /tmp/site_bourse_backup.dump
```

> ✅ Vos 346 actions et toutes les données existantes seront conservées !

---

## ÉTAPE 6 — Premier déploiement

```bash
cd /var/www/site-bourse
bash deploy.sh
```

Ce script :
1. Installe les dépendances Node.js du backend
2. Build le frontend React en statique
3. Copie le build dans le dossier Nginx
4. Démarre le backend avec PM2

---

## ÉTAPE 7 — Vérifications

```bash
# Vérifier que le backend tourne
pm2 status

# Voir les logs en temps réel
pm2 logs site-bourse-backend

# Vérifier Nginx
systemctl status nginx

# Tester l'API
curl http://localhost:3001/api/health
```

Le site devrait être accessible sur : **http://192.210.181.169**

---

## Mise à jour du site (après chaque git push)

Depuis le VPS en SSH :

```bash
cd /var/www/site-bourse
bash deploy.sh
```

C'est tout ! 🎉

---

## Commandes PM2 utiles

```bash
pm2 status                    # État de tous les processus
pm2 logs site-bourse-backend  # Logs en temps réel
pm2 restart site-bourse-backend  # Redémarrer le backend
pm2 stop site-bourse-backend     # Arrêter le backend
pm2 monit                     # Dashboard temps réel
```

---

## Dépannage

**Le site ne s'affiche pas :**
```bash
systemctl status nginx
nginx -t  # Teste la config Nginx
```

**Le backend ne répond pas :**
```bash
pm2 logs site-bourse-backend --lines 50
```

**Problème de DB :**
```bash
sudo -u postgres psql -c "\l"  # Lister les bases
sudo -u postgres psql site_bourse -c "SELECT COUNT(*) FROM stocks;"
```
