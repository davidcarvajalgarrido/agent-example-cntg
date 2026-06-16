# Productos Gallegos Locales — Demo educativa

App full stack sencilla que muestra un catálogo de productos gastronómicos gallegos. Sirve como base de código real para demostrar el uso de agentes de IA en revisiones de Pull Requests.

---

## Estructura del repositorio

```
/
├── README.md
├── backend/          # API REST con Node.js + Express
├── frontend/         # Interfaz web con Vite + React
└── agents/           # Scripts de automatización con IA (no modificar)
```

---

## Arrancar la aplicación en local

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

El servidor quedará escuchando en:

```
http://localhost:3001/api/health
```

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La interfaz estará disponible en:

```
http://localhost:5173
```

---

## Endpoints de la API

| Método | Ruta                          | Descripción                                    |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/health`                 | Estado del servicio                            |
| GET    | `/api/products`               | Lista de productos (acepta `?search=` y `?category=`) |
| GET    | `/api/products/:id`           | Detalle de un producto por ID                  |
| GET    | `/api/products/stats/summary` | Resumen estadístico del catálogo               |

### Ejemplos

```bash
# Comprobar que la API responde
curl http://localhost:3001/api/health

# Buscar productos con "pulpo"
curl "http://localhost:3001/api/products?search=pulpo"

# Filtrar por categoría
curl "http://localhost:3001/api/products?category=postre"

# Estadísticas
curl http://localhost:3001/api/products/stats/summary
```

---

## Carpeta `agents/`

Contiene scripts de automatización que usan modelos de lenguaje (LLMs) para tareas de desarrollo, como revisión automática de Pull Requests.

El agente principal (`agents/review-pr.js`) analiza el diff de un PR y genera comentarios de revisión estructurados. Esta app es el proyecto que sirve como sujeto de demostración para ese agente.

Para más detalles, consulta [`agents/README.md`](agents/README.md).

---

## Decisiones técnicas

- **Sin base de datos**: los datos están en memoria (`backend/data/products.js`) para simplificar el setup.
- **Sin autenticación**: demo pública sin usuarios.
- **Sin TypeScript**: JavaScript puro para máxima legibilidad.
- **Sin Docker**: se arranca directamente con `npm`.
