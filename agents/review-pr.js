/**
 * review-pr.js
 *
 * Agente educativo de revisión de Pull Requests.
 *
 * Este script demuestra los seis elementos clave de un agente de IA:
 *   1. Instrucciones  → el system prompt que define el rol y los criterios
 *   2. Contexto       → los datos de la PR obtenidos de GitHub
 *   3. Herramientas   → Octokit (GitHub) y el SDK de OpenAI
 *   4. Modelo         → el LLM de OpenAI que genera la revisión
 *   5. Control de flujo → este propio script que orquesta los pasos
 *   6. Supervisión humana → el menú final que deja al usuario decidir la acción
 *
 * Uso:
 *   node review-pr.js --pr 123
 *   node review-pr.js --owner miusuario --repo mirepo --pr 123
 */

import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import * as dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// 0. Configuración inicial
// ---------------------------------------------------------------------------

// Cargamos las variables de entorno desde el archivo .env (si existe)
dotenv.config();

// Modelo por defecto si la variable de entorno OPENAI_MODEL no está definida
const DEFAULT_MODEL = "gpt-4o";

// Longitud máxima (en caracteres) del patch de un archivo antes de truncarlo.
// Esto evita que prompts enormes superen el límite de tokens del modelo.
const MAX_PATCH_LENGTH = 3000;

// ---------------------------------------------------------------------------
// 1. Parseo de argumentos de línea de comandos
// ---------------------------------------------------------------------------

/**
 * Parsea los argumentos CLI en un objeto clave-valor sencillo.
 * Soporta el formato --clave valor.
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++; // saltamos el valor
    }
  }
  return args;
}

const cliArgs = parseArgs(process.argv);

// Leemos los parámetros: CLI tiene prioridad sobre variables de entorno
const owner = cliArgs.owner || process.env.GITHUB_OWNER;
const repo = cliArgs.repo || process.env.GITHUB_REPO;
const prNumber = cliArgs.pr ? parseInt(cliArgs.pr, 10) : null;

// ---------------------------------------------------------------------------
// 2. Validación de argumentos y variables de entorno
// ---------------------------------------------------------------------------

function validateConfig() {
  const missing = [];

  if (!process.env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!owner) missing.push("GITHUB_OWNER (o --owner)");
  if (!repo) missing.push("GITHUB_REPO (o --repo)");
  if (!prNumber || isNaN(prNumber)) missing.push("--pr <número>");

  if (missing.length > 0) {
    console.error("\n❌ Faltan los siguientes parámetros o variables de entorno:");
    missing.forEach((m) => console.error(`   - ${m}`));
    console.error("\nEjemplo de uso:");
    console.error("  node review-pr.js --pr 123");
    console.error("  node review-pr.js --owner miusuario --repo mirepo --pr 123\n");
    process.exit(1);
  }
}

validateConfig();

// ---------------------------------------------------------------------------
// 3. Creación de clientes
// ---------------------------------------------------------------------------

// Cliente de GitHub usando el token de autenticación personal
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Cliente de OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Modelo a utilizar
const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

// ---------------------------------------------------------------------------
// 4. Obtención de datos de la Pull Request desde GitHub
// ---------------------------------------------------------------------------

/**
 * Obtiene los metadatos de la PR y la lista de archivos modificados.
 * Devuelve un objeto con toda la información necesaria para construir el prompt.
 */
async function fetchPullRequest() {
  console.log(`\nLeyendo PR #${prNumber}...`);

  // Metadatos generales de la PR (título, body, autor, ramas...)
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Lista de archivos modificados, con el patch (diff) de cada uno
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100, // máximo permitido por la API
  });

  return { pr, files };
}

// ---------------------------------------------------------------------------
// 5. Construcción del contexto para el prompt
// ---------------------------------------------------------------------------

/**
 * Construye un bloque de texto compacto con los metadatos de la PR
 * y los diffs de los archivos modificados.
 *
 * Los patches demasiado largos se truncan para evitar prompts gigantes.
 */
function buildContext(pr, files) {
  // Metadatos de la PR
  const meta = [
    `Título: ${pr.title}`,
    `Autor: ${pr.user.login}`,
    `Rama base: ${pr.base.ref}`,
    `Rama origen: ${pr.head.ref}`,
    `Descripción: ${pr.body || "(sin descripción)"}`,
    `Archivos modificados: ${files.length}`,
  ].join("\n");

  // Diffs por archivo
  const diffs = files
    .map((file) => {
      let patch = file.patch || "(sin diff disponible)";

      // Truncamos el patch si es demasiado largo
      if (patch.length > MAX_PATCH_LENGTH) {
        patch = patch.slice(0, MAX_PATCH_LENGTH) + "\n... [TRUNCATED]";
      }

      return [
        `\n--- Archivo: ${file.filename} ---`,
        `Estado: ${file.status} | +${file.additions} -${file.deletions}`,
        patch,
      ].join("\n");
    })
    .join("\n");

  return `${meta}\n\n${diffs}`;
}

