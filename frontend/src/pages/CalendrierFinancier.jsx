// Financial Calendar — Upcoming dividends and earnings
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDividendCalendar, getEarningsCalendar } from '../services/api';

function getBoundsOfMonth(year, month) {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0);
  return {
    from: start.toISOString().split('T')[0],
    to:   end.toISOString().split('T')[0],
  };
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days = [];
  const prevMonth = new Date(year, month, 0);
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), current: false });
  }
  for (let j = 1; j <= lastDay.getDate(); j++) {
    days.push({ date: new Date(year, month, j), current: true });
  }
  while (days.length < 42) {
    const last = days[days.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    days.push({ date: next, current: false });
  }
  return days;
}

function toKey(date) {
  return date.toISOString().split('T')[0];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MIN_AMOUNT = 0.01;

function CalendrierFinancier() {
  const navigate = useNavigate();
  const today    = new Date();

  const [year, setYear]                     = useState(today.getFullYear());
  const [month, setMonth]                   = useState(today.getMonth());
  const [typeFilter, setTypeFilter]         = useState('all');
  const [watchlistFilter, setWatchlistFilter] = useState(false);
  const [watchlist, setWatchlist]           = useState([]);
  const [events, setEvents]                 = useState({});
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [selectedDay, setSelectedDay]       = useState(null);
  const [dayDetail, setDayDetail]           = useState([]);

  useEffect(() => {
    setWatchlist(JSON.parse(localStorage.getItem('watchlist') || '[]'));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setEvents({});
    setSelectedDay(null);

    const { from, to } = getBoundsOfMonth(year, month);

    try {
      const [divResult, earningsResult] = await Promise.allSettled([
        getDividendCalendar(from, to),
        getEarningsCalendar(from, to),
      ]);

      const map = {};

      if (divResult.status === 'fulfilled') {
        const divData = divResult.value;
        const divList = Array.isArray(divData) ? divData : (divData?.historical || divData?.dividendCalendar || []);
        divList.forEach(div => {
          const dateKey = div.date || div.exDate || div.ex_date;
          if (!dateKey || (div.dividend || div.amount || 0) < MIN_AMOUNT) return;
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            type: 'dividend', symbol: div.symbol, name: div.name || div.symbol,
            amount: div.dividend || div.adjDividend || div.amount || 0,
            paymentDate: div.paymentDate || div.payment_date || null,
            declarationDate: div.declarationDate || null,
          });
        });
      }

      if (earningsResult.status === 'fulfilled') {
        const earningsList = Array.isArray(earningsResult.value) ? earningsResult.value : [];
        earningsList.forEach(e => {
          const dateKey = e.date;
          if (!dateKey) return;
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            type: 'earnings', symbol: e.symbol, name: e.name || e.symbol,
            epsEstimate: e.epsEstimated || null,
            revenueEstimate: e.revenueEstimated || null,
            time: e.time || null,
          });
        });
      }

      setEvents(map);
      const total = Object.values(map).reduce((s, arr) => s + arr.length, 0);
      if (total === 0) setError("No events found for this month. The free FMP plan may limit calendar access.");
    } catch (err) {
      setError('Unable to load calendar. Make sure the backend is running.');
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function filterEvents(evts) {
    let result = evts;
    if (typeFilter !== 'all') result = result.filter(e => e.type === typeFilter);
    if (watchlistFilter && watchlist.length > 0) result = result.filter(e => watchlist.includes(e.symbol));
    return result;
  }

  function getDayEvents(dateKey) {
    return filterEvents(events[dateKey] || []);
  }

  function clickDay(day) {
    const key  = toKey(day.date);
    const evts = getDayEvents(key);
    if (evts.length === 0 && !day.current) return;
    setSelectedDay(key);
    setDayDetail(evts);
  }

  function getStats() {
    let nbDiv = 0, nbEarnings = 0, nbWl = 0;
    Object.values(events).forEach(evts => {
      evts.forEach(e => {
        if (e.type === 'dividend') nbDiv++;
        else if (e.type === 'earnings') nbEarnings++;
        if (watchlist.includes(e.symbol)) nbWl++;
      });
    });
    return { nbDiv, nbEarnings, nbWl };
  }

  function isToday(date) {
    return toKey(date) === toKey(today);
  }

  function fmtAmt(val) {
    if (!val) return 'N/A';
    const n = Number(val);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + ' B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(0) + ' M';
    return n.toLocaleString('en-US');
  }

  const grid            = buildMonthGrid(year, month);
  const stats           = getStats();
  const isCurrentMonth  = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="calendrier-page">

      <div className="cal-header">
        <div className="cal-title-block">
          <h1>📅 Financial Calendar</h1>
          <p className="page-subtitle">Upcoming dividends and earnings reports</p>
        </div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-mois-label">
            <span className="cal-mois-nom">{MONTHS[month]}</span>
            <span className="cal-mois-annee">{year}</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
          {!isCurrentMonth && (
            <button className="cal-today-btn" onClick={goToToday}>Today</button>
          )}
        </div>
      </div>

      <div className="cal-controls">
        <div className="cal-filtres">
          <span className="cal-filtres-label">Show:</span>
          <div className="cal-filtres-buttons">
            {[
              { key: 'all',      label: '📌 All' },
              { key: 'dividend', label: '💰 Dividends' },
              { key: 'earnings', label: '📊 Earnings' },
            ].map(f => (
              <button key={f.key} className={`cal-filtre-btn ${typeFilter === f.key ? 'active' : ''}`} onClick={() => setTypeFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <button
            className={`cal-wl-btn ${watchlistFilter ? 'active' : ''}`}
            onClick={() => setWatchlistFilter(v => !v)}
            title={watchlist.length === 0 ? 'Your watchlist is empty' : 'Filter by watchlist'}
          >
            ⭐ My watchlist {watchlistFilter && watchlist.length > 0 ? `(${watchlist.length})` : ''}
          </button>
        </div>
        <div className="cal-stats">
          <div className="cal-stat-pill green">💰 {stats.nbDiv} dividends</div>
          <div className="cal-stat-pill blue">📊 {stats.nbEarnings} earnings</div>
          {watchlist.length > 0 && <div className="cal-stat-pill gold">⭐ {stats.nbWl} in watchlist</div>}
        </div>
      </div>

      {loading && <div className="cal-loading">⏳ Loading calendar...</div>}
      {error && !loading && <div className="cal-info-message">ℹ️ {error}</div>}

      <div className="cal-layout">
        <div className="cal-grille-wrapper">
          <div className="cal-grille">
            {DAYS.map(d => <div key={d} className="cal-jour-header">{d}</div>)}

            {grid.map((day, idx) => {
              const key        = toKey(day.date);
              const evts       = getDayEvents(key);
              const isSelected = selectedDay === key;
              const hasEvts    = evts.length > 0;
              const isTdy      = isToday(day.date);

              return (
                <div
                  key={idx}
                  className={['cal-jour', !day.current ? 'cal-jour-hors-mois' : '', isSelected ? 'cal-jour-selectionne' : '', isTdy ? 'cal-jour-today' : '', hasEvts ? 'cal-jour-avec-evts' : ''].join(' ')}
                  onClick={() => clickDay(day)}
                >
                  <span className="cal-jour-num">{day.date.getDate()}</span>
                  {hasEvts && (
                    <div className="cal-evts-preview">
                      {(() => {
                        const divs = evts.filter(e => e.type === 'dividend');
                        const earn = evts.filter(e => e.type === 'earnings');
                        const wlEvts = evts.filter(e => watchlist.includes(e.symbol));
                        return (
                          <>
                            {divs.length > 0 && <span className="cal-evt-dot green" title={`${divs.length} dividend(s)`}>{divs.length > 1 ? divs.length : ''}</span>}
                            {earn.length > 0 && <span className="cal-evt-dot blue" title={`${earn.length} earnings`}>{earn.length > 1 ? earn.length : ''}</span>}
                            {wlEvts.length > 0 && <span className="cal-evt-dot gold" title={`${wlEvts.length} in watchlist`} />}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {hasEvts && evts.length <= 4 && (
                    <div className="cal-evts-labels">
                      {evts.slice(0, 3).map((e, i) => (
                        <span key={i} className={`cal-evt-label ${e.type === 'dividend' ? 'green' : 'blue'} ${watchlist.includes(e.symbol) ? 'wl' : ''}`}>
                          {e.symbol.length > 8 ? e.symbol.substring(0, 7) + '…' : e.symbol}
                        </span>
                      ))}
                      {evts.length > 3 && <span className="cal-evt-more">+{evts.length - 3}</span>}
                    </div>
                  )}
                  {hasEvts && evts.length > 4 && (
                    <div className="cal-evts-count">{evts.length} events</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div className="cal-detail-panel">
            <div className="cal-detail-header">
              <h3>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h3>
              <button className="cal-detail-close" onClick={() => setSelectedDay(null)}>✕</button>
            </div>

            {dayDetail.length === 0 ? (
              <p className="cal-detail-vide">No events on this day{watchlistFilter ? ' in your watchlist' : ''}.</p>
            ) : (
              <div className="cal-detail-liste">
                {['dividend', 'earnings'].map(type => {
                  const typeEvts = dayDetail.filter(e => e.type === type);
                  if (typeEvts.length === 0) return null;
                  return (
                    <div key={type} className="cal-detail-groupe">
                      <h4 className={`cal-detail-groupe-titre ${type === 'dividend' ? 'green' : 'blue'}`}>
                        {type === 'dividend' ? '💰 Dividends' : '📊 Earnings'}
                      </h4>
                      {typeEvts.map((evt, i) => (
                        <div key={i} className={`cal-detail-evt ${watchlist.includes(evt.symbol) ? 'cal-detail-evt-wl' : ''}`} onClick={() => navigate(`/action/${evt.symbol}`)}>
                          <div className="cal-detail-evt-top">
                            <div className="cal-detail-evt-symbole">
                              <strong>{evt.symbol}</strong>
                              {watchlist.includes(evt.symbol) && <span className="wl-star">⭐</span>}
                            </div>
                            {type === 'dividend' && (
                              <span className="cal-detail-montant green">+{Number(evt.amount).toFixed(4)} €</span>
                            )}
                            {type === 'earnings' && evt.time && (
                              <span className={`cal-detail-heure ${evt.time === 'bmo' ? 'blue' : 'purple'}`}>
                                {evt.time === 'bmo' ? '🌅 Before open' : '🌆 After close'}
                              </span>
                            )}
                          </div>
                          <div className="cal-detail-evt-nom">{evt.name}</div>
                          {type === 'dividend' && evt.paymentDate && (
                            <div className="cal-detail-info">
                              💳 Payment: {new Date(evt.paymentDate + 'T12:00:00').toLocaleDateString('en-US')}
                            </div>
                          )}
                          {type === 'earnings' && (
                            <div className="cal-detail-earnings-detail">
                              {evt.epsEstimate != null && <span className="cal-detail-info">Est. EPS: {Number(evt.epsEstimate).toFixed(2)}</span>}
                              {evt.revenueEstimate != null && <span className="cal-detail-info">Est. Revenue: {fmtAmt(evt.revenueEstimate)}</span>}
                            </div>
                          )}
                          <div className="cal-detail-lien">View profile →</div>
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

      <div className="cal-legende">
        <span className="legende-item"><span className="cal-evt-dot green" /> Dividend (ex-div date)</span>
        <span className="legende-item"><span className="cal-evt-dot blue" /> Earnings report</span>
        <span className="legende-item"><span className="cal-evt-dot gold" /> In my watchlist</span>
        <span className="legende-info">Click on a day to see details • Click on a stock for its profile</span>
      </div>
    </div>
  );
}

export default CalendrierFinancier;
