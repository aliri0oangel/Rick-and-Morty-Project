/**
 * e2e.spec.js — Flujos E2E del enunciado (Fase 10 / T10.1 + T10.2).
 * -------------------------------------------------------------------
 * Cubre: ruta protegida → registro → login → catálogo (carga de la
 * API) → búsqueda → favorito → favoritos → detalle → compartir (UI) →
 * cuenta → logout; persistencia del tema; 404 temática; aislamiento
 * básico de favoritos (logout no los borran).
 *
 * Nota honesta: la sesión es client-side (localStorage/sessionStorage)
 * por diseño del enunciado; los tests validan ese contrato, no un
 * backend inexistente.
 */

import { test, expect } from '@playwright/test';
import { instalarApiMock } from './helpers/mock-api.js';
import { registrarUsuario, iniciarSesion as entrar } from './helpers/sesion.js';

// API mockeada en todos los tests: E2E hermético (sin rate-limit real).
test.beforeEach(async ({ page }) => {
  await instalarApiMock(page);
});

/** Identidad única por ejecución (evita colisiones entre corridas). */
const SUFIJO = Date.now().toString(36);
const USUARIO = {
  nombre: 'Rick',
  apellido: 'Sanchez',
  correo: `rick.${SUFIJO}@dimension.test`,
  password: 'Portal$7x',
};

/**
 * Registra al usuario de prueba (wrapper del helper compartido).
 * @param {import('@playwright/test').Page} page
 * @param {string} [correo] - Correo alternativo (2º usuario en un test).
 * @returns {Promise<void>}
 */
async function registrar(page, correo = USUARIO.correo) {
  await registrarUsuario(page, { ...USUARIO, correo });
}

/**
 * Inicia sesión con el usuario de prueba (helper compartido con retry).
 * @param {import('@playwright/test').Page} page
 * @param {string} [correo] - Correo del usuario a entrar.
 * @returns {Promise<void>}
 */
async function iniciarSesion(page, correo = USUARIO.correo) {
  await entrar(page, correo);
}

test.describe('rutas protegidas (T10.2)', () => {
  // Nota: el redirect por JS puede interrumpir el goto (misma carrera que
  // en el test de expiración); se valida siempre el RESULTADO final.
  test('sin sesión, favoritos redirige al login', async ({ page }) => {
    await page.goto('/favorites.html').catch(() => {});
    await expect(page).toHaveURL(/login\.html/);
  });

  test('sin sesión, mi cuenta redirige al login', async ({ page }) => {
    await page.goto('/mi_account.html').catch(() => {});
    await expect(page).toHaveURL(/login\.html/);
  });
});

test.describe('flujo principal (T10.1)', () => {
  // Flujo largo (registro→login→catálogo→detalle→cuenta→logout).
  test.describe.configure({ timeout: 60_000 });

  test('registro → login → catálogo → buscar → favorito → detalle → cuenta → logout', async ({
    page,
  }) => {
    await registrar(page);
    await iniciarSesion(page);

    // Catálogo carga personajes reales de la API (o su estado vacío si
    // la red falla: en CI con red debe haber articles).
    const primeraCard = page.locator('article[data-id]').first();
    await expect(primeraCard).toBeVisible({ timeout: 15_000 });

    // Búsqueda con debounce (spinner + recarga con el filtro name=).
    await page.fill('#buscar', 'rick');
    await page.press('#buscar', 'Enter');
    await expect(page.locator('article[data-id]').first()).toBeVisible({ timeout: 10_000 });

    // Quitar filtros => vuelve al catálogo completo.
    await page.click('#btn-limpiar');
    await expect(page.locator('article[data-id]').first()).toBeVisible({ timeout: 10_000 });

    // Marcar favorito en la primera card (botón ♥ superpuesto).
    const nombreFavorito = (await primeraCard.locator('[data-campo="nombre"]').textContent()) || '';
    await primeraCard.locator('[data-favorito]').click();
    await expect(primeraCard.locator('[data-favorito]')).toHaveAttribute('aria-pressed', 'true');

    // La favorita persiste en la página de favoritos (localStorage).
    await page.goto('/favorites.html');
    await expect(page.locator('article[data-id] [data-campo="nombre"]').first()).toHaveText(
      nombreFavorito.trim(),
      { timeout: 8_000 }
    );

    // Abrir el detalle desde la card (navegación con/sin View Transitions).
    await page.locator('article[data-id]').first().click();
    await expect(page).toHaveURL(/character\.html\?id=/);
    await expect(page.locator('#detalle [data-campo="nombre"]')).not.toBeEmpty({ timeout: 10_000 });
    await expect(
      page.locator('#detalle [data-campo="episodios-chips"] .badge').first()
    ).toBeVisible();

    // Compartir: sin Web Share en Chromium headless => fallback clipboard + toast.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('#btn-compartir');
    await expect(page.locator('div[role="status"]')).toContainText(/copiado|compartir/i, {
      timeout: 5_000,
    });

    // Cuenta: los datos del formulario vienen de la sesión.
    await page.goto('/mi_account.html');
    await expect(page.locator('#nombre')).toHaveValue(USUARIO.nombre);
    await expect(page.locator('#resumen-cuenta [data-campo="correo"]')).toHaveText(USUARIO.correo);

    // Logout vía dropdown "Mi cuenta" (M4: disponible en todos los
    // tamaños; sin hamburguesa) => confirmación modal => login.
    await page.click('#btn-cuenta');
    await page.click('#btn-salir');
    await page.click('[data-campo="confirmar"]');
    await expect(page).toHaveURL(/login\.html/);

    // T10.2: el logout NO borra favoritos (siguen en LS bajo la clave).
    const favoritos = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('favoritos:'))
    );
    expect(favoritos.length).toBeGreaterThan(0);
  });
});

