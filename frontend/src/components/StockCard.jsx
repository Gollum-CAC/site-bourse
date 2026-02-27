// Stock card component showing quote data
function StockCard({ stock }) {
  if (!stock) return null;

  const isPositive = stock.change >= 0;
  const changeColor = isPositive ? '#22c55e' : '#ef4444';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <div className="stock-card">
      <div className="stock-header">
        <h3>{stock.symbol}</h3>
        <span className="stock-name">{stock.name}</span>
      </div>
      <div className="stock-price">
        <span className="price">{stock.price?.toFixed(2)} $</span>
        <span className="change" style={{ color: changeColor }}>
          {arrow} {stock.change?.toFixed(2)} ({stock.changePercentage?.toFixed(2)}%)
        </span>
      </div>
      <div className="stock-details">
        <div><span>Open:</span> {stock.open?.toFixed(2)} $</div>
        <div><span>High:</span> {stock.dayHigh?.toFixed(2)} $</div>
        <div><span>Low:</span> {stock.dayLow?.toFixed(2)} $</div>
        <div><span>Volume:</span> {stock.volume?.toLocaleString('en-US')}</div>
        <div><span>Market Cap:</span> {(stock.marketCap / 1e9)?.toFixed(2)} B $</div>
      </div>
    </div>
  );
}

export default StockCard;
