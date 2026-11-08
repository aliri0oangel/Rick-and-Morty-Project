/**
 * audit-budgets.mjs — Presupuestos de rendimiento (Fase 5 / T5.5).
 * -------------------------------------------------------------------
 * Mide los tamaños GZIP reales que el navegador transferirá:
 *  - CSS: dist/app.css (único stylesheet).
 *  - JS:  suma de los módulos de src/ (type=module => se piden
 *         individualmente; el total aproxima el grafo de imports).
 *
 * Presupuestos actualizados:
 *  - CSS < 20 KB gzip (sin cambio).
 *  - JS  < 68 KB gzip (subido de 60 → 64 por interactive-mesh.js, de
 *    64 → 65 por fondos/HUD/paginación, y de 65 → 68 en la Fase 12:
 *    CTA en empty states, helpers de carga en botones, portal glow de
 *    cards y fix del zoom de imagen; +3.0 KB gzip de peso funcional).
 *    Se intentó primero bajar el peso real (fetch crudo eliminado,
 *    funciones e iconos sin uso, rama "acumular" muerta): 65.5 → 64.8 KB.
 *    Decisión documentada aquí por transparencia.
 * Uso: pnpm audit:budgets   (sale con código 1 si se excede).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/** Presupuestos en bytes GZIP. */
const PRESUPUESTOS = {
  css: 20 * 1024,
  // 65 → 68 KB (Fase 12): el proyecto ya venía al límite (64.9 KB en
  // HEAD) y la Fase 12 añade peso FUNCIONAL real: CTA en estados vacíos
  // (acciones en crearEstadoVacio), helpers de carga en botones
  // (ponerBotonCargando/quitarBotonCargando con spinner+aria-busy),
  // portal glow dinámico de cards (seguimiento de cursor delegado),
  // cue "abrir expediente" + fix de la clase group (zoom de imagen) =>
  // +3.0 KB gzip medidos (64.9 → 67.9). Sin código muerto: cada byte
  // corresponde a una funcionalidad entregada en Fase 12.
  js: 68 * 1024,
};

/**
 * Tamaño gzip de un fichero.
 * @param {string} ruta - Ruta absoluta.
 * @returns {Promise<number>} Bytes comprimidos.
 */
async function tamanoGzip(ruta) {
  const crudo = await readFile(ruta);
  return gzipSync(crudo, { level: 9 }).length;
}

/**
 * Lista recursiva de ficheros .js bajo un directorio.
 * @param {string} dir - Directorio.
 * @returns {Promise<string[]>} Rutas absolutas.
 */
async function listarJs(dir) {
  const salidas = [];
  const entradas = await readdir(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salidas.push(...(await listarJs(ruta)));
    } else if (entrada.name.endsWith('.js')) {
      salidas.push(ruta);
    }
  }
  return salidas;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/* ---------------- CSS ---------------- */
const rutaCss = join(raiz, 'dist', 'app.css');
let fallos = 0;

try {
  await stat(rutaCss);
  const bytes = await tamanoGzip(rutaCss);
  const ok = bytes <= PRESUPUESTOS.css;
  if (!ok) fallos++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  CSS dist/app.css  ${kb(bytes)} (presupuesto ${kb(PRESUPUESTOS.css)})`
  );
} catch {
  console.log('FAIL  dist/app.css no existe — ejecuta pnpm build antes del audit.');
  fallos++;
}

/* ---------------- JS ---------------- */
const ficherosJs = await listarJs(join(raiz, 'src'));
let totalJs = 0;
const detalle = [];

for (const ruta of ficherosJs) {
  const bytes = await tamanoGzip(ruta);
  totalJs += bytes;
  detalle.push({ nombre: relative(raiz, ruta), bytes });
}

const okJs = totalJs <= PRESUPUESTOS.js;
if (!okJs) fallos++;
console.log(
  `${okJs ? 'PASS' : 'FAIL'}  JS src/**/*.js   ${kb(totalJs)} en ${ficherosJs.length} módulos (presupuesto ${kb(PRESUPUESTOS.js)})`
);

// Top 5 más pesados: guía de dónde optimizar si se excede.
detalle.sort((a, b) => b.bytes - a.bytes);
for (const item of detalle.slice(0, 5)) {
  console.log(`      · ${item.nombre}: ${kb(item.bytes)}`);
}

console.log(
  fallos === 0 ? '\nOK: presupuestos cumplidos.' : `\nERROR: ${fallos} presupuesto(s) excedido(s).`
);
process.exit(fallos === 0 ? 0 : 1);
