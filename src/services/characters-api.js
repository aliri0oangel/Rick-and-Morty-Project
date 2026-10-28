/**
 * characters-api.js (src/services) — Cliente HTTP de la API de Rick and Morty (SRP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: hablar con la red. NO toca el DOM ni conoce
 * favoritos ni sesiones. Devuelve datos ya validados y traducidos al
 * español (ÚNICO punto de traducción del proyecto: la vista consume
 * los datos tal cual) y deja los errores como excepciones con mensaje
 * amigable para la capa vista.
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
 *    Los 404 de negocio (sin resultados / id inexistente) nunca se reintentan.
 *  - Abort de peticiones en vuelo al abandonar la página (pagehide).
 */

import { API_BASE, API_TIMEOUT_MS, API_REINTENTOS, API_BACKOFF_MS } from '../config/config.js';
import { esperarTurno, esperar } from '../core/rate-limit.js';

/* ----------------------------------------------------------------
 * Traducciones de Datos (Internationalization)
 * ---------------------------------------------------------------- */

const DIC_TRADUCCIONES = {
  status: {
    Alive: 'Vivo',
    Dead: 'Muerto',
    // La API real manda "unknown" (minúscula); "Unknown" cubre datos legados.
    unknown: 'Desconocido',
    Unknown: 'Desconocido',
  },
  species: {
    Human: 'Humano',
    Alien: 'Alienígena',
    Humanoid: 'Humanoide',
    Robot: 'Robot',
    unknown: 'Desconocido',
    Unknown: 'Desconocido',
    'Mythological Creature': 'Criatura Mitológica',
    Poopybutthole: 'Poopybutthole',
  },
  gender: {
    Female: 'Mujer',
    Male: 'Hombre',
    Genderless: 'Sin género',
    unknown: 'Desconocido',
    Unknown: 'Desconocido',
  },
  // Traducimos los nombres de ubicaciones comunes si fuera necesario,
  // pero para nombres propios generales usamos una función de limpieza.
};

/**
 * Traduce los campos clave de un personaje según el diccionario.
 * ÚNICO punto de traducción del proyecto (la vista consume ya traducido).
 * Es idempotente: volver a traducir un dato ya traducido no lo altera.
 * @param {Object} personaje - Personaje crudo de la API.
 * @returns {Object} Personaje con campos traducidos.
 */
export function traducirPersonaje(personaje) {
  if (!personaje) return personaje;

  // Traducción de ubicación (nested object)
  let locationName = personaje.location?.name || 'Ubicación desconocida';

  // Mapeo simple de algunas ubicaciones comunes para mejorar la coherencia
  const locTraducciones = {
    Earth: 'Tierra',
    'Citadel of Ricks': 'Ciudadela de los Ricks',
    'Cromulon Cluster': 'Cúmulo de Cromulon',
    Unknown: 'Desconocido',
  };

  locationName = locTraducciones[locationName] || locationName;

  return {
    ...personaje,
    status: DIC_TRADUCCIONES.status[personaje.status] || personaje.status,
    species: DIC_TRADUCCIONES.species[personaje.species] || personaje.species,
    gender: DIC_TRADUCCIONES.gender[personaje.gender] || personaje.gender,
    location: {
      ...personaje.location,
      name: locationName,
    },
  };
}

/**
 * Traduce una lista de personajes.
 * @param {Array<Object>} lista - Lista cruda de la API.
 * @returns {Array<Object>} Lista traducida.
 */
function traducirLista(lista) {
  return Array.isArray(lista) ? lista.map(traducirPersonaje) : [];
}

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
      error.status = respuesta.status;
      error.reintentable = true;
      throw error;
    }

    // La API responde 404 con { error: "..." } para ids inexistentes:
    // aprovechamos SU mensaje si existe (id inexistente => error claro).
    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const motivo = datos?.error || `Error HTTP ${respuesta.status}`;
      const error = new Error(motivo);
      // El status permite distinguir 404 de negocio de fallos reales
      // sin depender del texto (la API cambia sus mensajes).
      error.status = respuesta.status;
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

/** Versión del esquema de caché: cambiarla invalida todo lo previo.
 *  v3: la entrada pasa de ser una LISTA a ser {info, results} (paginación). */
const VERSION_ESQUEMA = 'v3';

/** Prefijo de clave de caché por página (versionado). */
const PREFIJO_CACHE = `cache_personajes_${VERSION_ESQUEMA}_p`;

/** Tiempo de vida considerado "fresco": 5 minutos. */
const TTL_MS = 5 * 60 * 1000;

/** Capa 1: memoria por página (instantánea, se sirve stale + revalidate). */
const memoriaPaginas = new Map();

