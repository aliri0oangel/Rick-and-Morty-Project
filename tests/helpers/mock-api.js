/**
 * tests/helpers/mock-api.js — Interceptación de la API para E2E (Fase 10).
 * -------------------------------------------------------------------
 * page.route() reemplaza a rickandmortyapi.com con tests/fixtures.
 * Motivo honesto: los tests E2E paralelos compartían cuota de rate-limit
 * con la API real y fallaban con "No hay conexión" (429/TypeError).
 * Con mock: determinista, rápido y sin red. La validación contra la API
 * real vive en el smoke manual / `pnpm dev` (documentado en README §QA).
 *
 * Soporta: GET /character (lista con filtros name/status/species),
 * GET /character/:id (detalle), y avatares CDN (SVG local).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
import { PERSONAJES } from '../fixtures/personajes.js';

/** SVG mínimo servido en lugar de los avatares CDN (sin red). */
const AVATAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
  '<circle cx="32" cy="32" r="30" fill="#0b0c10" stroke="#facc15" stroke-width="4"/></svg>';

/**
 * Filtra el fixture igual que haría la API real (query params).
 * @param {URLSearchParams} params - Query de la petición.
 * @returns {Array<Object>} Personajes que cumplen los filtros.
 */
function filtrar(params) {
  let resultados = PERSONAJES;
  const nombre = params.get('name');
  const estado = params.get('status');
  const especie = params.get('species');
  if (nombre) {
    resultados = resultados.filter((p) => p.name.toLowerCase().includes(nombre.toLowerCase()));
  }
  if (estado) {
    resultados = resultados.filter((p) => p.status.toLowerCase() === estado.toLowerCase());
  }
  if (especie) {
    resultados = resultados.filter((p) => p.species.toLowerCase() === especie.toLowerCase());
  }
  return resultados;
}

export async function instalarApiMock(page) {
  // --- Lista / detalle de personajes ---
  await page.route('**://rickandmortyapi.com/api/character**', async (ruta) => {
    const url = new URL(ruta.request().url());
    const idRuta = url.pathname.match(/\/character\/(\d+)$/);

    if (idRuta) {
      const personaje = PERSONAJES.find((p) => p.id === Number(idRuta[1]));
      if (!personaje) {
        await ruta.fulfill({ status: 404, json: { error: 'Personaje no encontrado' } });
        return;
      }
      await ruta.fulfill({ json: personaje });
      return;
    }

    const resultados = filtrar(url.searchParams);
    if (resultados.length === 0) {
      // La API real devuelve 404 cuando name no coincide con nada.
      await ruta.fulfill({ status: 404, json: { error: 'There is nothing here' } });
      return;
    }
    await ruta.fulfill({
      json: {
        info: { count: resultados.length, pages: 1, next: null, prev: null },
        results: resultados,
      },
    });
  });

  // --- Avatares CDN: SVG local, cero dependencia de red ---
  await page.route('**://cdn.rickandmortyapi.com/**', (ruta) =>
    ruta.fulfill({ contentType: 'image/svg+xml', body: AVATAR_SVG })
  );
}
