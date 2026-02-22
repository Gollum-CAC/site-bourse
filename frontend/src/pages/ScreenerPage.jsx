// Page Screener Avancé — Filtrage multi-critères d'actions
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

// === CONFIGURATION DES FILTRES ===

const EXCHANGES = [
  { value: '', label: '🌍 Tous les marchés' },
  { value: 'EURONEXT', label: '🇪🇺 Euronext (Paris, Amsterdam, Bruxelles...)' },
  { value: 'NASDAQ', label: '🇺🇸 NASDAQ' },
  { value: 'NYSE', label: '🇺🇸 NYSE' },
  { value: 'TSE', label: '🇯🇵 Tokyo (TSE)' },
  { value: 'HKSE', label: '🇭🇰 Hong Kong (HKSE)' },
];

const PAYS = [
  { value: '', label: 'Tous les pays' },
  { value: 'FR', label: '🇫🇷 France' },
  { value: 'NL', label: '🇳🇱 Pays-Bas' },
  { value: 'BE', label: '🇧🇪 Belgique' },
  { value: 'DE', label: '🇩🇪 Allemagne' },
  { value: 'IT', label: '🇮🇹 Italie' },
  { value: 'ES', label: '🇪🇸 Espagne' },
  { value: 'GB', label: '🇬🇧 Royaume-Uni' },
  { value: 'US', label: '🇺🇸 États-Unis' },
  { value: 'JP', label: '🇯🇵 Japon' },
  { value: 'HK', label: '🇭🇰 Hong Kong' },
];

const CAP_BOURSIERE = [
  { value: '', label: 'Toutes tailles' },
  { value: 'mega', label: '> 200 Mds (Mega Cap)', min: '200000000000', max: '' },
  { value: 'large', label: '10 Mds – 200 Mds (Large Cap)', min: '10000000000', max: '200000000000' },
  { value: 'mid', label: '1 Mds – 10 Mds (Mid Cap)', min: '1000000000', max: '10000000000' },
  { value: 'small', label: '200 M – 1 Mds (Small Cap)', min: '200000000', max: '1000000000' },
  { value: 'micro', label: '< 200 M (Micro Cap)', min: '', max: '200000000' },
];

const TRIS = [
  { value: 'marketCap', label: 'Capitalisation' },
  { value: 'dividendYield', label: 'Rendement dividende' },
  { value: 'price', label: 'Prix' },
  { value: 'pe', label: 'P/E Ratio' },
  { value: 'changePercent', label: 'Variation (%)' },
  { value: 'score', label: 'Score composite' },
];

