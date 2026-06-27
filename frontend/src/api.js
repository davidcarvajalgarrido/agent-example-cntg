const API_BASE = "http://localhost:3001/api";

export async function fetchProducts(search = "", category = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);

  const url = `${API_BASE}/products${params.toString() ? "?" + params.toString() : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error al obtener productos: ${response.status}`);
  }

  return response.json();
}

export async function fetchStats() {
  const response = await fetch(`${API_BASE}/products/stats/summary`);

  if (!response.ok) {
    throw new Error(`Error al obtener estadísticas: ${response.status}`);
  }

  return response.json();
}
