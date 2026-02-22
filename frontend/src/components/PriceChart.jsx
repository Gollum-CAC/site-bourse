// Composant graphique d'historique des prix (Canvas pur)
import { useRef, useEffect } from 'react';

function PriceChart({ data, period }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    drawChart();
  }, [data]);

  function drawChart() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Dimensions responsive
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = 300;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Marges
    const margin = { top: 20, right: 20, bottom: 30, left: 70 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Trier par date croissante
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const prices = sorted.map(d => d.close || d.adjClose || 0);
    const dates = sorted.map(d => d.date);

    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    // Fond
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);

    // Couleur basée sur la tendance
    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // Grille horizontale
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = margin.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();

      // Labels prix
      const price = maxPrice - (priceRange / gridLines) * i;
      ctx.fillStyle = '#6e7681';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2) + ' $', margin.left - 8, y + 4);
    }

    // Labels dates
    ctx.fillStyle = '#6e7681';
    ctx.textAlign = 'center';
    ctx.font = '11px -apple-system, sans-serif';
    const dateStep = Math.max(1, Math.floor(dates.length / 6));
    for (let i = 0; i < dates.length; i += dateStep) {
      const x = margin.left + (i / (dates.length - 1)) * chartW;
      const d = new Date(dates[i]);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      ctx.fillText(label, x, height - 8);
    }

    // Courbe de prix
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < prices.length; i++) {
      const x = margin.left + (i / (prices.length - 1)) * chartW;
      const y = margin.top + chartH - ((prices[i] - minPrice) / priceRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Remplissage sous la courbe
    const lastX = margin.left + chartW;
    const baseY = margin.top + chartH;
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(margin.left, baseY);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Prix actuel (dernier point)
    const lastPrice = prices[prices.length - 1];
    const lastY = margin.top + chartH - ((lastPrice - minPrice) / priceRange) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Redessiner au resize
  useEffect(() => {
    const handleResize = () => { if (data?.length) drawChart(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  if (!data || data.length === 0) {
    return <p className="loading">Chargement du graphique...</p>;
  }

  return (
    <div className="price-chart-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default PriceChart;
