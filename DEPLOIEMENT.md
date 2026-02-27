# 🚀 Guide de déploiement — Site Bourse sur VPS Linux

**Stack :** Node.js 24 + PostgreSQL 16 + Nginx + PM2  
**Plan FMP :** Gratuit (250 appels/jour · 87 symboles US)

---

## Prérequis

- Un VPS sous Ubuntu 22.04 ou 24.04
- Accès SSH root
- Le repo git du projet sur GitHub (ou GitLab)

---

## ÉTAPE 1 — Connexion SSH

Depuis votre PC Windows :

```powershell
ssh root@VOTRE_IP_VPS
```

---

## ÉTAPE 2 — Installation du serveur (une seule fois)

Une fois connecté en SSH :

```bash
# Télécharger le script d'installation
curl -fsSL https://raw.githubusercontent.com/VOTRE_USER/site-bourse/main/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

**Ce script installe automatiquement :**
- Node.js 24 LTS
- PostgreSQL (DB `site_bourse`, user `postgres`/`flo`)
- Nginx (reverse proxy + serveur statique)
- PM2 (gestionnaire de processus Node.js)
- UFW (firewall : SSH + HTTP + HTTPS)

---

## ÉTAPE 3 — Cloner le projet

```bash
cd /var/www/site-bourse
git clone https://github.com/VOTRE_USER/site-bourse.git .
```

---

## ÉTAPE 4 — Configurer les variables d'environnement

```bash
cp .env.production.example .env
nano .env
```

Remplir avec vos clés API :

```env
FMP_API_KEY="votre_cle_fmp"
COINGECKO_API_KEY="votre_cle_coingecko"
NEWSAPI_API_KEY="votre_cle_newsapi"
DATABASE_URL="postgresql://postgres:flo@localhost:5432/site_bourse"
PORT=3001
NODE_ENV=production
```

Sauvegarder : **Ctrl+O** → **Entrée** → **Ctrl+X**

---

## ÉTAPE 5 — (Optionnel) Migrer la base depuis votre PC

Si vous voulez transférer les données existantes :

**Sur votre PC Windows (PowerShell) :**
```powershell
# Exporter la DB locale
pg_dump -U postgres -d site_bourse -F c -f C:\Users\jpbau\Desktop\site_bourse.dump

# Transférer vers le VPS
scp C:\Users\jpbau\Desktop\site_bourse.dump root@VOTRE_IP_VPS:/tmp/
```

**Sur le VPS :**
```bash
pg_restore -U postgres -d site_bourse -v /tmp/site_bourse.dump
```

> Si vous ne transférez pas la DB, le crawler remplira automatiquement les données
> en environ 2 jours (budget 200 appels/jour sur le plan gratuit FMP).

---

## ÉTAPE 6 — Premier déploiement

```bash
cd /var/www/site-bourse
bash deploy.sh
```

Le script :
1. `git pull` (code à jour)
2. `npm install` backend
3. Build React → `frontend/dist/`
4. Copie du build dans `/var/www/site-bourse-front/`
5. Démarrage du backend avec PM2

---

## ÉTAPE 7 — Vérifications

```bash
# État des processus PM2
pm2 status

# Logs en temps réel
pm2 logs site-bourse-backend

# Tester l'API
curl http://localhost:3001/api/health

# Vérifier Nginx
systemctl status nginx
nginx -t
```

Le site est accessible sur : **http://VOTRE_IP_VPS**

---

## Mise à jour après un `git push`

```bash
cd /var/www/site-bourse
bash deploy.sh
```

---

## Commandes PM2 utiles

```bash
pm2 status                          # Vue d'ensemble
pm2 logs site-bourse-backend        # Logs temps réel
pm2 logs site-bourse-backend --lines 100  # 100 dernières lignes
pm2 restart site-bourse-backend     # Redémarrer
pm2 stop site-bourse-backend        # Arrêter
pm2 monit                           # Dashboard CPU/RAM
pm2 save                            # Sauvegarder la config (survie reboot)
```

---

## Dépannage

**Le site ne s'affiche pas :**
```bash
systemctl status nginx
nginx -t
cat /var/log/nginx/site-bourse.error.log
```

**Le backend ne répond pas :**
```bash
pm2 logs site-bourse-backend --lines 50
# Vérifier que le port 3001 est libre
ss -tlnp | grep 3001
```

**Problème de base de données :**
```bash
sudo -u postgres psql -c "\l"
sudo -u postgres psql -d site_bourse -c "SELECT COUNT(*) FROM stocks;"
sudo -u postgres psql -d site_bourse -c "SELECT * FROM crawler_state;"
```

**Vérifier le quota FMP :**
```bash
curl http://localhost:3001/api/quota
```

**Vérifier la progression du crawler :**
```bash
curl http://localhost:3001/api/health | python3 -m json.tool
# ou directement dans le navigateur : http://VOTRE_IP_VPS/api/db-status
```

---

## Calendrier de remplissage de la DB

| Jour | Appels FMP | Données récupérées |
|------|-----------|---------------------|
| J1   | ~88        | 87 quotes (batch) + jusqu'à 88 profils |
| J2   | ~87        | 87 historiques de dividendes |
| J3   | ~10        | Refresh quotes (EOD toutes les 6h) |
| J4+  | ~10/jour   | Maintenance uniquement |

Le site est pleinement fonctionnel dès J1 (cours affichés).  
Les dividendes apparaissent dans "Dividend Stocks" à partir de J2.

---

## Structure des dossiers sur le VPS

```
/var/www/site-bourse/          ← Code source (git)
  backend/src/                 ← API Node.js
  frontend/dist/               ← Build React (généré par deploy.sh)
  .env                         ← Variables (ne pas committer !)
  ecosystem.config.js          ← Config PM2

/var/www/site-bourse-front/    ← Fichiers servis par Nginx
/var/log/site-bourse/          ← Logs PM2 (out.log, error.log)
/etc/nginx/sites-available/site-bourse  ← Config Nginx
```
