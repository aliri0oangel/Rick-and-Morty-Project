/**
 * prepare-deploy.mjs — Ensambla el directorio `public/` listo para Netlify.
 * -------------------------------------------------------------------
 * Uso: `pnpm build:deploy`  (compila Tailwind y después ejecuta este script)
 *
 * ¿Por qué existe? La app es estática pero NO es un simple "arrastrar la
 * raíz del repo": publicar la raíz subiría node_modules (symlinks de pnpm),
 * tests, reportes y docs. Netlify Drop además no ejecuta builds. Este script
 * genera un artefacto mínimo y reproducible con SOLO lo que el navegador
 * necesita en runtime:
 *
 *   public/
 *   ├─ *.html          (las 7 páginas, incluido 404.html)
 *   ├─ favicon.svg · robots.txt · sitemap.xml
 *   ├─ _headers         (cabeceras de seguridad de Netlify)
 *   ├─ src/             (módulos ES que los HTML importan)
 *   └─ dist/app.css     (CSS compilado por `pnpm build`)
 *
 * Valida antes de tocar nada: si dist/app.css no existe o está vacío, o
 * falta algún HTML/asset de origen, aborta con código 1 sin limpiar
 * un public/ previo válido.
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

/** Las 7 páginas del sitio (Netlify exige index.html en la raíz). */
const HTML = [
  'index.html',
  'login.html',
  'register.html',
  'favorites.html',
  'character.html',
  'mi_account.html',
  '404.html',
];

/** Assets estáticos de raíz servidos en runtime/SEO. */
const ASSETS = ['favicon.svg', 'robots.txt', 'sitemap.xml', '_headers'];

/** CSS compilado (entrada: src/styles/app.css vía `pnpm build`). */
const CSS = path.join('dist', 'app.css');

/* ------------------------------------------------------------------ */
/* 1) Validaciones previas (antes de limpiar public/)                  */
/* ------------------------------------------------------------------ */

const rutaCss = path.join(ROOT, CSS);
let cssValido;
try {
  cssValido = (await stat(rutaCss)).size > 0;
} catch {
  cssValido = false;
}
if (!cssValido) {
  console.error(`✗ ${CSS} no existe o está vacío — ejecuta \`pnpm build\` primero.`);
  process.exit(1);
}

const faltan = [...HTML, ...ASSETS, 'src'].filter((f) => !existsSync(path.join(ROOT, f)));
if (faltan.length) {
  console.error(`✗ Faltan ficheros de origen en la raíz del proyecto: ${faltan.join(', ')}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 2) Limpieza y creación de public/ (artefacto regenerable)           */
/* ------------------------------------------------------------------ */

await rm(PUBLIC, { recursive: true, force: true });
await mkdir(PUBLIC, { recursive: true });

/* ------------------------------------------------------------------ */
/* 3) Copia de SOLO lo necesario en runtime                            */
/* ------------------------------------------------------------------ */

for (const fichero of [...HTML, ...ASSETS]) {
  await cp(path.join(ROOT, fichero), path.join(PUBLIC, fichero));
}
await cp(path.join(ROOT, 'src'), path.join(PUBLIC, 'src'), { recursive: true });
await mkdir(path.join(PUBLIC, 'dist'), { recursive: true });
await cp(rutaCss, path.join(PUBLIC, CSS));

/* ------------------------------------------------------------------ */
/* 4) Verificación final + reporte                                      */
/* ------------------------------------------------------------------ */

/** Cuenta ficheros (no directorios) de forma recursiva. */
async function contarFicheros(dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const conteos = await Promise.all(
    entradas.map((e) => (e.isDirectory() ? contarFicheros(path.join(dir, e.name)) : 1))
  );
  return conteos.reduce((a, b) => a + b, 0);
}

if (!existsSync(path.join(PUBLIC, 'index.html'))) {
  console.error('✗ public/index.html ausente tras el ensamblado — despliegue abortado.');
  process.exit(1);
}

const total = await contarFicheros(PUBLIC);
console.log(`✓ public/ ensamblada: ${total} ficheros (HTML + src/ + ${CSS} + assets).`);
console.log('→ Arrastra la carpeta `public/` a https://app.netlify.com/drop para publicar.');