// === COMPOSANT PRINCIPAL ===
function ScreenerPage() {
  const navigate = useNavigate();

  // État des filtres
  const [filtres, setFiltres] = useState({
    exchange: '',
    sector: '',
    country: '',
    capBoursiere: '',        // clé de sélection (mega, large, mid, small, micro)
    marketCapMin: '',
    marketCapMax: '',
    peMin: '',
    peMax: '',
    dividendYieldMin: '',
    priceMin: '',
    priceMax: '',
    sortBy: 'marketCap',
    sortDir: 'desc',
    limit: '50',
  });

  // État des résultats
  const [resultats, setResultats] = useState([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [secteurs, setSecteurs] = useState([]);
  const [presets, setPresets] = useState([]);
  const [presetActif, setPresetActif] = useState('');
  const [panneauOuvert, setPanneauOuvert] = useState(true);

  // Watchlist pour les badges
  const [watchlist, setWatchlist] = useState([]);

  // Charger secteurs + presets au montage
  useEffect(() => {
    chargerSecteurs();
    chargerPresets();
    const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setWatchlist(wl);
  }, []);

  async function chargerSecteurs() {
    try {
      const res = await fetch(`${API_BASE}/screener/secteurs`);
      const data = await res.json();
      setSecteurs(data.secteurs || []);
    } catch { /* silencieux */ }
  }

  async function chargerPresets() {
    try {
      const res = await fetch(`${API_BASE}/screener/presets`);
      const data = await res.json();
      setPresets(data.presets || []);
    } catch { /* silencieux */ }
  }

  // Appliquer un preset
  function appliquerPreset(preset) {
    setPresetActif(preset.id);
    const capKey = Object.keys(filtres).includes('capBoursiere') ? 'capBoursiere' : '';
    setFiltres(prev => ({
      ...prev,
      exchange: '',
      sector: '',
      country: '',
      capBoursiere: '',
      marketCapMin: '',
      marketCapMax: '',
      peMin: '',
      peMax: '',
      dividendYieldMin: '',
      priceMin: '',
      priceMax: '',
      sortBy: 'marketCap',
      sortDir: 'desc',
      limit: '50',
      ...preset.params,
    }));
  }

  // Lancer la recherche
  const lancerRecherche = useCallback(async () => {
    setLoading(true);
    setErreur('');
    setResultats([]);

    // Construire les paramètres de requête
    const params = new URLSearchParams();
    if (filtres.exchange) params.set('exchange', filtres.exchange);
    if (filtres.sector) params.set('sector', filtres.sector);
    if (filtres.country) params.set('country', filtres.country);
    if (filtres.dividendYieldMin) params.set('dividendYieldMin', filtres.dividendYieldMin);
    if (filtres.peMin) params.set('peMin', filtres.peMin);
    if (filtres.peMax) params.set('peMax', filtres.peMax);
    if (filtres.priceMin) params.set('priceMin', filtres.priceMin);
    if (filtres.priceMax) params.set('priceMax', filtres.priceMax);
    params.set('sortBy', filtres.sortBy);
    params.set('sortDir', filtres.sortDir);
    params.set('limit', filtres.limit);

    // Résoudre la capitalisation boursière
    const cap = CAP_BOURSIERE.find(c => c.value === filtres.capBoursiere);
    const capMin = cap?.min || filtres.marketCapMin;
    const capMax = cap?.max || filtres.marketCapMax;
    if (capMin) params.set('marketCapMin', capMin);
    if (capMax) params.set('marketCapMax', capMax);

    try {
      const res = await fetch(`${API_BASE}/screener?${params}`);
      if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
      const data = await res.json();
      setResultats(data.stocks || []);
      setTotal(data.total || 0);
      setSource(data.source || '');
      setNote(data.note || '');
      // Fermer le panneau sur mobile après recherche
      if (window.innerWidth < 900) setPanneauOuvert(false);
    } catch (err) {
      console.error('[Screener]', err);
      setErreur('Impossible de récupérer les résultats. Vérifiez que le backend est démarré.');
    }
    setLoading(false);
  }, [filtres]);

  // Mise à jour d'un filtre
  function setFiltre(key, value) {
    setPresetActif(''); // Désactiver le preset si l'utilisateur modifie
    setFiltres(prev => ({ ...prev, [key]: value }));
  }

  // Remise à zéro
  function reinitialiser() {
    setPresetActif('');
    setFiltres({
      exchange: '', sector: '', country: '',
      capBoursiere: '', marketCapMin: '', marketCapMax: '',
      peMin: '', peMax: '', dividendYieldMin: '',
      priceMin: '', priceMax: '',
      sortBy: 'marketCap', sortDir: 'desc', limit: '50',
    });
    setResultats([]);
    setTotal(0);
    setErreur('');
  }

  // Formater capitalisation
  function fmtCap(val) {
    if (!val) return 'N/A';
    const n = Number(val);
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Mds';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M';
    return n.toLocaleString('fr-FR');
  }

  // Icône pays
  function drapeauPays(country) {
    const map = { FR: '🇫🇷', US: '🇺🇸', NL: '🇳🇱', BE: '🇧🇪', DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', HK: '🇭🇰', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', IE: '🇮🇪', CN: '🇨🇳' };
    return map[country] || '🌐';
  }

  // Devises
  function symboleDevise(currency) {
    const map = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', HKD: 'HK$' };
    return map[currency] || currency;
  }

  return (
    <div className="screener-page">

      {/* === EN-TÊTE === */}
      <div className="screener-header">
        <div>
          <h1>🔍 Screener d'Actions</h1>
          <p className="page-subtitle">Filtrez et trouvez des actions selon vos critères d'investissement</p>
        </div>
        <button
          className="screener-toggle-panel-btn"
          onClick={() => setPanneauOuvert(v => !v)}
        >
          {panneauOuvert ? '◀ Masquer les filtres' : '▶ Afficher les filtres'}
        </button>
      </div>

      {/* === PRESETS === */}
      <div className="screener-presets">
        <span className="screener-presets-label">Sélections rapides :</span>
        <div className="screener-presets-list">
          {presets.map(p => (
            <button
              key={p.id}
              className={`screener-preset-btn ${presetActif === p.id ? 'active' : ''}`}
              onClick={() => appliquerPreset(p)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="screener-layout">

        {/* === PANNEAU FILTRES === */}
        {panneauOuvert && (
          <div className="screener-filtres-panel">
            <div className="screener-filtres-header">
              <h3>⚙️ Filtres</h3>
              <button className="screener-reset-btn" onClick={reinitialiser}>↺ Réinitialiser</button>
            </div>

            {/* Marché */}
            <div className="filtre-groupe">
              <label className="filtre-label">📈 Marché / Exchange</label>
              <select
                className="filtre-select"
                value={filtres.exchange}
                onChange={e => setFiltre('exchange', e.target.value)}
              >
                {EXCHANGES.map(ex => (
                  <option key={ex.value} value={ex.value}>{ex.label}</option>
                ))}
              </select>
            </div>

            {/* Pays */}
            <div className="filtre-groupe">
              <label className="filtre-label">🌍 Pays</label>
              <select
                className="filtre-select"
                value={filtres.country}
                onChange={e => setFiltre('country', e.target.value)}
              >
                {PAYS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Secteur */}
            <div className="filtre-groupe">
              <label className="filtre-label">🏭 Secteur</label>
              <select
                className="filtre-select"
                value={filtres.sector}
                onChange={e => setFiltre('sector', e.target.value)}
              >
                <option value="">Tous les secteurs</option>
                {secteurs.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Capitalisation */}
            <div className="filtre-groupe">
              <label className="filtre-label">💼 Capitalisation boursière</label>
              <select
                className="filtre-select"
                value={filtres.capBoursiere}
                onChange={e => setFiltre('capBoursiere', e.target.value)}
              >
                {CAP_BOURSIERE.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {filtres.capBoursiere === '' && (
                <div className="filtre-range-custom">
                  <input
                    type="number" className="filtre-input" placeholder="Min (€)"
                    value={filtres.marketCapMin}
                    onChange={e => setFiltre('marketCapMin', e.target.value)}
                  />
                  <span className="filtre-range-sep">–</span>
                  <input
                    type="number" className="filtre-input" placeholder="Max (€)"
                    value={filtres.marketCapMax}
                    onChange={e => setFiltre('marketCapMax', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Dividende */}
            <div className="filtre-groupe">
              <label className="filtre-label">💰 Rendement dividende minimum (%)</label>
              <div className="filtre-range-custom">
                <input
                  type="number" className="filtre-input" placeholder="Ex : 5"
                  min="0" max="50" step="0.5"
                  value={filtres.dividendYieldMin}
                  onChange={e => setFiltre('dividendYieldMin', e.target.value)}
                />
                <span className="filtre-hint">%</span>
              </div>
              <div className="filtre-shortcuts">
                {[3, 5, 7, 10].map(v => (
                  <button key={v} className={`filtre-shortcut ${filtres.dividendYieldMin === String(v) ? 'active' : ''}`}
                    onClick={() => setFiltre('dividendYieldMin', filtres.dividendYieldMin === String(v) ? '' : String(v))}>
                    ≥ {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* P/E Ratio */}
            <div className="filtre-groupe">
              <label className="filtre-label">📊 P/E Ratio (Price/Earnings)</label>
              <div className="filtre-range-custom">
                <input
                  type="number" className="filtre-input" placeholder="Min"
                  value={filtres.peMin}
                  onChange={e => setFiltre('peMin', e.target.value)}
                />
                <span className="filtre-range-sep">–</span>
                <input
                  type="number" className="filtre-input" placeholder="Max"
                  value={filtres.peMax}
                  onChange={e => setFiltre('peMax', e.target.value)}
                />
              </div>
              <div className="filtre-shortcuts">
                <button className={`filtre-shortcut ${filtres.peMax === '15' && !filtres.peMin ? 'active' : ''}`}
                  onClick={() => { setFiltre('peMax', filtres.peMax === '15' ? '' : '15'); setFiltre('peMin', ''); }}>
                  Value &lt; 15
                </button>
                <button className={`filtre-shortcut ${filtres.peMin === '15' && filtres.peMax === '25' ? 'active' : ''}`}
                  onClick={() => { setFiltre('peMin', filtres.peMin === '15' ? '' : '15'); setFiltre('peMax', filtres.peMax === '25' ? '' : '25'); }}>
                  Équilibré 15-25
                </button>
              </div>
            </div>

            {/* Prix */}
            <div className="filtre-groupe">
              <label className="filtre-label">🏷️ Prix de l'action</label>
              <div className="filtre-range-custom">
                <input
                  type="number" className="filtre-input" placeholder="Min"
                  value={filtres.priceMin}
                  onChange={e => setFiltre('priceMin', e.target.value)}
                />
                <span className="filtre-range-sep">–</span>
                <input
                  type="number" className="filtre-input" placeholder="Max"
                  value={filtres.priceMax}
                  onChange={e => setFiltre('priceMax', e.target.value)}
                />
              </div>
            </div>

            {/* Tri */}
            <div className="filtre-groupe">
              <label className="filtre-label">↕️ Trier par</label>
              <div className="filtre-tri">
                <select
                  className="filtre-select"
                  value={filtres.sortBy}
                  onChange={e => setFiltre('sortBy', e.target.value)}
                >
                  {TRIS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button
                  className={`filtre-dir-btn ${filtres.sortDir === 'desc' ? 'active' : ''}`}
                  onClick={() => setFiltre('sortDir', filtres.sortDir === 'desc' ? 'asc' : 'desc')}
                  title={filtres.sortDir === 'desc' ? 'Décroissant' : 'Croissant'}
                >
                  {filtres.sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>

            {/* Nombre de résultats */}
            <div className="filtre-groupe">
              <label className="filtre-label">📋 Nombre de résultats</label>
              <select
                className="filtre-select"
                value={filtres.limit}
                onChange={e => setFiltre('limit', e.target.value)}
              >
                {['25', '50', '100', '150', '200', '250'].map(v => (
                  <option key={v} value={v}>{v} actions</option>
                ))}
              </select>
            </div>

            {/* Bouton recherche */}
            <button
              className="screener-search-btn"
              onClick={lancerRecherche}
              disabled={loading}
            >
              {loading ? '⏳ Recherche...' : '🔍 Lancer le screener'}
            </button>
          </div>
        )}

        {/* === ZONE RÉSULTATS === */}
        <div className="screener-resultats">

          {/* Barre de statut */}
          {(resultats.length > 0 || erreur || loading) && (
            <div className="screener-status-bar">
              {loading && <span className="screener-loading-txt">⏳ Chargement...</span>}
              {!loading && resultats.length > 0 && (
                <>
                  <span className="screener-count">
                    <strong>{resultats.length}</strong>
                    {total > resultats.length ? ` / ${total}` : ''} action{resultats.length > 1 ? 's' : ''}
                  </span>
                  <span className={`screener-source-badge ${source === 'database' ? 'green' : 'blue'}`}>
                    {source === 'database' ? '🗄️ Base locale' : '🌐 FMP API'}
                  </span>
                  {note && <span className="screener-note">{note}</span>}
                </>
              )}
              {erreur && <span className="screener-erreur">⚠️ {erreur}</span>}
            </div>
          )}

          {/* État vide — avant recherche */}
          {resultats.length === 0 && !loading && !erreur && (
            <div className="screener-vide">
              <div className="screener-vide-icone">🔍</div>
              <h3>Configurez vos filtres et lancez le screener</h3>
              <p>Utilisez les présélections rapides ou personnalisez les critères dans le panneau de gauche.</p>
              <div className="screener-vide-tips">
                <div className="screener-tip">💡 <strong>Euronext + dividende ≥ 7%</strong> pour les Super Dividendes PEA</div>
                <div className="screener-tip">💡 <strong>P/E &lt; 15</strong> pour trouver des actions décotées (value)</div>
                <div className="screener-tip">💡 <strong>Large Cap NASDAQ</strong> pour les géants tech US</div>
              </div>
            </div>
          )}

          {/* Tableau de résultats */}
          {resultats.length > 0 && (
            <div className="screener-table-wrapper">
              <table className="screener-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Secteur</th>
                    <th className="th-right">Prix</th>
                    <th className="th-right">Variation</th>
                    <th className="th-right">Cap. boursière</th>
                    <th className="th-right">P/E</th>
                    <th className="th-right">Dividende</th>
                    <th className="th-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.map((stock, i) => {
                    const isPos = stock.changePercent >= 0;
                    const estWl = watchlist.includes(stock.symbol);
                    const devise = symboleDevise(stock.currency);
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigate(`/action/${stock.symbol}`)}
                        className={`screener-row ${estWl ? 'screener-row-wl' : ''}`}
                      >
                        <td className="screener-td-num">{i + 1}</td>
                        <td className="screener-td-nom">
                          <div className="screener-symbole-block">
                            <div className="screener-symbole-top">
                              <strong>{stock.symbol}</strong>
                              {estWl && <span className="screener-wl-badge">⭐</span>}
                              <span className="screener-pays">{drapeauPays(stock.country)}</span>
                            </div>
                            <span className="screener-nom-complet">{stock.name}</span>
                          </div>
                        </td>
                        <td className="screener-td-secteur">
                          <span className="screener-secteur-tag">{stock.sector !== 'N/A' ? stock.sector : '—'}</span>
                        </td>
                        <td className="td-right">
                          {stock.price > 0 ? `${stock.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}` : 'N/A'}
                        </td>
                        <td className="td-right">
                          {stock.changePercent != null ? (
                            <span style={{ color: isPos ? '#22c55e' : '#ef4444' }}>
                              {isPos ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                            </span>
                          ) : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">{fmtCap(stock.marketCap)} {stock.marketCap > 0 ? devise : ''}</td>
                        <td className="td-right">
                          {stock.pe != null ? (
                            <span className={`screener-pe ${stock.pe < 15 ? 'green' : stock.pe > 30 ? 'red' : ''}`}>
                              {stock.pe.toFixed(1)}
                            </span>
                          ) : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">
                          {stock.dividendYield != null && stock.dividendYield > 0 ? (
                            <span className={`screener-yield ${stock.dividendYield >= 7 ? 'high' : stock.dividendYield >= 4 ? 'mid' : ''}`}>
                              {stock.dividendYield.toFixed(2)}%
                            </span>
                          ) : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">
                          {stock.score != null ? (
                            <span className={`screener-score ${stock.score >= 70 ? 'green' : stock.score >= 50 ? 'yellow' : 'red'}`}>
                              {stock.score}
                            </span>
                          ) : <span className="nd">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScreenerPage;
