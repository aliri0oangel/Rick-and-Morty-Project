/**
 * characters.js — Presentación del catálogo (Fase 2, refactor).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: traducir datos de la API a modelo de vista,
 * mantener el cache en memoria, pintar las cards en UNA grid dada y
 * montar la delegación de clics. NO crea estados (page-states.js), NO
 * define átomos (components.js) ni persiste favoritos (favorites-
 * repository.js) => SRP + bajo acoplamiento.
 *
 * Fase 2: la grid y el template ya NO son ids fijos del HTML; cada
 * página pasa SU nodo (inyección de dependencias) => cero ids
 * duplicados entre páginas.
 */

import { crearCardPersonaje, pintarBotonFavorito } from './components.js';

export { pintarBotonFavorito };

/* ----------------------------------------------------------------
 * Reveal on scroll (Fase 4 / T4.1) — UNA sola pasada por nodo.
 * El observer se crea una vez; cada card recién montada se observa y
 * se deja de observar al primer intersect (sin listeners permanentes).
 * Con reduced-motion el guard global aplana la transición a 0ms.
 * ---------------------------------------------------------------- */

/** Observer compartido (lazy: se crea al primer uso). */
let observadorReveal = null;

/**
 * Crea (una vez) el observer que añade .reveal-listo al entrar en vista.
 * @returns {IntersectionObserver|null} null si el entorno no lo soporta.
 */
function obtenerObservador() {
  if (observadorReveal) return observadorReveal;
  if (typeof IntersectionObserver === 'function') {
    observadorReveal = new IntersectionObserver(
      (entradas, obs) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add('reveal-listo');
          obs.unobserve(entrada.target); // una sola pasada
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
  }
  return observadorReveal;
}

/**
 * Marca nodos como observados para el reveal on scroll.
 * Sin IntersectionObserver (o si ya son visibles) => reveal inmediato:
 * NUNCA se deja contenido oculto a la espera del observer.
 * @param {Iterable<HTMLElement>} nodos - Cards recién montadas.
 * @returns {void}
 */
export function observarReveal(nodos) {
  const obs = obtenerObservador();
  for (const nodo of nodos) {
    if (!obs) {
      nodo.classList.add('reveal-listo');
      continue;
    }
    obs.observe(nodo);
  }
}

/* ----------------------------------------------------------------
 * Cache en memoria: id -> personaje crudo (para clics/favoritos)
 * Evita volver a pedir a la API cuando el usuario hace clic.
 * ---------------------------------------------------------------- */
const cachePersonajes = new Map();

/**
 * Registra personajes en el cache interno (reemplazando el anterior).
 * @param {Array<Object>} personajes - Datos crudos de la API.
 * @returns {void}
 */
export function guardarEnCache(personajes) {
  cachePersonajes.clear();
  for (const p of personajes) {
    cachePersonajes.set(String(p.id), p);
  }
}

/**
 * Consulta el cache por id.
 * @param {string|number} id - Id del personaje.
 * @returns {Object|undefined} Personaje crudo o undefined.
 */
export function delCache(id) {
  return cachePersonajes.get(String(id));
}

/* ----------------------------------------------------------------
 * Mapeo de datos crudos -> modelo de vista (función PURA)
 * ---------------------------------------------------------------- */

/**
 * Convierte un personaje ya traducido por la capa de servicio al formato
 * que necesita la card. NO vuelve a traducir: la traducción vive SOLO en
 * services/characters-api.js (evita la doble traducción que rompía badges).
 * @param {Object} p - Personaje procedente de la capa de servicio.
 * @returns {{id, nombre, imagen, alt, especie, meta, estado}}
 */
export function mapearPersonaje(p) {
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    imagen: p.image,
    alt: `Retrato de ${p.name || 'personaje'}`,
    especie: p.species || 'Desconocido',
    // Línea de meta: género + ubicación actual
    meta: `${p.gender || 'Desconocido'} · ${p.location?.name || 'Ubicación desconocida'}`,
    estado: p.status || 'Desconocido',
  };
}

/* ----------------------------------------------------------------
 * Render de cards (una sola inserción por lote)
 * ---------------------------------------------------------------- */

/**
 * Renderiza la lista completa dentro de la grid indicada usando
 * DocumentFragment (UNA inserción al DOM => un solo reflow).
 * La paginación SIEMPRE reemplaza: cache nuevo + grid limpia.
 * @param {HTMLElement} grid - Nodo grid de la página (inyectado).
 * @param {Array<Object>} personajes - Datos de la capa de servicio.
 * @param {(id) => boolean} esFavorito - Consulta inyectada (DIP).
 * @returns {number} Nº de cards pintadas en ESTA llamada.
 */
export function renderizarPersonajes(grid, personajes, esFavorito) {
  if (!grid) return 0;

  guardarEnCache(personajes);
  grid.replaceChildren();

  const fragmento = document.createDocumentFragment();
  for (const p of personajes) {
    const card = crearCardPersonaje(mapearPersonaje(p), esFavorito);
    // Reveal on scroll (T4.1): la card entra animada una sola vez.
    card.classList.add('reveal');
    fragmento.appendChild(card);
  }
  grid.appendChild(fragmento); // inserción única por lote

  // Observación del reveal de ESTE lote (one-shot por card).
  observarReveal(grid.querySelectorAll('.reveal:not(.reveal-listo)'));

  return personajes.length;
}

