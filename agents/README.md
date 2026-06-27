# 🤖 Agente de Revisión de Pull Requests

Agente educativo en Node.js que utiliza **OpenAI** y la **API de GitHub** para analizar Pull Requests y sugerir una revisión estructurada.

> ⚠️ **Advertencia:** Este agente es una herramienta de apoyo. Sus análisis están generados por IA y **no sustituyen la revisión humana** de código.

---

## ¿Qué hace este agente?

1. Lee los datos de una Pull Request de GitHub (título, descripción, archivos, diffs).
2. Construye un prompt detallado con instrucciones y criterios de revisión.
3. Envía el contexto a OpenAI y obtiene un análisis estructurado en JSON.
4. Muestra en consola un informe con: riesgo, decisión sugerida, hallazgos y comentario.
5. Pregunta al usuario qué acción quiere tomar en GitHub (comentar, aprobar, pedir cambios o salir).

Este script demuestra los **seis elementos de un agente de IA**:

| Elemento | Implementación |
|---|---|
| Instrucciones | System prompt con rol y criterios de revisión |
| Contexto | Datos de la PR obtenidos de GitHub |
| Herramientas | Octokit (GitHub) + SDK OpenAI |
| Modelo | LLM de OpenAI configurable |
| Control de flujo | El propio script orquesta cada paso |
| Supervisión humana | Menú final: el usuario decide la acción |

---

## Instalación

```bash
cd agents
npm install
```

---

## Configuración

Copia el archivo de ejemplo y rellena las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
GITHUB_TOKEN=ghp_...          # Token de GitHub (repo + write:discussion)
OPENAI_API_KEY=sk-...         # Clave de API de OpenAI
GITHUB_OWNER=tu-usuario       # Propietario del repositorio
GITHUB_REPO=tu-repositorio    # Nombre del repositorio
OPENAI_MODEL=gpt-4o           # Opcional; por defecto usa gpt-4o
```

### Permisos necesarios para el token de GitHub

El token debe tener al menos estos permisos:
- `repo` — para leer PRs y publicar comentarios/reviews

---

## Ejecución

```bash
# Forma básica (usa GITHUB_OWNER y GITHUB_REPO del .env)
node review-pr.js --pr 123

# Especificando owner y repo por CLI
node review-pr.js --owner miusuario --repo mirepo --pr 123

# Usando el script de npm
npm run review -- --pr 123
```

---

## Ejemplo de salida

```
Leyendo PR #123...

Analizando cambios con OpenAI...

Revisión completada.

============================================================
📋  RESULTADO DE LA REVISIÓN
============================================================

🟡 Riesgo: MEDIUM
💬 Decisión recomendada: comment

📝 Resumen:
   La PR añade un endpoint de login sin validación de entrada...

🔍 Hallazgos (2):

  1. ⚠️  [WARNING] src/auth/login.js
     📌 No se valida el formato del email antes de consultar la base de datos.
     💡 Añade validación con una librería como validator.js o Zod.

  2. ℹ️  [INFO] src/auth/login.js
     📌 El mensaje de error revela si el usuario existe o no.
     💡 Usa un mensaje genérico como "Credenciales incorrectas".

¿Qué quieres hacer?
  1. Publicar comentario resumen en la PR
  2. Aprobar la PR
  3. Solicitar cambios
  4. Salir sin hacer nada
```

---

## Notas técnicas

- El patch de cada archivo se **trunca a 3 000 caracteres** para evitar superar el límite de tokens del modelo. Archivos grandes aparecerán con `[TRUNCATED]` al final del diff.
- Se usa `response_format: { type: "json_object" }` de la API de OpenAI para garantizar que la respuesta sea JSON válido.
- Los comentarios en GitHub se publican como comentarios de issue (no inline), lo que hace la demo más sencilla y robusta.