// ---------------------------------------------------------------------------
// 6. Llamada a OpenAI para obtener la revisión
// ---------------------------------------------------------------------------

/**
 * Construye el prompt y llama a OpenAI.
 * Solicita explícitamente una respuesta en JSON con la estructura definida.
 */
async function reviewWithOpenAI(context) {
  console.log("\nAnalizando cambios con OpenAI...");

  // --- INSTRUCCIONES (elemento 1 del agente) ---
  const systemPrompt = `Eres un asistente de revisión de código para Pull Requests de GitHub.
Tu tarea es analizar el diff de una PR y proporcionar una revisión estructurada y útil.

Criterios de revisión que debes aplicar:
- Errores obvios de lógica
- Problemas básicos de seguridad (inyecciones, secretos expuestos, etc.)
- Ausencia de validaciones de entrada
- Ausencia de tests cuando sea relevante
- Inconsistencias entre frontend y backend
- Manejo de errores deficiente o ausente
- Problemas de mantenibilidad o legibilidad
- Nombres confusos de variables, funciones o archivos
- Cambios peligrosos o con un alcance demasiado amplio
- Posibles regresiones en funcionalidad existente

Restricciones importantes:
- NO afirmes con seguridad cosas que no puedas deducir del diff
- NO inventes contexto de negocio que no esté presente
- NO bloquees la PR por detalles menores de estilo
- NO prometas que el código funciona correctamente
- NO sustituyas la revisión humana; tu análisis es un apoyo, no la decisión final

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional):
{
  "risk": "low | medium | high",
  "decision": "approve | comment | request_changes",
  "summary": "Resumen corto de la PR y del análisis.",
  "findings": [
    {
      "severity": "info | warning | critical",
      "file": "ruta/del/archivo",
      "line": null,
      "message": "Descripción del hallazgo",
      "suggestion": "Sugerencia concreta"
    }
  ],
  "suggested_comment": "Comentario en Markdown listo para publicar en GitHub."
}

Si no hay línea clara para un hallazgo, usa null en el campo "line".
Si no hay hallazgos, devuelve un array vacío en "findings".`;

  // --- CONTEXTO (elemento 2 del agente) ---
  const userPrompt = `Revisa la siguiente Pull Request y devuelve tu análisis en JSON:

${context}`;

  // --- LLAMADA AL MODELO (elemento 4 del agente) ---
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    // Pedimos explícitamente formato JSON para facilitar el parseo
    response_format: { type: "json_object" },
    temperature: 0.2, // baja temperatura para respuestas más consistentes
  });

  return response.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// 7. Presentación de resultados en consola
// ---------------------------------------------------------------------------

/**
 * Imprime el informe de revisión de forma legible.
 */
function printReview(review) {
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" };
  const decisionEmoji = { approve: "✅", comment: "💬", request_changes: "🔄" };
  const severityEmoji = { info: "ℹ️ ", warning: "⚠️ ", critical: "🚨" };

  console.log("\n" + "=".repeat(60));
  console.log("📋  RESULTADO DE LA REVISIÓN");
  console.log("=".repeat(60));

  console.log(`\n${riskEmoji[review.risk] || "❓"} Riesgo: ${review.risk.toUpperCase()}`);
  console.log(
    `${decisionEmoji[review.decision] || "❓"} Decisión recomendada: ${review.decision}`
  );
  console.log(`\n📝 Resumen:\n   ${review.summary}`);

  if (review.findings && review.findings.length > 0) {
    console.log(`\n🔍 Hallazgos (${review.findings.length}):`);
    review.findings.forEach((f, i) => {
      console.log(
        `\n  ${i + 1}. ${severityEmoji[f.severity] || "•"} [${f.severity.toUpperCase()}] ${f.file}${f.line ? `:${f.line}` : ""}`
      );
      console.log(`     📌 ${f.message}`);
      console.log(`     💡 ${f.suggestion}`);
    });
  } else {
    console.log("\n🔍 Hallazgos: ninguno");
  }

  console.log("\n💬 Comentario sugerido:");
  console.log("-".repeat(40));
  console.log(review.suggested_comment);
  console.log("-".repeat(40));
  console.log("\n" + "=".repeat(60));
}

// ---------------------------------------------------------------------------
// 8. Menú de acciones con supervisión humana
// ---------------------------------------------------------------------------

/**
 * Muestra el menú interactivo y ejecuta la acción elegida por el usuario.
 * Esta es la parte de "supervisión humana" del agente: nada se publica
 * sin confirmación explícita.
 */
