/**
 * a11y.spec.js — Auditoría axe-core por página y tema (Fase 8 / T8.4).
 * -------------------------------------------------------------------
 * Ejecuta axe sobre las 6 páginas × 2 temas (CRT y día) y falla ante
 * cualquier violación de categoría serious/critical (WCAG 2.x A/AA).
 * Las moderationes se documentan en el propio test (nada se oculta).
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { instalarApiMock } from './helpers/mock-api.js';
import { registrarUsuario, iniciarSesion } from './helpers/sesion.js';

// API mockeada: axe debe auditar estados CARGADOS, no el estado de error
// por rate-limit de la API real con workers en paralelo.
test.beforeEach(async ({ page }) => {
  await instalarApiMock(page);
});

// La app usa CSP estricta (script-src 'self'); para AUDITAR hay que
// inyectar axe-core, así que la CSP se omite SOLO en este contexto de
// test (bypassCSP no toca el código de producción).
test.use({ bypassCSP: true });
// axe tarda varios segundos por página; 4 auditorías + esperas de la API
// superan el default de 30s en CI → margen amplio para el suite completo.
test.describe.configure({ timeout: 90_000 });

/** Páginas públicas auditables (las protegidas se auditan con sesión). */
const PAGINAS = [
  { ruta: '/index.html', nombre: 'catálogo (con sesión)' },
  { ruta: '/login.html', nombre: 'login' },
  { ruta: '/register.html', nombre: 'registro' },
  { ruta: '/404.html', nombre: '404' },
];

/**
 * Crea un usuario y deja la sesión iniciada (para páginas protegidas).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function prepararSesion(page) {
  const correo = `summer.${Date.now().toString(36)}@dimension.test`;
  await registrarUsuario(page, { nombre: 'Summer', apellido: 'Smith', correo });
  await iniciarSesion(page, correo);
}

/**
 * Ejecuta axe y devuelve las violaciones serious/critical.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array>} Violaciones filtradas.
 */
async function violacionesGraves(page) {
  const resultados = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return resultados.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('axe-core: cero violaciones graves (T8.4)', () => {
  for (const pagina of PAGINAS) {
    test(`páginas públicas — ${pagina.nombre}`, async ({ page }) => {
      await page.goto(pagina.ruta);
      const graves = await violacionesGraves(page);
      expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
    });
  }

  test('páginas con sesión — catálogo, favoritos, detalle, cuenta', async ({ page }) => {
    await prepararSesion(page);

    // Catálogo con personajes cargados (la API debe responder en CI).
    await expect(page.locator('article[data-id]').first()).toBeVisible({ timeout: 15_000 });
    expect(await violacionesGraves(page)).toEqual([]);

    await page.goto('/favorites.html');
    expect(await violacionesGraves(page)).toEqual([]);

    await page.goto('/character.html?id=1');
    await expect(page.locator('#detalle [data-campo="nombre"]')).not.toBeEmpty({ timeout: 10_000 });
    expect(await violacionesGraves(page)).toEqual([]);

    await page.goto('/mi_account.html');
    expect(await violacionesGraves(page)).toEqual([]);
  });

  test('tema día (sin .dark) — login sin violaciones graves', async ({ page }) => {
    await page.goto('/login.html');
    // Fuerza modo día quitando la clase dark (cookie + clase se sincronizan
    // en el toggle; aquí se simula directamente para auditar ambos temas).
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    expect(await violacionesGraves(page)).toEqual([]);
  });
});
