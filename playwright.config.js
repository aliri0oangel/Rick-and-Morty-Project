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

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reportes/playwright' }]],
  use: {
    baseURL: 'http://localhost:4173',
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
    url: 'http://localhost:4173/index.html',
    // Sin livereload: sus recargas espurios (tmp/antivirus) rompían tests.
    env: { ...process.env, NO_LIVERELOAD: '1' },
    // Nunca reutilizar un server externo: un dev server con livereload
    // activo (o con otro código) introduce tests flaky.
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
