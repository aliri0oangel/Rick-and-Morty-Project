/**
 * responsive.spec.js — Spot-checks responsive (Fase 9 / T9.1–T9.2).
 * -------------------------------------------------------------------
 * Los proyectos de playwright.config.js ya rotan 3 viewports clave
 * (375 · 768 · 1280). Este spec verifica por celda:
 *  - 0 overflow horizontal (scrollWidth <= clientWidth + 1px de margen),
 *  - header sin hamburguesa: enlaces de texto ≥768 e iconos redondos
 *    <768, con dropdown de "Mi cuenta" en todos los tamaños (M4),
 *  - cabecera sticky (M3) y grids con columnas.
 *
 * La matriz COMPLETA de 12 resoluciones × 2 temas queda documentada en
 * README §QA: aquí se automatiza la parte ejecutable sin depender de
 * 144 screenshots en cada corrida local.
 */

import { test, expect } from '@playwright/test';
import { instalarApiMock } from './helpers/mock-api.js';
import { registrarUsuario, iniciarSesion } from './helpers/sesion.js';

// API mockeada para no depender de la red externa en los spot-checks.
test.beforeEach(async ({ page }) => {
  await instalarApiMock(page);
});

const PAGINAS = ['/index.html', '/login.html', '/register.html', '/404.html'];

/**
 * Comprueba que la página no tenga scroll horizontal.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function sinOverflowHorizontal(page) {
  const desborde = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // 1px de tolerancia por redondeos de subpíxel en algunos engines.
  expect(desborde, 'overflow horizontal detectado').toBeLessThanOrEqual(1);
}

test.describe('sin overflow horizontal en viewports clave (T9.1)', () => {
  for (const ruta of PAGINAS) {
    test(ruta, async ({ page }) => {
      await page.goto(ruta);
      await sinOverflowHorizontal(page);
    });
  }

  test('/character.html?id=1 (con sesión)', async ({ page }) => {
    // Registro+login mínimo para acceder al detalle (helper compartido).
    const correo = `morty.${Date.now().toString(36)}@dimension.test`;
    await registrarUsuario(page, { nombre: 'Morty', apellido: 'Smith', correo });
    await iniciarSesion(page, correo);

    await page.goto('/character.html?id=1');
    await expect(page.locator('#detalle [data-campo="nombre"]')).not.toBeEmpty({ timeout: 10_000 });
    await sinOverflowHorizontal(page);
  });
});

test.describe('header responsive (T9.1 / M3-M4)', () => {
  test.beforeEach(async ({ page }) => {
    // Sesión para que el header esté montado (helper compartido).
    const correo = `beth.${Date.now().toString(36)}@dimension.test`;
    await registrarUsuario(page, { nombre: 'Beth', apellido: 'Smith', correo });
    await iniciarSesion(page, correo);
  });

  test('móvil: iconos redondos sin hamburguesa; dropdown de cuenta', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();

    // M4: la hamburguesa desapareció del DOM.
    await expect(page.locator('#btn-menu')).toHaveCount(0);

    // 4 controles redondos visibles; los enlaces de texto, ocultos.
    await expect(page.locator('a.btn-icono[data-nav="catalogo"]')).toBeVisible();
    await expect(page.locator('a.btn-icono[data-nav="favoritos"]')).toBeVisible();
    await expect(page.locator('#btn-tema')).toBeVisible();
    await expect(page.locator('#btn-cuenta')).toBeVisible();
    await expect(page.locator('ul a[data-nav="catalogo"]')).toBeHidden();

    // Dropdown "Mi cuenta" (M4): dos opciones y aria-expanded sincronizado.
    const btnCuenta = page.locator('#btn-cuenta');
    await expect(btnCuenta).toHaveAttribute('aria-expanded', 'false');
    await btnCuenta.click();
    await expect(btnCuenta).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#menu-cuenta');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Mi cuenta')).toBeVisible();
    await expect(menu.getByText('Cerrar sesión')).toBeVisible();

    // Escape cierra y devuelve el foco (a11y).
    await page.keyboard.press('Escape');
    await expect(btnCuenta).toHaveAttribute('aria-expanded', 'false');
  });

  test('escritorio: enlaces de texto; iconos ocultos; dropdown también', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();

    await expect(page.locator('ul a[data-nav="catalogo"]')).toBeVisible();
    await expect(page.locator('a.btn-icono[data-nav="catalogo"]')).toBeHidden();
    await expect(page.locator('#btn-menu')).toHaveCount(0);

    await page.locator('#btn-cuenta').click();
    await expect(page.locator('#menu-cuenta')).toBeVisible();
    await expect(page.locator('#menu-cuenta').getByText('Cerrar sesión')).toBeVisible();
  });

  test('la cabecera se queda fija arriba al hacer scroll (M3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();

    const scrollY = await page.evaluate(() => {
      window.scrollTo(0, 600);
      return window.scrollY;
    });
    expect(scrollY, 'la página debe tener scroll para poder verificar').toBeGreaterThan(0);

    const caja = await page.locator('header .barra-vidrio').boundingBox();
    expect(caja, 'la barra debe seguir visible tras el scroll').not.toBeNull();
    expect(Math.abs(caja.y), 'la barra sticky debe seguir en el tope').toBeLessThanOrEqual(1);
  });

  test('detalle: la imagen completa la card sin hueco inferior (M6)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/character.html?id=1');
    await expect(page.locator('#detalle [data-campo="nombre"]')).not.toBeEmpty({ timeout: 10_000 });

    // En 2 columnas la celda de la imagen debe llegar al borde inferior
    // de la card (tolerancia 1px de redondeo).
    const medidas = await page.evaluate(() => {
      const card = document.querySelector('#detalle .tubo-card');
      const imagen = document.querySelector('#detalle [data-campo="imagen"]').parentElement;
      const c = card.getBoundingClientRect();
      const i = imagen.getBoundingClientRect();
      return { hueco: Math.round(c.bottom - i.bottom), alto: Math.round(c.height) };
    });
    expect(medidas.alto, 'la card debe tener altura real para medir').toBeGreaterThan(100);
    expect(Math.abs(medidas.hueco), 'hueco vertical bajo la imagen').toBeLessThanOrEqual(1);
  });
});
