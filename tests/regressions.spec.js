/**
 * regressions.spec.js — Regresiones de hallazgos de prioridad alta.
 * -------------------------------------------------------------------
 * Cubre:
 *  - Búsqueda sin coincidencias => estado vacío (no error de API).
 *  - Detalle con id inexistente => mensaje específico (404 de negocio).
 *  - Registro con TLD de 2 letras (.es) => válido.
 *  - Registro sin TLD => error de formato.
 *
 * La API va mockeada para que los casos sean deterministas y no dependan
 * de la red ni del rate-limit externo.
 */

import { test, expect } from '@playwright/test';
import { instalarApiMock } from './helpers/mock-api.js';
import { registrarUsuario, iniciarSesion } from './helpers/sesion.js';

test.beforeEach(async ({ page }) => {
  await instalarApiMock(page);
});

test.describe('regresiones de prioridad alta', () => {
  // Cada caso hace registro + login (Web Crypto) y catálogo: bajo carga
  // paralela el default de 30s queda corto, igual que en los flujos E2E.
  test.describe.configure({ timeout: 60_000 });

  test('búsqueda sin coincidencias muestra estado vacío, no error', async ({ page }) => {
    const correo = await registrarUsuario(page);
    await iniciarSesion(page, correo);

    await page.fill('#buscar', 'zzzzzzzz');
    await page.press('#buscar', 'Enter');

    const vacio = page.locator('[data-zona="vacio"]');
    await expect(vacio).toBeVisible({ timeout: 10_000 });
    await expect(vacio).toContainText('Sin resultados');
    await expect(page.locator('[data-zona="error"]')).toBeHidden();
  });

  test('detalle con id inexistente muestra mensaje específico', async ({ page }) => {
    const correo = await registrarUsuario(page);
    await iniciarSesion(page, correo);

    await page.goto('/character.html?id=99999');

    const error = page.locator('#detalle-error');
    await expect(error).toBeVisible({ timeout: 10_000 });
    await expect(error).toContainText('Ese personaje no existe en la API.');
  });

  test('registro acepta correo con TLD de 2 letras (.es)', async ({ page }) => {
    const correo = `usuario.${Date.now().toString(36)}@dimension.es`;
    await registrarUsuario(page, { correo });

    // registrarUsuario ya espera la redirección; se deja explícito el contrato.
    await expect(page).toHaveURL(/login\.html/);
  });

  test('registro rechaza correo sin TLD', async ({ page }) => {
    await page.goto('/register.html');
    await page.fill('#nombre', 'Rick');
    await page.fill('#apellido', 'Sanchez');
    await page.fill('#correo', 'rick@dimension');
    await page.fill('#password', 'Portal$7x');
    await page.fill('#confirm_password', 'Portal$7x');
    await page.click('#btn_register');

    await expect(page.locator('#error-correo')).toHaveText('El correo no tiene un formato válido.');
    await expect(page).toHaveURL(/register\.html/);
  });

  test('sin sesión no pinta el catálogo antes de redirigir', async ({ page }) => {
    // El observer corre desde el inicio del documento: si el <h1> del
    // catálogo llega a existir (aunque sea un frame), deja una marca en
    // sessionStorage que sobrevive al redirect.
    await page.addInitScript(() => {
      if (!location.pathname.endsWith('/index.html')) return;

      const marcar = () => {
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.includes('Catálogo Interdimensional')) {
          sessionStorage.setItem('flash-catalogo', '1');
        }
      };

      new MutationObserver(marcar).observe(document, { childList: true, subtree: true });
      marcar();
    });

    // El redirect en <head> puede abortar la navegación original.
    await page.goto('/index.html').catch(() => {});
    await expect(page).toHaveURL(/login\.html/);
    await expect(page.locator('h1')).toHaveText('Bienvenido');

    // session-boot.js redirige antes de parsear el body => nunca hubo h1.
    expect(await page.evaluate(() => sessionStorage.getItem('flash-catalogo'))).toBeNull();
  });

  test('toast de favoritos es opaco en ambos temas', async ({ page }) => {
    const correo = await registrarUsuario(page);
    await iniciarSesion(page, correo);
    await expect(page.locator('article[data-id]').first()).toBeVisible({ timeout: 15_000 });

    // Tema claro (por defecto): primer favorito => toast info sólido.
    await page.locator('article[data-id] [data-favorito]').first().click();
    const toastClaro = page.locator('div[role="status"] .toast').last();
    await expect(toastClaro).toBeVisible();
    await expect(toastClaro).toContainText(/favoritos/);
    const fondoClaro = await toastClaro.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(fondoClaro).toMatch(/^rgb\(/); // rgb(...) sin alpha => opaco

    // Tema oscuro: el acento cambia y sigue siendo opaco.
    await page.click('#btn-tema');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.locator('article[data-id] [data-favorito]').nth(1).click();
    const toastOscuro = page.locator('div[role="status"] .toast').last();
    await expect(toastOscuro).toBeVisible();
    const fondoOscuro = await toastOscuro.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(fondoOscuro).toMatch(/^rgb\(/);
    expect(fondoOscuro).not.toBe(fondoClaro);

    // Contenedor por encima de las scanlines CRT (z-index 100).
    const zIndex = await page
      .locator('div[role="status"]')
      .evaluate((n) => getComputedStyle(n).zIndex);
    expect(zIndex).toBe('110');
  });
});
