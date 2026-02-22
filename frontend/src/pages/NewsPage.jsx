// Page complète des actualités financières
import { useState, useEffect } from 'react';
import { getNews } from '../services/api';

function NewsPage() {
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    try {
      const data = await getNews();
      setNews(data);
    } catch (err) {
      console.error('Erreur chargement news:', err);
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Chargement des actualités...</p>;

  return (
    <div className="news-page">
      <h1>📰 Actualités financières</h1>
      <p className="page-subtitle">Les dernières nouvelles des marchés</p>

      <div className="news-grid news-grid-full">
        {news?.articles?.map((article, index) => (
          <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="news-card">
            {article.urlToImage && <img src={article.urlToImage} alt={article.title} className="news-image" />}
            <div className="news-content">
              <h4>{article.title}</h4>
              {article.description && <p className="news-desc">{article.description.slice(0, 120)}...</p>}
              <p className="news-source">{article.source?.name} • {new Date(article.publishedAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default NewsPage;
