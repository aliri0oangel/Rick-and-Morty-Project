/**
 * characters-api.js (src/services) — Cliente HTTP de la API de Rick and Morty (SRP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: hablar con la red. NO toca el DOM ni conoce
 * favoritos ni sesiones. Devuelve datos "crudos" ya validados y deja
 * los errores como excepciones con mensaje amigable para la capa vista.
 *
 * Requisitos del enunciado cubiertos aquí:
 *  - fetch con async/await (no .then encadenados).
 *  - Manejo de errores: API caída, id inexistente, timeout.
 *
 * Fase 5/7 (T5.3 + T7.1):
 *  - Caché stale-while-revalidate en MEMORIA (sirve dato viejo al
 *    instante y revalida en segundo plano) + sessionStorage VERSIONADA
 *    (clave con versión de esquema: invalida sin migración sucia).
 *  - Token bucket (core/rate-limit.js) + reintentos con backoff
 *    exponencial SOLO ante fallos transitorios (red/timeout/5xx/429).
 *    Los 404 de negocio ("nothing here") nunca se reintentan.
 *  - Abort de peticiones en vuelo al abandonar la página (pagehide).
 */

import { API_BASE, API_TIMEOUT_MS, API_REINTENTOS, API_BACKOFF_MS } from '../config/config.js';
import { esperarTurno, esperar } from '../core/rate-limit.js';

/* ----------------------------------------------------------------
 * Cancelación de peticiones en vuelo (abort al navegar fuera)
 * ---------------------------------------------------------------- */

/** Controladores activos: se abortan todos en pagehide. */
const controladoresActivos = new Set();

if (typeof window !== 'undefined') {
  // pagehide cubre back/forward y cierre; beforeunload es el respaldo.
  window.addEventListener('pagehide', () => {
    for (const controlador of controladoresActivos) {
      controlador.abort();
    }
    controladoresActivos.clear();
  });
}

/* ----------------------------------------------------------------
 * Núcleo de peticiones: rate limit + timeout + reintentos
 * ---------------------------------------------------------------- */

/**
 * ¿Es este error reintenable? (red caída, timeout, 5xx, 429).
 * Los 404 de negocio y errores de parseo NO lo son.
 * @param {Error} error
 * @returns {boolean}
 */
function esReintenable(error) {
  return error.reintentable === true;
}

/**
 * Una petición individual con timeout y registro de abort.
 * @param {string} ruta - Ruta relativa a API_BASE.
 * @returns {Promise<Object>} JSON de la respuesta.
 * @throws {Error} Marcado con .reintentable cuando conviene reintentar.
 */
