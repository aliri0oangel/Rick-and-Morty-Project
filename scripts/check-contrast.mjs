/**
 * ============================================================================
 * check-contrast.mjs — Verificación de contraste AA (PLAN.md §3.7 / T1.2)
 * ============================================================================
 * Uso: `pnpm check:contrast` — sale con código 1 si algún par texto/fondo
 * queda por debajo del mínimo WCAG 2.1 (4.5:1 texto normal, 3:1 texto grande).
 *
 * Por qué script y no test: es QA de diseño sobre tokens fijos (hex literales
 * de @theme en app.css + capa semántica de tokens.css). Se empareja aquí a
 * mano de forma explícita para que el fallo diga "qué par se rompió".
 * NOTA: los fondos *-soft son color-mix sobre panel/bg; se valida el color de
 * texto contra el panel opaco (el composite solo lo aclara un ~14% → margen).
 */

const UMBRAL_NORMAL = 4.5;
const UMBRAL_GRANDE = 3;

/** Pares [descripción, colorTexto, colorFondo, mínimo] — espejo de §3.3. */
const PARES = [
  // ---- MODO DÍA ----
  ['día · ink sobre bg', '#2a2418', '#f4efe6', UMBRAL_NORMAL],
  ['día · ink sobre panel', '#2a2418', '#fffdf8', UMBRAL_NORMAL],
  ['día · dim sobre bg', '#6f6455', '#f4efe6', UMBRAL_NORMAL],
  ['día · dim sobre panel', '#6f6455', '#fffdf8', UMBRAL_NORMAL],
  ['día · brand sobre bg', '#8f5a00', '#f4efe6', UMBRAL_NORMAL],
  ['día · brand sobre panel', '#8f5a00', '#fffdf8', UMBRAL_NORMAL],
  ['día · info sobre bg', '#0b6b78', '#f4efe6', UMBRAL_NORMAL],
  ['día · info sobre panel', '#0b6b78', '#fffdf8', UMBRAL_NORMAL],
  ['día · danger sobre bg', '#c0155a', '#f4efe6', UMBRAL_NORMAL],
  ['día · danger sobre panel', '#c0155a', '#fffdf8', UMBRAL_NORMAL],
  ['día · on-brand sobre brand (btn)', '#fffdf8', '#8f5a00', UMBRAL_NORMAL],
  ['día · on-info sobre info (btn)', '#fffdf8', '#0b6b78', UMBRAL_NORMAL],
  ['día · on-danger sobre danger (btn)', '#fffdf8', '#c0155a', UMBRAL_NORMAL],

  // ---- CRT OSCURO ----
  ['CRT · ink sobre bg', '#ffd9a0', '#0b0c10', UMBRAL_NORMAL],
  ['CRT · ink sobre panel', '#ffd9a0', '#12141a', UMBRAL_NORMAL],
  ['CRT · dim sobre bg', '#9b8b74', '#0b0c10', UMBRAL_NORMAL],
  ['CRT · dim sobre panel', '#9b8b74', '#12141a', UMBRAL_NORMAL],
  ['CRT · brand sobre bg', '#ffb000', '#0b0c10', UMBRAL_NORMAL],
  ['CRT · brand sobre panel', '#ffb000', '#12141a', UMBRAL_NORMAL],
  ['CRT · info sobre bg', '#39d7e6', '#0b0c10', UMBRAL_NORMAL],
  ['CRT · info sobre panel', '#39d7e6', '#12141a', UMBRAL_NORMAL],
  ['CRT · danger sobre bg', '#ff4fa3', '#0b0c10', UMBRAL_NORMAL],
  ['CRT · danger sobre panel', '#ff4fa3', '#12141a', UMBRAL_NORMAL],
  ['CRT · on-brand sobre brand (btn)', '#0b0c10', '#ffb000', UMBRAL_NORMAL],
  ['CRT · on-info sobre info (btn)', '#0b0c10', '#39d7e6', UMBRAL_NORMAL],
  ['CRT · on-danger sobre danger (btn)', '#0b0c10', '#ff4fa3', UMBRAL_NORMAL],

  // ---- No textuales pero críticos (bordes/foco): 3:1 ----
  ['día · brand sobre bg (borde/foco)', '#8f5a00', '#f4efe6', UMBRAL_GRANDE],
  ['CRT · brand sobre bg (borde/foco)', '#ffb000', '#0b0c10', UMBRAL_GRANDE],
];

/** Luminancia relativa WCAG 2.1 (sRGB gamma-correcta). */
function luminancia(hex) {
  const h = hex.replace('#', '');
  const canales = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

/** Ratio de contraste entre dos colores hex. */
function ratio(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let fallos = 0;
for (const [desc, fg, bg, min] of PARES) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fallos++;
  const marca = ok ? 'PASS' : 'FAIL';
  console.log(`${marca}  ${r.toFixed(2)}:1 (min ${min})  — ${desc}`);
}

if (fallos > 0) {
  console.error(`\n${fallos} par(es) por debajo de AA.`);
  process.exit(1);
}
console.log(`\nOK: ${PARES.length}/${PARES.length} pares cumplen WCAG AA.`);