test.describe('tema y 404 (T10.1)', () => {
  test('el toggle de tema persiste en cookie tras navegar', async ({ page }) => {
    await page.goto('/index.html');
    const antes = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#btn-tema');
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!antes);

    await page.goto('/favorites.html');
    // favorites redirige a login sin sesión; el tema debe seguir aplicado.
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!antes);
  });

  test('ruta inexistente sirve la 404 temática con status 404', async ({ page }) => {
    const respuesta = await page.goto('/dimension-inexistente.html');
    expect(respuesta?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText('404');
  });
});

test.describe('medidor de fuerza (M2)', () => {
  test('register: medidor en password y NUNCA en el confirmar', async ({ page }) => {
    await page.goto('/register.html');
    await page.fill('#password', USUARIO.password);
    await expect(page.locator('.fuerza')).toBeVisible();
    await expect(page.locator('.fuerza')).toHaveAttribute('data-nivel', /\d/);
    await page.fill('#confirm_password', USUARIO.password);
    expect(await page.locator('.fuerza').count(), 'solo un medidor en toda la página').toBe(1);
    // El botón ojo sí está en ambos campos.
    expect(await page.locator('.campo-toggle').count()).toBe(2);
  });

  test('login: cero medidores, solo botón ojo', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#password', USUARIO.password);
    expect(await page.locator('.fuerza').count()).toBe(0);
    expect(await page.locator('.campo-toggle').count()).toBe(1);
  });

  test('mi cuenta: medidor SOLO en "Nueva contraseña"', async ({ page }) => {
    await registrar(page);
    await iniciarSesion(page);
    await page.goto('/mi_account.html');
    await page.fill('#password', USUARIO.password);
    await expect(page.locator('.fuerza')).toBeVisible();
    await page.fill('#confirm_password', USUARIO.password);
    expect(await page.locator('.fuerza').count()).toBe(1);
    expect(await page.locator('.campo-toggle').count()).toBe(2);
  });
});