async function pedirUnaVez(ruta) {
  await esperarTurno(); // token bucket: evita ráfagas de la propia UI

  const controlador = new AbortController();
  controladoresActivos.add(controlador);
  const reloj = setTimeout(() => controlador.abort(), API_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${API_BASE}${ruta}`, {
      signal: controlador.signal,
    });

    // 429 = rate limit del SERVIDOR: reintenable con backoff.
    if (respuesta.status === 429) {
      const error = new Error('La API solicitó calma (429). Reintentando…');
      error.reintentable = true;
      throw error;
    }

    // La API responde 404 con { error: "..." } para ids inexistentes:
    // aprovechamos SU mensaje si existe (id inexistente => error claro).
    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const motivo = datos?.error || `Error HTTP ${respuesta.status}`;
      const error = new Error(motivo);
      // 5xx = fallo del servidor => transitorio; 4xx de negocio => no.
      error.reintentable = respuesta.status >= 500;
      throw error;
    }

    return datos;
  } catch (error) {
    if (error.name === 'AbortError') {
      // Timeout: transitorio, se marca reintenable (no se expone el Abort).
      const errorTimeout = new Error('La API tardó demasiado en responder. Inténtalo de nuevo.');
      errorTimeout.reintentable = true;
      throw errorTimeout;
    }
    if (error instanceof TypeError) {
      const errorRed = new Error('No hay conexión con la API. Revisa tu internet.', {
        cause: error,
      });
      errorRed.reintentable = true;
      throw errorRed;
    }
    throw error; // Errores de negocio (404 etc.) y los ya marcados
  } finally {
    clearTimeout(reloj);
    controladoresActivos.delete(controlador);
  }
}

/**
 * Núcleo compartido de peticiones: reintentos con backoff exponencial
 * (300ms · 600ms) SOLO para fallos transitorios.
 * @param {string} ruta - Ruta relativa a API_BASE (ej: "/character/7").
 * @returns {Promise<Object>} JSON de la respuesta.
 * @throws {Error} Con mensaje amigable si falla la red/timeout/HTTP.
 */
async function pedirJson(ruta) {
  let ultimoError;
  for (let intento = 0; intento <= API_REINTENTOS; intento++) {
    if (intento > 0) {
      await esperar(API_BACKOFF_MS * 2 ** (intento - 1));
    }
    try {
      return await pedirUnaVez(ruta);
    } catch (error) {
      ultimoError = error;
      if (!esReintenable(error)) throw error; // negocio: sin reintentos
    }
  }
  throw ultimoError;
}

/* ----------------------------------------------------------------
 * CACHÉ stale-while-revalidate (Fase 5 / T5.3)
 * ----------------------------------------------------------------
 * Dos capas:
 *  1) MEMORIA (Map): datos al volar; sirve stale de inmediato y
 *     revalida en segundo plano cuando venció el TTL.
 *  2) SessionStorage VERSIONADA: sobrevive a recargas/back-forward
 *     dentro de la pestaña; la versión de esquema invalida de golpe.
 * ---------------------------------------------------------------- */

/** Versión del esquema de caché: cambiarla invalida todo lo previo. */
const VERSION_ESQUEMA = 'v2';

/** Prefijo de clave de caché por página (versionado). */
const PREFIJO_CACHE = `cache_personajes_${VERSION_ESQUEMA}_p`;

/** Tiempo de vida considerado "fresco": 5 minutos. */
const TTL_MS = 5 * 60 * 1000;

/** Capa 1: memoria por página (instantánea, se sirve stale + revalidate). */
const memoriaPaginas = new Map();

/**
 * Lee una página de SessionStorage si aún no venció su TTL.
 * @param {number} pagina - Nº de página (1 en adelante).
 * @returns {Array<Object>|null} Lista o null si no hay/venció.
 */
function leerCachePagina(pagina) {
  try {
    const crudo = sessionStorage.getItem(`${PREFIJO_CACHE}${pagina}`);
    if (!crudo) return null;
    const { t, d } = JSON.parse(crudo);
    if (Date.now() - t > TTL_MS) {
      sessionStorage.removeItem(`${PREFIJO_CACHE}${pagina}`);
      return null;
    }
    return Array.isArray(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Escribe una página en ambas capas de caché.
 * @param {number} pagina - Nº de página.
 * @param {Array<Object>} datos - Lista a cachear.
 * @returns {void}
 */
function escribirCachePagina(pagina, datos) {
  const entrada = { t: Date.now(), d: datos };
  memoriaPaginas.set(pagina, entrada);
  try {
    sessionStorage.setItem(`${PREFIJO_CACHE}${pagina}`, JSON.stringify(entrada));
  } catch {
    // Storage lleno/bloqueado: se sigue funcionando sin capa fría.
  }
}

/**
 * Revalida una página en segundo plano (SWR): red → actualiza cachés.
 * Los fallos se silencian (la UI ya tiene el dato stale servido).
 * @param {number} pagina - Nº de página a revalidar.
 * @returns {void}
 */
function revalidarEnFondo(pagina) {
  pedirUnaVez(`/character?page=${pagina}`)
    .then((datos) => {
      const lista = Array.isArray(datos?.results) ? datos.results : [];
      if (lista.length > 0) escribirCachePagina(pagina, lista);
    })
    .catch(() => {
      /* dato stale servido; el próximo intento de la UI reintentará */
    });
}

/**
 * Busca un personaje en TODAS las páginas ya cacheadas (memoria + LS).
 * Evita el fetch del detalle si el usuario viene del catálogo.
 * @param {string|number} id - Id buscado.
 * @returns {Object|null}
 */
export function buscarEnCache(id) {
  // 1) Memoria (más rápida).
  for (const { d } of memoriaPaginas.values()) {
    const encontrado = (d || []).find((p) => String(p.id) === String(id));
    if (encontrado) return encontrado;
  }
  // 2) SessionStorage.
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const clave = sessionStorage.key(i);
      if (!clave?.startsWith(PREFIJO_CACHE)) continue;

      const { t, d } = JSON.parse(sessionStorage.getItem(clave) || '{}');
      if (Date.now() - t > TTL_MS) continue;

      const encontrado = (d || []).find((p) => String(p.id) === String(id));
      if (encontrado) return encontrado;
    }
  } catch {
    /* cache corrupta => se ignora */
  }
  return null;
}

/**
 * Vacía toda la caché de personajes (memoria + SessionStorage).
 * @returns {void}
 */
export function limpiarCachePersonajes() {
  memoriaPaginas.clear();
  try {
    const claves = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const clave = sessionStorage.key(i);
      if (clave?.startsWith(PREFIJO_CACHE)) claves.push(clave);
    }
    claves.forEach((c) => sessionStorage.removeItem(c));
  } catch {
    /* sin storage no hay nada que limpiar */
  }
}

/* ----------------------------------------------------------------
 * Endpoints públicos
 * ---------------------------------------------------------------- */

/**
 * Obtiene una página de personajes (20 registros por página).
 * Estrategia: memoria fresca → stale+revalidate → sessionStorage → red.
 * @param {number} [pagina=1] - Nº de página (1 en adelante).
 * @returns {Promise<Array<Object>>} Lista de personajes.
 */
export async function obtenerPersonajes(pagina = 1) {
  // 1) Memoria fresca => cero latencia.
  const enMemoria = memoriaPaginas.get(pagina);
  if (enMemoria && Date.now() - enMemoria.t <= TTL_MS) {
    return enMemoria.d;
  }

  // 2) Memoria stale => se SIRVE YA y se revalida en segundo plano.
  if (enMemoria) {
    revalidarEnFondo(pagina);
    return enMemoria.d;
  }

  // 3) SessionStorage (recarga/back-forward) => promoción a memoria.
  const enStorage = leerCachePagina(pagina);
  if (enStorage) {
    memoriaPaginas.set(pagina, { t: Date.now(), d: enStorage });
    return enStorage;
  }

  // 4) Red (con rate limit + reintentos).
  // `?page=N` es el formato de paginación de la API (requisito opcional).
  const datos = await pedirJson(`/character?page=${pagina}`);
  const lista = Array.isArray(datos?.results) ? datos.results : [];

  escribirCachePagina(pagina, lista);
  return lista;
}

/**
 * Obtiene un personaje por su id.
 * Primero consulta la caché de páginas (vuelven del catálogo sin red);
 * si no está, hace el fetch a la API.
 * @param {number|string} id - Id del personaje.
 * @returns {Promise<Object>} Personaje completo.
 * @throws {Error} "There is nothing here" (id inexistente) u otro fallo.
 */
export async function obtenerPersonaje(id) {
  // Se sanea el id: solo dígitos, evita rutas raras en la URL.
  const idLimpio = String(id).replace(/\D/g, '');
  if (!idLimpio) {
    throw new Error('Identificador de personaje inválido.');
  }

  // 1) ¿Ya está en alguna página cacheada?
  const desdeCache = buscarEnCache(idLimpio);
  if (desdeCache) return desdeCache;

  // 2) Red
  return pedirJson(`/character/${idLimpio}`);
}

/**
 * Busca personajes con los filtros del endpoint /character (Fase 3).
 * Acepta name + status + species combinados (la API los soporta en la
 * misma query). Los 404 "Nothing found" de la API son "sin resultados",
 * no un error de sistema. Los resultados filtrados NO se cachean por
 * página (las claves de caché son para el catálogo sin filtros).
 * @param {{nombre?: string, estado?: string, especie?: string,
 *          pagina?: number}} [filtros]
 * @returns {Promise<Array<Object>>} Coincidencias (vacío si no hay).
 */
export async function buscarPersonajes({ nombre = '', estado = '', especie = '', pagina } = {}) {
  const parametros = new URLSearchParams();
  if (nombre.trim()) parametros.set('name', nombre.trim());
  // Valores exactos que espera la API: alive|dead|unknown (insensible a mayúsculas).
  if (estado) parametros.set('status', estado);
  if (especie) parametros.set('species', especie);
  if (pagina) parametros.set('page', String(pagina));

  const query = parametros.toString();
  try {
    const datos = await pedirJson(`/character${query ? `?${query}` : ''}`);
    return Array.isArray(datos?.results) ? datos.results : [];
  } catch (error) {
    // La API responde 404 "Nothing found" cuando no hay coincidencias:
    // eso NO es un error de sistema, es "sin resultados".
    if (error.message.toLowerCase().includes('nothing found')) {
      return [];
    }
    throw error;
  }
}
