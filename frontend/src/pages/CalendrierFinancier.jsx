// Financial Calendar — Dividendes uniquement (plan FMP gratuit)
// Earnings supprimés : endpoint premium non disponible
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDividendCalendar } from '../services/api';

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
  for (let i = startOffset - 1; i >= 0; i--)
    days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), current: false });
  for (let j = 1; j <= lastDay.getDate(); j++)
    days.push({ date: new Date(year, month, j), current: true });
  while (days.length < 42) {
    const next = new Date(days[days.length - 1].date);
    next.setDate(next.getDate() + 1);
    days.push({ date: next, current: false });
  }
  return days;
}

function toKey(date) { return date.toISOString().split('T')[0]; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MIN_AMOUNT = 0.01;

function CalendrierFinancier() {
  const navigate = useNavigate();
  const today    = new Date();

  const [year, setYear]                       = useState(today.getFullYear());
  const [month, setMonth]                     = useState(today.getMonth());
  const [watchlistFilter, setWatchlistFilter] = useState(false);
  const [watchlist, setWatchlist]             = useState([]);
  const [events, setEvents]                   = useState({});
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [selectedDay, setSelectedDay]         = useState(null);
  const [dayDetail, setDayDetail]             = useState([]);

  useEffect(() => {
    setWatchlist(JSON.parse(localStorage.getItem('watchlist') || '[]'));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(''); setEvents({}); setSelectedDay(null);
    const { from, to } = getBoundsOfMonth(year, month);
    try {
      const divData = await getDividendCalendar(from, to);
      const divList = Array.isArray(divData) ? divData : (divData?.historical || divData?.dividendCalendar || []);
      const map = {};
      divList.forEach(div => {
        const dateKey = div.date || div.exDate || div.ex_date;
        if (!dateKey || (div.dividend || div.amount || 0) < MIN_AMOUNT) return;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push({
          type: 'dividend', symbol: div.symbol, name: div.name || div.symbol,
          amount: div.dividend || div.adjDividend || div.amount || 0,
          paymentDate: div.paymentDate || div.payment_date || null,
        });
      });
      setEvents(map);
      const total = Object.values(map).reduce((s, arr) => s + arr.length, 0);
      if (total === 0) setError('No dividend events found for this month.');
    } catch {
      setError('Unable to load calendar. Make sure the backend is running.');
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); }
  function goToToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); }

  function getDayEvents(dateKey) {
    let evts = events[dateKey] || [];
    if (watchlistFilter && watchlist.length > 0) evts = evts.filter(e => watchlist.includes(e.symbol));
    return evts;
  }

  function getStats() {
    let nbDiv = 0, nbWl = 0;
    Object.values(events).forEach(evts =>
      evts.forEach(e => { nbDiv++; if (watchlist.includes(e.symbol)) nbWl++; })
    );
    return { nbDiv, nbWl };
  }

  function clickDay(day) {
    const key  = toKey(day.date);
    const evts = getDayEvents(key);
    if (evts.length === 0 && !day.current) return;
    setSelectedDay(key); setDayDetail(evts);
  }

  function isToday(date) { return toKey(date) === toKey(today); }

  const grid           = buildMonthGrid(year, month);
  const stats          = getStats();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="calendrier-page">

      <div className="cal-header">
        <div className="cal-title-block">
          <h1>📅 Dividend Calendar</h1>
          <p className="page-subtitle">Upcoming ex-dividend dates — global coverage (FMP free plan)</p>
        </div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-mois-label">
            <span className="cal-mois-nom">{MONTHS[month]}</span>
            <span className="cal-mois-annee">{year}</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
          {!isCurrentMonth && <button className="cal-today-btn" onClick={goToToday}>Today</button>}
        </div>
      </div>

      <div className="cal-controls">
        <div className="cal-filtres">
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
                <div key={idx} onClick={() => clickDay(day)}
                  className={['cal-jour', !day.current?'cal-jour-hors-mois':'', isSelected?'cal-jour-selectionne':'', isTdy?'cal-jour-today':'', hasEvts?'cal-jour-avec-evts':''].join(' ')}>
                  <span className="cal-jour-num">{day.date.getDate()}</span>
                  {hasEvts && (
                    <div className="cal-evts-preview">
                      <span className="cal-evt-dot green" title={`${evts.length} dividend(s)`}>{evts.length > 1 ? evts.length : ''}</span>
                      {evts.some(e => watchlist.includes(e.symbol)) && <span className="cal-evt-dot gold" />}
                    </div>
                  )}
                  {hasEvts && evts.length <= 4 && (
                    <div className="cal-evts-labels">
                      {evts.slice(0, 3).map((e, i) => (
                        <span key={i} className={`cal-evt-label green ${watchlist.includes(e.symbol) ? 'wl' : ''}`}>
                          {e.symbol.length > 8 ? e.symbol.substring(0,7)+'…' : e.symbol}
                        </span>
                      ))}
                      {evts.length > 3 && <span className="cal-evt-more">+{evts.length - 3}</span>}
                    </div>
                  )}
                  {hasEvts && evts.length > 4 && <div className="cal-evts-count">{evts.length} divs</div>}
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div className="cal-detail-panel">
            <div className="cal-detail-header">
              <h3>{new Date(selectedDay+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'})}</h3>
              <button className="cal-detail-close" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            {dayDetail.length === 0 ? (
              <p className="cal-detail-vide">No dividends on this day{watchlistFilter?' in your watchlist':''}.</p>
            ) : (
              <div className="cal-detail-liste">
                <h4 className="cal-detail-groupe-titre green">💰 Ex-dividend date</h4>
                {dayDetail.map((evt, i) => (
                  <div key={i} className={`cal-detail-evt ${watchlist.includes(evt.symbol)?'cal-detail-evt-wl':''}`}
                    onClick={() => navigate(`/action/${evt.symbol}`)}>
                    <div className="cal-detail-evt-top">
                      <div className="cal-detail-evt-symbole">
                        <strong>{evt.symbol}</strong>
                        {watchlist.includes(evt.symbol) && <span className="wl-star">⭐</span>}
                      </div>
                      <span className="cal-detail-montant green">${Number(evt.amount).toFixed(4)}</span>
                    </div>
                    <div className="cal-detail-evt-nom">{evt.name}</div>
                    {evt.paymentDate && (
                      <div className="cal-detail-info">
                        💳 Payment: {new Date(evt.paymentDate+'T12:00:00').toLocaleDateString('en-US')}
                      </div>
                    )}
                    <div className="cal-detail-lien">View profile →</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cal-legende">
        <span className="legende-item"><span className="cal-evt-dot green" /> Ex-dividend date</span>
        <span className="legende-item"><span className="cal-evt-dot gold" /> In my watchlist</span>
        <span className="legende-info">Click a day for details · Click a stock for its profile</span>
      </div>
    </div>
  );
}

export default CalendrierFinancier;