/**
 * Normaliza la respuesta de la API a {info, results} traduciendo resultados.
 * @param {Object} datos - JSON crudo de /character.
 * @returns {{info: Object, results: Array<Object>}}
 */
function aPagina(datos) {
  const results = Array.isArray(datos?.results) ? traducirLista(datos.results) : [];
  const infoCruda = datos?.info && typeof datos.info === 'object' ? datos.info : {};
  const pages = Number(infoCruda.pages);
  return {
    // Sin info (respuesta inesperada) se asume una sola página.
    info: { ...infoCruda, pages: Number.isFinite(pages) && pages > 0 ? pages : 1 },
    results,
  };
}

/**
 * Lee una página de SessionStorage si aún no venció su TTL.
 * @param {number} pagina - Nº de página (1 en adelante).
 * @returns {{info: Object, results: Array<Object>}|null} Página o null.
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
    return d && Array.isArray(d.results) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Escribe una página en ambas capas de caché.
 * @param {number} pagina - Nº de página.
 * @param {{info: Object, results: Array<Object>}} datos - Página a cachear.
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
      const paginaDatos = aPagina(datos);
      if (paginaDatos.results.length > 0) escribirCachePagina(pagina, paginaDatos);
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
    const encontrado = (d?.results || []).find((p) => String(p.id) === String(id));
    if (encontrado) return encontrado;
  }
  // 2) SessionStorage.
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const clave = sessionStorage.key(i);
      if (!clave?.startsWith(PREFIJO_CACHE)) continue;

      const { t, d } = JSON.parse(sessionStorage.getItem(clave) || '{}');
      if (Date.now() - t > TTL_MS) continue;

      const encontrado = (d?.results || []).find((p) => String(p.id) === String(id));
      if (encontrado) return encontrado;
    }
  } catch {
    /* cache corrupta => se ignora */
  }
  return null;
}

/* ----------------------------------------------------------------
 * Endpoints públicos
 * ---------------------------------------------------------------- */

/**
 * Obtiene una página con su metadata de paginación ({info, results}).
 * Sin filtros => caché SWR por página; con filtros => endpoint combinado
 * (sin caché). Todos los caminos pasan por rate-limit + timeout +
 * reintentos y conservan `error.status` en fallos reales.
 * @param {number} [pagina=1] - Nº de página (1 en adelante).
 * @param {{nombre?: string, estado?: string, especie?: string}} [filtros]
 * @returns {Promise<{info: Object, results: Array<Object>}>} Página traducida.
 * @throws {Error} Con `.status` HTTP si la API falla de verdad.
 */
export async function obtenerPagina(pagina = 1, filtros = {}) {
  const nombre = String(filtros.nombre || '').trim();
  const estado = String(filtros.estado || '');
  const especie = String(filtros.especie || '');

  /* ---- Con filtros: endpoint combinado (URLSearchParams = query segura) ---- */
  if (nombre || estado || especie) {
    const parametros = new URLSearchParams();
    // name/status/species: valores exactos que espera la API (case-insensitive).
    if (nombre) parametros.set('name', nombre);
    if (estado) parametros.set('status', estado);
    if (especie) parametros.set('species', especie);
    parametros.set('page', String(pagina));

    try {
      return aPagina(await pedirJson(`/character?${parametros.toString()}`));
    } catch (error) {
      // 404 = "sin coincidencias" (resultado vacío, no un fallo de sistema).
      if (error.status === 404) {
        return { info: { pages: 1, count: 0, next: null, prev: null }, results: [] };
      }
      throw error;
    }
  }

  /* ---- Sin filtros: caché stale-while-revalidate por página ---- */
  // 1) Memoria fresca => cero latencia.
  const enMemoria = memoriaPaginas.get(pagina);
  if (enMemoria && Date.now() - enMemoria.t <= TTL_MS) return enMemoria.d;

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

  // 4) Red (con rate limit + reintentos + timeout).
  const paginaDatos = aPagina(await pedirJson(`/character?page=${pagina}`));
  escribirCachePagina(pagina, paginaDatos);
  return paginaDatos;
}

/**
 * Obtiene un personaje por su id.
 * Primero consulta la caché de páginas (vuelven del catálogo sin red);
 * si no está, hace el fetch a la API.
 * @param {number|string} id - Id del personaje.
 * @returns {Promise<Object>} Personaje completo.
 * @throws {Error} Con `.status` HTTP (404 = id inexistente) u otro fallo.
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
  const personajeCrudo = await pedirJson(`/character/${idLimpio}`);
  return traducirPersonaje(personajeCrudo);
}
