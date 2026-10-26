/**
 * ============================================================================
 * dev.mjs — Servidor de desarrollo (PLAN.md T0.3)
 * ============================================================================
 * Uso: `pnpm dev`  →  http://localhost:4173
 *
 * Hace 3 cosas a la vez:
 *  1. Watch de Tailwind: `pnpm exec tailwindcss --watch` compilando
 *     src/styles/app.css → dist/app.css en caliente.
 *  2. Servidor estático del proyecto (los 6 HTML + assets) con Cache-Control
 *     no-store para que siempre se sirva la última versión.
 *  3. Livereload por SSE: inyecta en cada HTML un cliente que se recarga
 *     cuando cambia cualquier archivo. El cliente se sirve como fichero
 *     propio (/__livereload-client.js) para respetar la CSP `script-src 'self'`
 *     (los scripts inline estarían bloqueados).
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { watch, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;

/** Tipos MIME mínimos necesarios por el proyecto (PLAN.md §5) */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Cliente livereload (served as own file → CSP-safe) */
const LR_CLIENT = `
// Livereload de desarrollo (inyectado por scripts/dev.mjs — no existe en producción)
const es = new EventSource('/__livereload');
es.onmessage = () => location.reload();
`;

/** Conectados al SSE de recarga */
const clients = new Set();

/* -------------------------------------------------------------------------- */
/* 1) Watch de Tailwind                                                        */
/* -------------------------------------------------------------------------- */
const tw = spawn(
  'pnpm',
  ['exec', 'tailwindcss', '-i', 'src/styles/app.css', '-o', 'dist/app.css', '--watch'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true, // necesario en Windows para lanzar el shim .cmd de pnpm
  }
);
tw.on('exit', (code) => {
  console.error(`[dev] Tailwind watch terminó con código ${code}`);
  process.exit(code ?? 1);
});

/* -------------------------------------------------------------------------- */
/* 3) Livereload: fs.watch (recursivo) con debounce → avisa por SSE             */
/*    Desactivable con NO_LIVERELOAD=1 (lo usa Playwright: los eventos         */
/*    espurios de Windows/antivirus o ficheros temporales provocaban           */
/*    recargas a mitad de un test y destruían el contexto del navegador).      */
/* -------------------------------------------------------------------------- */
const LIVERELOAD = process.env.NO_LIVERELOAD !== '1';
let reloadTimer = null;
// Directorios volátiles que NO deben provocar recargas: Playwright escribe
// test-results/.last-run.json tras cada test y reportes/ al generar HTML;
// recargar en mitad de un test destruye el contexto de ejecución del navegador.
const IGNORAR_WATCH =
  /(node_modules|\.git\/|^test-results\/|^reportes\/|^playwright-report\/|^reports\/|^_tmp_|\.playwright)/;
if (LIVERELOAD) {
  watch(ROOT, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const file = filename.toString().replace(/\\/g, '/');
    // Solo nos interesan fuentes del proyecto (no dependencias ni .git)
    if (IGNORAR_WATCH.test(file)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      console.log(`[dev] cambio detectado: ${file} → recargando`);
      for (const res of clients) res.write('data: reload\n\n');
    }, 200);
  });
}

// Keep-alive del SSE (evita que proxies/navegadores cierren la conexión)
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000);

/* -------------------------------------------------------------------------- */
/* 2) Servidor estático                                                        */
/* -------------------------------------------------------------------------- */
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';

    // --- Endpoint SSE de recarga ---
    if (pathname === '/__livereload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // --- Cliente livereload ---
    if (pathname === '/__livereload-client.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
      res.end(LR_CLIENT);
      return;
    }

    // --- Ficheros estáticos (con defensa contra path traversal) ---
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('403 Forbidden');
      return;
    }

    let status = 200;
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // 404: si existe 404.html (Fase 6) se sirve; si no, texto plano
      const notFound = path.join(ROOT, '404.html');
      if (existsSync(notFound)) {
        status = 404;
        body = await readFile(notFound);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };

    // En HTML se inyecta el cliente livereload antes de </body> (solo si está activo)
    if (status === 200 && ext === '.html' && LIVERELOAD) {
      const html = body.toString('utf8').replace(/<\/body>/i, `${LR_SCRIPT_TAG}</body>`);
      body = Buffer.from(html, 'utf8');
    }

    res.writeHead(status, headers).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`500 ${err.message}`);
  }
});

/** Tag de inyección del cliente livereload */
const LR_SCRIPT_TAG = '<script src="/__livereload-client.js"></script>';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[dev] Puerto ${PORT} ocupado. Usa: $env PORT=4174; pnpm dev`);
  } else {
    console.error('[dev] Error del servidor:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('──────────────────────────────────────────────');
  console.log(' Web-Manual · desarrollo (pnpm dev)');
  console.log(` → http://localhost:${PORT}`);
  console.log('  · Tailwind watch activo → dist/app.css');
  console.log('  · Livereload activo (SSE)');
  console.log('──────────────────────────────────────────────');
});

/* -------------------------------------------------------------------------- */
/* Cierre limpio (Ctrl+C)                                                      */
/* -------------------------------------------------------------------------- */
function shutdown() {
  for (const res of clients) res.end();
  server.close();
  if (!tw.killed) tw.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
