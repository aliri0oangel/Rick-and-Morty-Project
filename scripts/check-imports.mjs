/**
 * check-imports.mjs — Verificador de imports relativos (calidad de código).
 * Uso: `pnpm check:imports`
 * Recorre todos los .js de src/ de forma recursiva, extrae los
 * `from "./ruta"` y comprueba que el fichero destino exista. Detecta imports rotos tras refactorizaciones de carpetas
 * (algo que `node --check` NO detecta porque solo valida sintaxis).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** Lista recursiva de .js dentro de src/ */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

let checked = 0;
const broken = [];

for (const file of walk(SRC)) {
  const code = readFileSync(file, 'utf8');
  // Solo imports/exports con specificador relativo (estáticos)
  const patterns = [/from\s*["'](\.[^"']+)["']/g, /import\s*["'](\.[^"']+)["']/g];
  for (const re of patterns) {
    for (const match of code.matchAll(re)) {
      checked++;
      const target = path.resolve(path.dirname(file), match[1]);
      if (!existsSync(target)) {
        broken.push(`${path.relative(ROOT, file)} → ${match[1]}`);
      }
    }
  }
}

if (broken.length) {
  console.error(`✗ Imports rotos (${broken.length}):`);
  for (const b of broken) console.error(`   ${b}`);
  process.exit(1);
}
console.log(`✓ ${checked} imports relativos verificados en src/ — todos resuelven.`);