async function promptUserAction(review) {
  // Creamos la interfaz de readline para leer input del usuario
  const rl = createInterface({ input, output });

  console.log("\n¿Qué quieres hacer?");
  console.log("  1. Publicar comentario resumen en la PR");
  console.log("  2. Aprobar la PR");
  console.log("  3. Solicitar cambios");
  console.log("  4. Salir sin hacer nada");

  let choice;
  try {
    choice = await rl.question("\nElige una opción (1-4): ");
  } finally {
    rl.close();
  }

  choice = choice.trim();

  // --- HERRAMIENTAS (elemento 3 del agente): Octokit para actuar en GitHub ---

  if (choice === "1") {
    // Publicamos un comentario general en la PR (que en GitHub es una issue)
    const body = buildComment(review);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    console.log("\n✅ Comentario publicado en GitHub.");
  } else if (choice === "2") {
    // Aprobamos la PR usando el endpoint de reviews
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "APPROVE",
      body: `## Revisión asistida por IA ✅\n\n${review.summary}\n\n> ⚠️ Esta aprobación fue generada con asistencia de IA y debe ser validada por un revisor humano.`,
    });
    console.log("\n✅ PR aprobada en GitHub.");
  } else if (choice === "3") {
    // Solicitamos cambios usando el endpoint de reviews
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "REQUEST_CHANGES",
      body: buildComment(review),
    });
    console.log("\n🔄 Solicitud de cambios publicada en GitHub.");
  } else {
    // Cualquier otra entrada no hace nada
    console.log("\nNo se ha realizado ninguna acción.");
  }
}

/**
 * Construye el cuerpo del comentario que se publicará en GitHub.
 * Incluye una advertencia clara de que es una revisión asistida por IA.
 */
function buildComment(review) {
  const riskBadge = { low: "🟢 Bajo", medium: "🟡 Medio", high: "🔴 Alto" };
  const lines = [
    "## 🤖 Revisión asistida por IA",
    "",
    "> ⚠️ **Este análisis fue generado automáticamente con IA y requiere validación humana.**",
    "> No sustituye una revisión de código por parte de un desarrollador.",
    "",
    `**Riesgo estimado:** ${riskBadge[review.risk] || review.risk}`,
    `**Decisión sugerida:** \`${review.decision}\``,
    "",
    "### Resumen",
    review.summary,
  ];

  if (review.findings && review.findings.length > 0) {
    lines.push("", "### Hallazgos");
    review.findings.forEach((f) => {
      const icon =
        f.severity === "critical" ? "🚨" : f.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(
        `\n**${icon} [${f.severity.toUpperCase()}]** \`${f.file}${f.line ? `:${f.line}` : ""}\``
      );
      lines.push(`- ${f.message}`);
      lines.push(`- 💡 _${f.suggestion}_`);
    });
  }

  if (review.suggested_comment) {
    lines.push("", "### Comentario adicional", review.suggested_comment);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 9. Función principal — control de flujo del agente (elemento 5)
// ---------------------------------------------------------------------------

async function main() {
  try {
    // Paso 1: Obtener datos de la PR desde GitHub
    const { pr, files } = await fetchPullRequest();

    // Paso 2: Construir el contexto compacto con metadatos y diffs
    const context = buildContext(pr, files);

    // Paso 3: Enviar el contexto a OpenAI y obtener la revisión
    const rawReview = await reviewWithOpenAI(context);

    // Paso 4: Parsear la respuesta JSON del modelo
    let review;
    try {
      review = JSON.parse(rawReview);
    } catch {
      console.error("\n❌ Error: OpenAI no devolvió un JSON válido.");
      console.error("Respuesta recibida:\n", rawReview);
      process.exit(1);
    }

    console.log("\nRevisión completada.");

    // Paso 5: Mostrar el informe en consola
    printReview(review);

    // Paso 6: Preguntar al usuario qué acción tomar (supervisión humana)
    await promptUserAction(review);
  } catch (error) {
    // Manejo básico de errores: mensajes claros según el tipo de fallo
    if (error.status === 404) {
      console.error(`\n❌ No se encontró la PR #${prNumber} en ${owner}/${repo}.`);
      console.error("   Verifica que el número de PR, owner y repo sean correctos.");
    } else if (error.status === 401) {
      console.error("\n❌ Token de GitHub inválido o sin permisos suficientes.");
      console.error("   Comprueba que GITHUB_TOKEN tenga acceso al repositorio.");
    } else if (error.code === "invalid_api_key") {
      console.error("\n❌ Clave de API de OpenAI inválida.");
      console.error("   Comprueba el valor de OPENAI_API_KEY en tu archivo .env.");
    } else {
      console.error("\n❌ Error inesperado:", error.message || error);
    }
    process.exit(1);
  }
}

// Ejecutamos el agente
main();