/* ----------------------------------------------------------------
 * Ordenamiento de listas (Fase 3 — T3.2)
 * Mapa OCP: añadir un criterio nuevo = una entrada nueva.
 * ---------------------------------------------------------------- */

/** Estado -> peso numérico para ordenar (vivo arriba).
 *  Acepta el valor ya traducido (Vivo/Muerto/Desconocido) y también el
 *  legado en inglés de favoritos guardados antes de unificar traducción. */
const PESO_ESTADO = {
  Vivo: 0,
  Alive: 0,
  Desconocido: 1,
  unknown: 1,
  Unknown: 1,
  Muerto: 2,
  Dead: 2,
};

const ORDENADORES = {
  // Orden natural de la API (ya cacheado): se respeta tal cual.
  api: () => 0,
  'nombre-asc': (a, b) => a.name.localeCompare(b.name, 'es'),
  'nombre-desc': (a, b) => b.name.localeCompare(a.name, 'es'),
  estado: (a, b) =>
    (PESO_ESTADO[a.status] ?? 3) - (PESO_ESTADO[b.status] ?? 3) ||
    a.name.localeCompare(b.name, 'es'),
};

/**
 * Ordena una copia de la lista según el criterio elegido.
 * @param {Array<Object>} personajes - Datos crudos.
 * @param {string} orden - Clave del mapa ORDENADORES.
 * @returns {Array<Object>} Nueva lista ordenada (no muta la original).
 */
export function ordenarPersonajes(personajes, orden) {
  const criterio = ORDENADORES[orden] || ORDENADORES.api;
  return [...personajes].sort(criterio);
}

/* ----------------------------------------------------------------
 * Delegación de eventos de la grid (DRY compartido)
 * ----------------------------------------------------------------
 * Una sola función reutilizada por index y favorites: decide si el
 * clic fue en el botón favorito o en la card, busca el personaje en
 * el cache y delega la decisión al controlador de cada página vía
 * callbacks (Dependency Inversion: este módulo no conoce favoritos.js
 * ni las rutas de navegación).
 * ---------------------------------------------------------------- */

/**
 * Registra el listener único de clics sobre la grid.
 * @param {HTMLElement} grid - Nodo grid (inyectado por la página).
 * @param {Object} callbacks
 * @param {(personaje: Object, boton: HTMLElement) => void} callbacks.alternarFavorito
 *        Se dispara al clicar ♥ (la página decide persistir y pintar).
 * @param {(personaje: Object) => void} callbacks.abrirPersonaje
 *        Se dispara al clicar la card (la página decide navegar).
 * @returns {void}
 */
export function montarGridDelegacion(grid, { alternarFavorito, abrirPersonaje }) {
  if (!grid) return;

  grid.addEventListener('click', (evento) => {
    // a) Botón favorito => callback y NO se navega.
    const botonFav = evento.target.closest('[data-favorito]');
    if (botonFav) {
      const card = botonFav.closest('article[data-id]');
      const personaje = card ? delCache(card.dataset.id) : undefined;
      if (personaje) alternarFavorito(personaje, botonFav);
      return;
    }

    // b) Cualquier otra zona de la card => abrir detalle.
    const card = evento.target.closest('article[data-id]');
    if (card) {
      const personaje = delCache(card.dataset.id);
      if (personaje) abrirPersonaje(personaje);
    }
  });
}

/* ----------------------------------------------------------------
 * Portal glow dinámico (T12.3) — UN listener delegado por grid:
 * --mx/--my solo en la card bajo el cursor, 1 escritura/frame
 * (throttle rAF) => coste constante por grid. En táctil o
 * reduced-motion no se monta (este módulo no conoce el CSS).
 * ---------------------------------------------------------------- */

/** matchMedia cacheado en el montaje (el cambio de preferencia en vivo
 *  se recoge en la siguiente carga de página; suficiente y sin listeners). */
let motionPermitido = null;

/**
 * ¿Conviene hacer tracking de cursor? (puntero real + movimiento permitido)
 * @returns {boolean}
 */
function hayPunteroConMotion() {
  if (motionPermitido === null) {
    motionPermitido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;
  }
  return motionPermitido;
}

/**
 * Monta el seguimiento de cursor para el portal glow de las cards.
 * No-op en dispositivos táctiles o con reduced-motion.
 * @param {HTMLElement} grid - Nodo grid de la página (inyectado).
 * @returns {void}
 */
export function montarSeguimientoCursor(grid) {
  if (!grid || !hayPunteroConMotion()) return;

  let pendiente = false;
  let ultimoEvento = null;

  grid.addEventListener('pointermove', (evento) => {
    ultimoEvento = evento;
    if (pendiente) return; // ya hay un frame en vuelo con este puntero
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const card = ultimoEvento.target.closest?.('article[data-id]');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${ultimoEvento.clientX - rect.left}px`);
      card.style.setProperty('--my', `${ultimoEvento.clientY - rect.top}px`);
    });
  });
}
