// Page Calendrier Financier — Dividendes et Earnings à venir
// Vue mensuelle interactive avec navigation mois par mois
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDividendCalendar, getEarningsCalendar } from '../services/api';

// === UTILITAIRES DE DATE ===

// Retourne le premier et dernier jour d'un mois donné (format YYYY-MM-DD)
function getBornesMois(annee, mois) {
  const debut = new Date(annee, mois, 1);
  const fin = new Date(annee, mois + 1, 0);
  return {
    from: debut.toISOString().split('T')[0],
    to: fin.toISOString().split('T')[0],
  };
}

// Retourne tous les jours d'un mois, calés sur la grille (lundi = 0)
function construireGrilleMois(annee, mois) {
  const premierJour = new Date(annee, mois, 1);
  const dernierJour = new Date(annee, mois + 1, 0);

  // Décalage : lundi = 0, dimanche = 6 (ISO)
  let debutDecalage = premierJour.getDay() - 1;
  if (debutDecalage < 0) debutDecalage = 6;

  const jours = [];

  // Jours du mois précédent (cases grises)
  const moisPrec = new Date(annee, mois, 0);
  for (let i = debutDecalage - 1; i >= 0; i--) {
    jours.push({
      date: new Date(annee, mois - 1, moisPrec.getDate() - i),
      courant: false,
    });
  }

  // Jours du mois courant
  for (let j = 1; j <= dernierJour.getDate(); j++) {
    jours.push({ date: new Date(annee, mois, j), courant: true });
  }

  // Compléter jusqu'à 42 cases (6 semaines)
  while (jours.length < 42) {
    const last = jours[jours.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    jours.push({ date: next, courant: false });
  }

  return jours;
}

// Formater une date en YYYY-MM-DD
function toKey(date) {
  return date.toISOString().split('T')[0];
}

// Noms des mois en français
const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const JOURS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Seuil de rendement minimum pour filtrer les dividendes peu significatifs
const MIN_AMOUNT = 0.01;

// === COMPOSANT PRINCIPAL ===
function CalendrierFinancier() {
  const navigate = useNavigate();
  const today = new Date();

  const [annee, setAnnee] = useState(today.getFullYear());
  const [mois, setMois] = useState(today.getMonth());
  const [filtreType, setFiltreType] = useState('tous'); // 'tous' | 'dividendes' | 'earnings'
  const [filtreWatchlist, setFiltreWatchlist] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [evenements, setEvenements] = useState({}); // { 'YYYY-MM-DD': [événements] }
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [jourSelectionne, setJourSelectionne] = useState(null); // date sélectionnée
  const [detailJour, setDetailJour] = useState([]); // événements du jour sélectionné

  // Charger la watchlist depuis le localStorage
  useEffect(() => {
    const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setWatchlist(wl);
  }, []);

  // Charger les données quand le mois change
  const chargerDonnees = useCallback(async () => {
    setLoading(true);
    setErreur('');
    setEvenements({});
    setJourSelectionne(null);

    const { from, to } = getBornesMois(annee, mois);

    try {
      // Charger dividendes et earnings en parallèle
      const [divResult, earningsResult] = await Promise.allSettled([
        getDividendCalendar(from, to),
        getEarningsCalendar(from, to),
      ]);

      const map = {};

      // === TRAITEMENT DIVIDENDES ===
      if (divResult.status === 'fulfilled') {
        const divData = divResult.value;
        const divList = Array.isArray(divData) ? divData : (divData?.historical || divData?.dividendCalendar || []);

        divList.forEach(div => {
          // La date clé est la date ex-dividende (date à laquelle il faut posséder l'action)
          const dateKey = div.date || div.exDate || div.ex_date;
          if (!dateKey) return;
          if ((div.dividend || div.amount || 0) < MIN_AMOUNT) return;

          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            type: 'dividende',
            symbol: div.symbol,
            nom: div.name || div.symbol,
            montant: div.dividend || div.adjDividend || div.amount || 0,
            datePaiement: div.paymentDate || div.payment_date || null,
            dateDeclaration: div.declarationDate || null,
          });
        });
      }

      // === TRAITEMENT EARNINGS ===
      if (earningsResult.status === 'fulfilled') {
        const earningsData = earningsResult.value;
        const earningsList = Array.isArray(earningsData) ? earningsData : [];

        earningsList.forEach(earning => {
          const dateKey = earning.date;
          if (!dateKey) return;

          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            type: 'earnings',
            symbol: earning.symbol,
            nom: earning.name || earning.symbol,
            epsEstime: earning.epsEstimated || null,
            revenusEstimes: earning.revenueEstimated || null,
            heure: earning.time || null, // 'bmo' (avant ouverture) ou 'amc' (après clôture)
          });
        });
      }

      setEvenements(map);

      // Si aucune donnée : message d'info
      const total = Object.values(map).reduce((s, arr) => s + arr.length, 0);
      if (total === 0) {
        setErreur('Aucun événement trouvé pour ce mois. Le plan FMP gratuit peut limiter l\'accès au calendrier.');
      }
    } catch (err) {
      console.error('[Calendrier] Erreur chargement:', err);
      setErreur('Impossible de charger le calendrier. Vérifiez que le backend est démarré.');
    }

    setLoading(false);
  }, [annee, mois]);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  // === NAVIGATION MOIS ===
  function moisPrecedent() {
    if (mois === 0) { setMois(11); setAnnee(a => a - 1); }
    else setMois(m => m - 1);
  }

  function moisSuivant() {
    if (mois === 11) { setMois(0); setAnnee(a => a + 1); }
    else setMois(m => m + 1);
  }

  function allerAujourdhui() {
    setAnnee(today.getFullYear());
    setMois(today.getMonth());
  }

  // === FILTRAGE DES ÉVÉNEMENTS ===
  function filtrerEvenements(evts) {
    let result = evts;

    // Filtre par type
    if (filtreType !== 'tous') {
      result = result.filter(e => e.type === filtreType);
    }

    // Filtre watchlist
    if (filtreWatchlist && watchlist.length > 0) {
      result = result.filter(e => watchlist.includes(e.symbol));
    }

    return result;
  }

  // Retourne les événements filtrés d'un jour
  function getEvtsJour(dateKey) {
    return filtrerEvenements(evenements[dateKey] || []);
  }

  // Clic sur un jour
  function clicJour(jour) {
    const key = toKey(jour.date);
    const evts = getEvtsJour(key);
    if (evts.length === 0 && !jour.courant) return;
    setJourSelectionne(key);
    setDetailJour(evts);
  }

  // === STATISTIQUES DU MOIS ===
  function getStats() {
    let nbDiv = 0, nbEarnings = 0, nbWl = 0;
    Object.values(evenements).forEach(evts => {
      evts.forEach(e => {
        if (e.type === 'dividende') nbDiv++;
        else if (e.type === 'earnings') nbEarnings++;
        if (watchlist.includes(e.symbol)) nbWl++;
      });
    });
    return { nbDiv, nbEarnings, nbWl };
  }

  // Vérifier si un jour est aujourd'hui
  function estAujourdhui(date) {
    return toKey(date) === toKey(today);
  }

  // Couleur du badge selon type
  function couleurBadge(type) {
    return type === 'dividende' ? '#22c55e' : '#3b82f6';
  }

  // Formater les montants
  function fmtAmt(val) {
    if (!val) return 'N/A';
    const n = Number(val);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + ' Mds';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(0) + ' M';
    return n.toLocaleString('fr-FR');
  }

  const grille = construireGrilleMois(annee, mois);
  const stats = getStats();
  const isMoisCourant = annee === today.getFullYear() && mois === today.getMonth();

  return (
    <div className="calendrier-page">

      {/* === EN-TÊTE === */}
      <div className="cal-header">
        <div className="cal-title-block">
          <h1>📅 Calendrier Financier</h1>
          <p className="page-subtitle">Dividendes et résultats d'entreprises à venir</p>
        </div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={moisPrecedent}>‹</button>
          <div className="cal-mois-label">
            <span className="cal-mois-nom">{MOIS_FR[mois]}</span>
            <span className="cal-mois-annee">{annee}</span>
          </div>
          <button className="cal-nav-btn" onClick={moisSuivant}>›</button>
          {!isMoisCourant && (
            <button className="cal-today-btn" onClick={allerAujourdhui}>Aujourd'hui</button>
          )}
        </div>
      </div>

      {/* === FILTRES ET STATS === */}
      <div className="cal-controls">
        <div className="cal-filtres">
          <span className="cal-filtres-label">Afficher :</span>
          <div className="cal-filtres-buttons">
            {[
              { key: 'tous', label: '📌 Tout' },
              { key: 'dividende', label: '💰 Dividendes' },
              { key: 'earnings', label: '📊 Earnings' },
            ].map(f => (
              <button
                key={f.key}
                className={`cal-filtre-btn ${filtreType === f.key ? 'active' : ''}`}
                onClick={() => setFiltreType(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            className={`cal-wl-btn ${filtreWatchlist ? 'active' : ''}`}
            onClick={() => setFiltreWatchlist(v => !v)}
            title={watchlist.length === 0 ? 'Votre watchlist est vide' : 'Filtrer par watchlist'}
          >
            ⭐ Ma watchlist {filtreWatchlist && watchlist.length > 0 ? `(${watchlist.length})` : ''}
          </button>
        </div>

        <div className="cal-stats">
          <div className="cal-stat-pill green">💰 {stats.nbDiv} dividendes</div>
          <div className="cal-stat-pill blue">📊 {stats.nbEarnings} résultats</div>
          {watchlist.length > 0 && <div className="cal-stat-pill gold">⭐ {stats.nbWl} dans ma watchlist</div>}
        </div>
      </div>

      {loading && <div className="cal-loading">⏳ Chargement du calendrier...</div>}
      {erreur && !loading && <div className="cal-info-message">ℹ️ {erreur}</div>}

      <div className="cal-layout">
        {/* === GRILLE CALENDRIER === */}
        <div className="cal-grille-wrapper">
          {/* En-têtes jours */}
          <div className="cal-grille">
            {JOURS_FR.map(j => (
              <div key={j} className="cal-jour-header">{j}</div>
            ))}

            {/* Cases jours */}
            {grille.map((jour, idx) => {
              const key = toKey(jour.date);
              const evts = getEvtsJour(key);
              const estSelectionne = jourSelectionne === key;
              const aEvts = evts.length > 0;
              const estAjd = estAujourdhui(jour.date);

              return (
                <div
                  key={idx}
                  className={[
                    'cal-jour',
                    !jour.courant ? 'cal-jour-hors-mois' : '',
                    estSelectionne ? 'cal-jour-selectionne' : '',
                    estAjd ? 'cal-jour-today' : '',
                    aEvts ? 'cal-jour-avec-evts' : '',
                  ].join(' ')}
                  onClick={() => clicJour(jour)}
                >
                  <span className="cal-jour-num">{jour.date.getDate()}</span>

                  {/* Points d'événements */}
                  {aEvts && (
                    <div className="cal-evts-preview">
                      {/* Regrouper par type et afficher les badges */}
                      {(() => {
                        const divs = evts.filter(e => e.type === 'dividende');
                        const earn = evts.filter(e => e.type === 'earnings');
                        const wlEvts = evts.filter(e => watchlist.includes(e.symbol));
                        return (
                          <>
                            {divs.length > 0 && (
                              <span className="cal-evt-dot green" title={`${divs.length} dividende(s)`}>
                                {divs.length > 1 ? divs.length : ''}
                              </span>
                            )}
                            {earn.length > 0 && (
                              <span className="cal-evt-dot blue" title={`${earn.length} résultat(s)`}>
                                {earn.length > 1 ? earn.length : ''}
                              </span>
                            )}
                            {wlEvts.length > 0 && (
                              <span className="cal-evt-dot gold" title={`${wlEvts.length} dans ma watchlist`} />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Liste compacte des symboles (jusqu'à 3) */}
                  {aEvts && evts.length <= 4 && (
                    <div className="cal-evts-labels">
                      {evts.slice(0, 3).map((e, i) => (
                        <span
                          key={i}
                          className={`cal-evt-label ${e.type === 'dividende' ? 'green' : 'blue'} ${watchlist.includes(e.symbol) ? 'wl' : ''}`}
                        >
                          {e.symbol.length > 8 ? e.symbol.substring(0, 7) + '…' : e.symbol}
                        </span>
                      ))}
                      {evts.length > 3 && (
                        <span className="cal-evt-more">+{evts.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Si beaucoup d'événements : afficher un compteur */}
                  {aEvts && evts.length > 4 && (
                    <div className="cal-evts-count">
                      {evts.length} événements
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* === PANNEAU DÉTAIL JOUR === */}
        {jourSelectionne && (
          <div className="cal-detail-panel">
            <div className="cal-detail-header">
              <h3>
                {new Date(jourSelectionne + 'T12:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h3>
              <button className="cal-detail-close" onClick={() => setJourSelectionne(null)}>✕</button>
            </div>

            {detailJour.length === 0 ? (
              <p className="cal-detail-vide">Aucun événement ce jour{filtreWatchlist ? ' dans votre watchlist' : ''}.</p>
            ) : (
              <div className="cal-detail-liste">
                {/* Séparation dividendes / earnings */}
                {['dividende', 'earnings'].map(type => {
                  const evtsType = detailJour.filter(e => e.type === type);
                  if (evtsType.length === 0) return null;
                  return (
                    <div key={type} className="cal-detail-groupe">
                      <h4 className={`cal-detail-groupe-titre ${type === 'dividende' ? 'green' : 'blue'}`}>
                        {type === 'dividende' ? '💰 Dividendes' : '📊 Résultats (Earnings)'}
                      </h4>
                      {evtsType.map((evt, i) => (
                        <div
                          key={i}
                          className={`cal-detail-evt ${watchlist.includes(evt.symbol) ? 'cal-detail-evt-wl' : ''}`}
                          onClick={() => navigate(`/action/${evt.symbol}`)}
                        >
                          <div className="cal-detail-evt-top">
                            <div className="cal-detail-evt-symbole">
                              <strong>{evt.symbol}</strong>
                              {watchlist.includes(evt.symbol) && <span className="wl-star">⭐</span>}
                            </div>
                            {type === 'dividende' && (
                              <span className="cal-detail-montant green">
                                +{Number(evt.montant).toFixed(4)} €
                              </span>
                            )}
                            {type === 'earnings' && evt.heure && (
                              <span className={`cal-detail-heure ${evt.heure === 'bmo' ? 'blue' : 'purple'}`}>
                                {evt.heure === 'bmo' ? '🌅 Avant ouverture' : '🌆 Après clôture'}
                              </span>
                            )}
                          </div>
                          <div className="cal-detail-evt-nom">{evt.nom}</div>
                          {type === 'dividende' && evt.datePaiement && (
                            <div className="cal-detail-info">
                              💳 Paiement : {new Date(evt.datePaiement + 'T12:00:00').toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          {type === 'earnings' && (
                            <div className="cal-detail-earnings-detail">
                              {evt.epsEstime != null && (
                                <span className="cal-detail-info">EPS estimé : {Number(evt.epsEstime).toFixed(2)} €</span>
                              )}
                              {evt.revenusEstimes != null && (
                                <span className="cal-detail-info">CA estimé : {fmtAmt(evt.revenusEstimes)} €</span>
                              )}
                            </div>
                          )}
                          <div className="cal-detail-lien">Voir le profil →</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === LÉGENDE === */}
      <div className="cal-legende">
        <span className="legende-item"><span className="cal-evt-dot green" /> Dividende (date ex-div)</span>
        <span className="legende-item"><span className="cal-evt-dot blue" /> Résultats trimestriels</span>
        <span className="legende-item"><span className="cal-evt-dot gold" /> Dans ma watchlist</span>
        <span className="legende-info">Cliquez sur un jour pour voir le détail • Cliquez sur une action pour son profil</span>
      </div>
    </div>
  );
}

export default CalendrierFinancier;
