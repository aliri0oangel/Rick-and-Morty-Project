/**
 * tests/helpers/sesion.js — Flujos de registro/login compartidos por specs.
 * -------------------------------------------------------------------
 * Centraliza el setup de identidad en UN sitio para que e2e, a11y y
 * responsive ejerciten exactamente el mismo camino.
 *
 * `iniciarSesion` espera el RESULTADO real del submit (navegación al
 * índice o mensaje de error visible) y reintenta UNA vez: bajo carga
 * paralela se observó un race puntual en el que el campo de contraseña
 * llegaba vacío al handler (medidor con última entrada, value '').
 */

import { expect } from '@playwright/test';

/** Contraseña válida de todos los usuarios de prueba. */
export const CONTRASENA = 'Portal$7x';

/**
 * Registra un usuario nuevo vía el formulario (flujo real de UI).
 * @param {import('@playwright/test').Page} page
 * @param {{correo?: string, nombre?: string, apellido?: string}} [datos]
 * @returns {Promise<string>} El correo usado.
 */
export async function registrarUsuario(page, datos = {}) {
  const correo = datos.correo ?? `usuario.${Date.now().toString(36)}@dimension.test`;
  const nombre = datos.nombre ?? 'Rick';
  const apellido = datos.apellido ?? 'Sanchez';

  await page.goto('/register.html');
  await page.fill('#nombre', nombre);
  await page.fill('#apellido', apellido);
  await page.fill('#correo', correo);
  await page.fill('#password', CONTRASENA);
  await page.fill('#confirm_password', CONTRASENA);
  await page.click('#btn_register');
  // register.js redirige al login tras 1s con mensaje de éxito.
  await expect(page).toHaveURL(/login\.html/, { timeout: 5_000 });
  return correo;
}

/**
 * Envía el formulario de login y espera su desenlace (índice o error).
 * @param {import('@playwright/test').Page} page
 * @param {string} correo
 * @returns {Promise<void>}
 */
async function someterLogin(page, correo) {
  await page.fill('#correo', correo);
  await page.fill('#password', CONTRASENA);
  await page.click('button[type="submit"]');
  // El submit es async (hash Web Crypto): se resuelve con la navegación
  // al catálogo O con el aviso de error (#error-general visible).
  await Promise.race([
    page.waitForURL(/index\.html/, { timeout: 5_000 }).catch(() => {}),
    page
      .locator('#error-general')
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {}),
  ]);
}

/**
 * Inicia sesión y garantiza caer en el catálogo (con un reintento si el
 * primer envío quedó en blanco por el race documentado).
 * @param {import('@playwright/test').Page} page
 * @param {string} correo
 * @returns {Promise<void>}
 */
export async function iniciarSesion(page, correo) {
  await page.goto('/login.html');
  await someterLogin(page, correo);
  if (page.url().includes('login.html')) {
    await someterLogin(page, correo); // reintento único documentado
  }
  await expect(page).toHaveURL(/index\.html/, { timeout: 5_000 });
}
