import express from "express";
import cors from "cors";
import products from "./data/products.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "galician-products-api" });
});

// GET /api/products/stats/summary
// Debe ir antes de /api/products/:id para evitar conflictos de rutas
app.get("/api/products/stats/summary", (req, res) => {
  const totalProducts = products.length;

  const averagePrice =
    products.reduce((sum, p) => sum + p.averagePrice, 0) / totalProducts;

  const averageKcal =
    products.reduce((sum, p) => sum + p.kcal, 0) / totalProducts;

  const categories = [...new Set(products.map((p) => p.category))];

  res.json({
    totalProducts,
    averagePrice: Math.round(averagePrice * 100) / 100,
    averageKcal: Math.round(averageKcal),
    categories,
  });
});

// GET /api/products?search=...&category=...
app.get("/api/products", (req, res) => {
  const { search, category } = req.query;

  let results = [...products];

  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower) ||
        p.origin.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
    );
  }

  if (category) {
    results = results.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }

  res.json({ count: results.length, products: results });
});

// GET /api/products/:id
app.get("/api/products/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  res.json({ product });
});

app.listen(PORT, () => {
  console.log(`Galician Products API running at http://localhost:${PORT}`);
});
