// Financial news list component
function NewsList({ news }) {
  if (!news || !news.articles || news.articles.length === 0) {
    return <p className="loading">Loading news...</p>;
  }

  return (
    <div className="news-section">
      <h2>📰 Financial News</h2>
      <div className="news-grid">
        {news.articles.slice(0, 8).map((article, index) => (
          <a
            key={index}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-card"
          >
            {article.urlToImage && (
              <img src={article.urlToImage} alt={article.title} className="news-image" />
            )}
            <div className="news-content">
              <h4>{article.title}</h4>
              <p className="news-source">
                {article.source?.name} • {new Date(article.publishedAt).toLocaleDateString('en-US')}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default NewsList;
