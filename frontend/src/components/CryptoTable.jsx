// Cryptocurrency table component
function CryptoTable({ cryptos }) {
  if (!cryptos || cryptos.length === 0) {
    return <p className="loading">Loading cryptocurrencies...</p>;
  }

  return (
    <div className="crypto-section">
      <h2>🪙 Cryptocurrencies</h2>
      <table className="crypto-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Price (EUR)</th>
            <th>24h Change</th>
            <th>Market Cap</th>
          </tr>
        </thead>
        <tbody>
          {cryptos.map((crypto, index) => {
            const isPositive = crypto.price_change_percentage_24h >= 0;
            const changeColor = isPositive ? '#22c55e' : '#ef4444';
            return (
              <tr key={crypto.id}>
                <td>{index + 1}</td>
                <td className="crypto-name">
                  <img src={crypto.image} alt={crypto.name} width="24" height="24" />
                  <strong>{crypto.name}</strong>
                  <span className="crypto-symbol">{crypto.symbol?.toUpperCase()}</span>
                </td>
                <td>{crypto.current_price?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</td>
                <td style={{ color: changeColor }}>
                  {isPositive ? '▲' : '▼'} {crypto.price_change_percentage_24h?.toFixed(2)}%
                </td>
                <td>{(crypto.market_cap / 1e9)?.toFixed(2)} B €</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CryptoTable;
