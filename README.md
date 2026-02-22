# 📈 Site Bourse

Plateforme de centralisation de données financières : actions (US + Europe), cryptos, actualités et **Super Dividendes PEA**.

## Prérequis

- **Node.js** v18+ (tu as v24)
- **PostgreSQL** installé et lancé
- **npm** (fourni avec Node.js)

## 1. Base de données PostgreSQL

Ouvre un terminal et crée la base :

```bash
psql -U postgres
```

```sql
CREATE DATABASE site_bourse;
\q
```

> Les tables sont créées automatiquement au démarrage du backend.

## 2. Configuration

Le fichier `.env` à la racine contient les clés API et le mot de passe PostgreSQL :

```
FMP_API_KEY="ta_clé_fmp"
COINGECKO_API_KEY="ta_clé_coingecko"
NEWSAPI_API_KEY="ta_clé_newsapi"
DATABASE_URL="postgresql://postgres:flo@localhost:5432/site_bourse"
PORT=3001
```

## 3. Installation

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## 4. Lancement

Tu as besoin de **2 terminaux** :

### Terminal 1 — Backend (API + Crawler)

```bash
cd backend
npm run dev
```

Tu devrais voir :

```
[FMP] API Key chargée: tKuQW8...
✅ Connecté à PostgreSQL
✅ Tables de base de données initialisées
🚀 Serveur démarré sur http://localhost:3001
🕷️ Crawler démarrage — budget 1000/jour
🔍 Collecte des symboles Euronext (1 appel API)...
✅ XXX symboles Euronext en base
```

### Terminal 2 — Frontend (React)

```bash
cd frontend
npm run dev
```

Puis ouvre **http://localhost:5173** dans ton navigateur.

## Pages disponibles

| Page | URL | Description |
|------|-----|-------------|
| Accueil | `/` | Cours actions par marché (US, Paris, Amsterdam, Francfort, Londres) + cryptos + news |
| Super Dividendes | `/super-dividendes` | Actions PEA à rendement ≥ 7% avec score composite |
| Détail action | `/action/:symbol` | Graphique, ratios, états financiers, dividendes, profil |
| Cryptos | `/cryptos` | Top cryptomonnaies par capitalisation |
| Détail crypto | `/crypto/:id` | Détail d'une crypto |
| Actualités | `/news` | Actualités financières |
| Watchlist | `/watchlist` | Actions favorites (stockées en localStorage) |

## Architecture

```
Site Bourse/
├── .env                          # Clés API + config PostgreSQL
├── backend/
│   └── src/
│       ├── server.js             # Serveur Express (port 3001)
│       ├── initDb.js             # Création auto des tables
│       ├── crawler.js            # Collecte par roulement (dividendes)
│       ├── config/
│       │   └── database.js       # Connexion PostgreSQL
│       ├── routes/
│       │   ├── actions.js        # /api/actions (quotes, recherche, ratios, bilans)
│       │   ├── cryptos.js        # /api/cryptos (CoinGecko)
│       │   ├── news.js           # /api/news (NewsAPI)
│       │   └── superDividendes.js# /api/dividendes/super (depuis PostgreSQL)
│       └── services/
│           ├── fmpService.js     # Appels FMP avec cache + rate limit
│           ├── cacheService.js   # Cache mémoire
│           ├── coingeckoService.js
│           └── newsService.js
└── frontend/
    └── src/
        ├── App.jsx               # Routeur principal
        ├── App.css               # Styles globaux
        ├── services/
        │   └── api.js            # Appels vers le backend
        ├── components/
        │   ├── Navbar.jsx
        │   ├── SearchBar.jsx     # Recherche avec filtres marché + autocomplétion
        │   ├── PriceChart.jsx    # Graphique Canvas
        │   └── ...
        └── pages/
            ├── Home.jsx          # Tableau actions par marché + cryptos + news
            ├── StockDetail.jsx   # Détail complet d'une action (5 onglets)
            ├── SuperDividendes.jsx # Super Dividendes PEA
            └── ...
```

## Le Crawler

Le crawler tourne en arrière-plan au démarrage du backend. Il collecte les dividendes de toutes les actions Euronext pour alimenter la page Super Dividendes.

**Budget API (FMP) :** 1000 appels/jour

| Poste | Appels | Fréquence |
|-------|--------|-----------|
| Screener Euronext | 1 | Au démarrage (récupère ~500 actions d'un coup) |
| Dividendes | ~300/jour | Par roulement, 10 actions toutes les 10 min |
| Navigation | ~700 | Tes clics, recherches, pages détail |

Les dividendes ne sont re-fetchés que s'ils datent de **plus de 30 jours**. Après la collecte initiale (~2 jours), le crawler est au repos.

**Monitoring :** `http://localhost:3001/api/health` affiche les stats du cache et du crawler.
`http://localhost:3001/api/dividendes/stats` affiche le nombre d'actions, dividendes et analyses en base.

## APIs utilisées

- **[Financial Modeling Prep](https://financialmodelingprep.com)** — Actions, dividendes, ratios, bilans (1000 appels/jour)
- **[CoinGecko](https://www.coingecko.com)** — Cryptomonnaies
- **[NewsAPI](https://newsapi.org)** — Actualités financières