test.describe('regresión del enunciado (T10.2)', () => {
  // Varias pruebas hacen 2 ciclos registro+login + catálogo: 30s no
  // alcanzan con 3 workers en paralelo.
  test.describe.configure({ timeout: 60_000 });

  test('bloqueo tras 5 intentos fallidos de login', async ({ page }) => {
    await registrar(page); // termina en /login.html sin sesión

    const error = page.locator('#error-general');
    // 4 fallos => "Intentos restantes: 4..1"; el 5º => bloqueo temporal.
    for (let intento = 1; intento <= 5; intento++) {
      await page.fill('#correo', USUARIO.correo);
      await page.fill('#password', `Incorrecta${intento}$x`);
      await page.click('button[type="submit"]');
      await expect(error).toContainText(
        intento < 5 ? `Intentos restantes: ${5 - intento}` : /bloqueada temporalmente/i
      );
    }

    // Con la contraseña CORRECTA sigue bloqueado (no existe bypass).
    await page.fill('#password', USUARIO.password);
    await page.click('button[type="submit"]');
    await expect(error).toContainText(/Demasiados intentos fallidos/i);
  });

  test('la sesión expira a los 60 min y redirige al login', async ({ page }) => {
    await registrar(page);
    await iniciarSesion(page);

    // Envejece la sesión 61 min manipulando el _loginAt (contrato real).
    await page.evaluate(() => {
      const cruda = sessionStorage.getItem('sesion');
      const sesion = JSON.parse(cruda);
      sesion._loginAt = Date.now() - 61 * 60 * 1000;
      sessionStorage.setItem('sesion', JSON.stringify(sesion));
    });

    // Ir a favoritos: la página redirige por JS (rutaProtegida) al detectar
    // la sesión vencida, lo que a veces interrumpe el goto de Playwright
    // (carrera de timing). Lo toleramos y validamos el RESULTADO final.
    await page.goto('/favorites.html').catch(() => {});
    await expect(page).toHaveURL(/login\.html/);
    // La sesión vencida se limpia (no queda basura en storage).
    expect(await page.evaluate(() => sessionStorage.getItem('sesion'))).toBeNull();
  });

  test('cambiar el correo migra los favoritos (usuario legacy sin id)', async ({ page }) => {
    // Estado LEGACY: usuario y favoritos bajo la clave "favoritos:<correo>".
    const correoViejo = `legacy.${SUFIJO}@dimension.test`;
    const correoNuevo = `migrado.${SUFIJO}@dimension.test`;
    await page.goto('/login.html');
    await page.evaluate(
      ({ viejo }) => {
        localStorage.setItem(
          'usuarios',
          JSON.stringify([{ nombre: 'Legacy', apellido: 'User', correo: viejo }])
        );
        localStorage.setItem(
          `favoritos:${viejo}`,
          JSON.stringify([
            {
              id: 1,
              name: 'Rick Sanchez',
              status: 'Alive',
              species: 'Human',
              gender: 'Male',
              image: 'https://cdn.rickandmortyapi.com/avatar/1.jpeg',
              episode: ['https://rickandmortyapi.com/api/episode/1'],
              origin: { name: 'Earth' },
              location: { name: 'Earth' },
            },
          ])
        );
        sessionStorage.setItem(
          'sesion',
          JSON.stringify({
            nombre: 'Legacy',
            apellido: 'User',
            correo: viejo,
            _loginAt: Date.now(),
          })
        );
      },
      { viejo: correoViejo }
    );

    await page.goto('/mi_account.html');
    await page.fill('#correo', correoNuevo);
    await page.click('#btn_guardar');

    // Señal de que el guardado async terminó: el resumen repinta el correo.
    await expect(page.locator('#resumen-cuenta [data-campo="correo"]')).toHaveText(correoNuevo);

    // La clave vieja desaparece y la nueva conserva la lista íntegra.
    const claves = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('favoritos:'))
    );
    expect(claves).toHaveLength(1);
    expect(claves[0]).not.toContain(correoViejo);
    const lista = await page.evaluate(
      (clave) => JSON.parse(localStorage.getItem(clave) || '[]'),
      claves[0]
    );
    expect(lista.map((p) => p.id)).toEqual([1]);

    // Y la página de favoritos los sigue pintando tras la migración.
    await page.goto('/favorites.html');
    await expect(page.locator('article[data-id] [data-campo="nombre"]').first()).toHaveText(
      'Rick Sanchez'
    );
  });

  test('los favoritos quedan aislados por usuario', async ({ page }) => {
    // Usuario A: registra, favorea el primer personaje y sale.
    await registrar(page);
    await iniciarSesion(page);
    const primeraCard = page.locator('article[data-id]').first();
    await expect(primeraCard).toBeVisible({ timeout: 15_000 });
    const nombreFavorito = (await primeraCard.locator('[data-campo="nombre"]').textContent()) || '';
    await primeraCard.locator('[data-favorito]').click();

    // Logout vía dropdown "Mi cuenta" (M4) => confirmación modal.
    await page.click('#btn-cuenta');
    await page.click('#btn-salir');
    await page.click('[data-campo="confirmar"]');
    await expect(page).toHaveURL(/login\.html/);

    // Usuario B: sus favoritos empiezan vacíos (clave propia en LS).
    const correoB = `morty.${SUFIJO}@b-dimension.test`;
    await registrar(page, correoB);
    await iniciarSesion(page, correoB);
    await page.goto('/favorites.html');
    await expect(page.getByText('Aún no tienes favoritos')).toBeVisible();

    // La lista de A sigue intacta bajo su propia clave (B no la ve ni la toca).
    const claves = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('favoritos:'))
    );
    const nombres = await page.evaluate(
      (listaClaves) =>
        listaClaves.flatMap((k) => JSON.parse(localStorage.getItem(k) || '[]').map((p) => p.name)),
      claves
    );
    expect(nombres).toContain(nombreFavorito.trim());
  });
});
