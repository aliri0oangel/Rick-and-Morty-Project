/**
 * playwright.config.js — Configuración de Playwright (Fases 8–10).
 * -------------------------------------------------------------------
 *  - webServer: levanta scripts/dev.mjs (:4173) y lo reutiliza si ya corre.
 *  - Proyectos: chromium con 3 viewports clave (móvil 375, tablet 768,
 *    escritorio 1280). La matriz completa de 12 resoluciones vive en
 *    tests/responsive.spec.js como spot-checks; el despliegue CI puede
 *    ampliar `projects` sin tocar los specs.
 *  - Los specs E2E (flujos del enunciado) y axe (a11y) comparten server.
 */

import { defineConfig, devices } from '@playwright/test';

// Puerto del server de tests: 4173 por defecto (el mismo de scripts/dev.mjs).
// PORT permite desviar la suite cuando ese puerto ya lo ocupa un `pnpm dev`
// activo: reuseExistingServer sigue en false por diseño (anti-flaky), así
// que la alternativa válida es OTRO puerto, no reutilizar el server externo.
const PUERTO = Number(process.env.PORT) || 4173;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // 1 worker por defecto: la suite corre en máquinas justas (p. ej. 4 hilos
  // compartidos con el navegador de escritorio del usuario). Con 2+ workers
  // los Chromium se pelean por CPU y tests que pasaban solos fallaban en
  // paralelo (fetches de la API que nunca completaban y timeouts en
  // cadena). PW_WORKERS permite ampliarlo en CI con holgura de CPU.
  workers: Number(process.env.PW_WORKERS) || 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reportes/playwright' }]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'escritorio-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'movil-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: 'node scripts/dev.mjs',
    url: `http://localhost:${PUERTO}/index.html`,
    // Sin livereload: sus recargas espurios (tmp/antivirus) rompían tests.
    // Sin watch de Tailwind: la suite usa el dist/app.css ya compilado
    // (`test:e2e` ejecuta `pnpm build` antes) y así NO se spawnea un
    // segundo watcher que podía entrar en bucle de rebuild cruzado con el
    // del `pnpm dev` del usuario sobre dist/app.css (CPU al 100%).
    env: { ...process.env, NO_LIVERELOAD: '1', NO_WATCH: '1' },
    // Nunca reutilizar un server externo: un dev server con livereload
    // activo (o con otro código) introduce tests flaky.
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
