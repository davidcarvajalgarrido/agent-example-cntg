import { useState, useEffect } from "react";
import { fetchProducts, fetchStats } from "./api.js";

function StatsSummary({ stats }) {
  return (
    <div className="stats-summary">
      <h2>Resumen del catálogo</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-value">{stats.totalProducts}</span>
          <span className="stat-label">Productos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.averagePrice.toFixed(2)} €</span>
          <span className="stat-label">Precio medio</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.averageKcal} kcal</span>
          <span className="stat-label">Kcal medias</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.categories.length}</span>
          <span className="stat-label">Categorías</span>
        </div>
      </div>
      <div className="categories-list">
        {stats.categories.map((cat) => (
          <span key={cat} className="category-tag">
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <div className="product-card">
      <div className="product-header">
        <h3 className="product-name">{product.name}</h3>
        <span className="product-category">{product.category}</span>
      </div>
      <p className="product-origin">📍 {product.origin}</p>
      <p className="product-description">{product.description}</p>
      <div className="product-footer">
        <span className="product-price">💶 {product.averagePrice} € aprox.</span>
        <span className="product-kcal">🔥 {product.kcal} kcal/ración</span>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorProducts, setErrorProducts] = useState(null);
  const [errorStats, setErrorStats] = useState(null);

  // Cargar estadísticas una sola vez al montar
  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err) => setErrorStats(err.message))
      .finally(() => setLoadingStats(false));
  }, []);

  // Cargar productos cuando cambia la búsqueda
  useEffect(() => {
    setLoadingProducts(true);
    setErrorProducts(null);

    const debounceTimer = setTimeout(() => {
      fetchProducts(search)
        .then((data) => setProducts(data.products))
        .catch((err) => setErrorProducts(err.message))
        .finally(() => setLoadingProducts(false));
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [search]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Productos Gallegos Locales</h1>
        <p className="app-subtitle">
          Descubre los sabores tradicionales de Galicia
        </p>
      </header>

      <main className="app-main">
        {/* Bloque de estadísticas */}
        <section className="section">
          {loadingStats && <p className="state-message">Cargando estadísticas...</p>}
          {errorStats && (
            <p className="state-message error">
              Error al cargar estadísticas: {errorStats}
            </p>
          )}
          {stats && <StatsSummary stats={stats} />}
        </section>

        {/* Buscador */}
        <section className="section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar por nombre, categoría, origen o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Lista de productos */}
        <section className="section">
          {loadingProducts && (
            <p className="state-message">Cargando productos...</p>
          )}

          {errorProducts && (
            <p className="state-message error">
              Error al cargar productos: {errorProducts}
            </p>
          )}

          {!loadingProducts && !errorProducts && products.length === 0 && (
            <p className="state-message">
              No se encontraron productos para "{search}".
            </p>
          )}

          {!loadingProducts && !errorProducts && products.length > 0 && (
            <>
              <p className="results-count">
                {products.length} producto{products.length !== 1 ? "s" : ""} encontrado
                {products.length !== 1 ? "s" : ""}
              </p>
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>Demo educativa · Productos Gallegos Locales API</p>
      </footer>
    </div>
  );
}
