/**
 * page-states.js — Zona reutilizable de estados de lista (Fase 2 / PLAN.md T2.3).
 * -------------------------------------------------------------------
 * Contenedor autocontenido que expone los CUATRO estados del flujo
 * catálogo/favoritos (cargando · error · vacío · grid) sin ids fijos
 * en el HTML: cada página monta SU instancia => cero duplicación de
 * ids entre páginas (aceptación de Fase 2).
 *
 * Accesibilidad (T2.3 — hoy los errores no se anunciaban):
 *  - cargando: aria-live="polite" + aria-busy conmutado.
 *  - error:    role="alert" (anuncio inmediato).
 *  - vacío:    aria-live="polite".
 *  - grid:     región normal (el contenido ya es navegable).
 */

import { crearSkeletonCard, crearEstadoVacio, crearEstadoError } from './components.js';

/** Clases de grid responsive compartidas por cargando y grid real. */
const CLASES_GRID = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-6';

/**
 * Crea la zona de estados y su API de control.
 * @param {Object} [opciones]
 * @param {() => void} [opciones.alReintentar] - Callback del botón "Reintentar"
 *        (si no se pasa, el error se muestra sin acción).
 * @returns {{nodo: HTMLElement, grid: HTMLElement,
 *            mostrar: (tipo: 'cargando'|'error'|'vacio'|'grid') => void,
 *            pintarSkeletons: (n?: number) => void,
 *            setError: (mensaje?: string, extras?: Object) => void,
 *            setVacio: (titulo?: string, mensaje?: string) => void}}
 */
export function crearZonaPersonajes({ alReintentar } = {}) {
  const nodo = document.createElement('div');

  // Estructura interna: un nodo por estado, mutuamente excluyentes.
  nodo.innerHTML = `
    <div data-zona="cargando" class="hidden ${CLASES_GRID}" aria-live="polite" aria-busy="false"></div>
    <div data-zona="error" class="hidden pt-10" role="alert"></div>
    <div data-zona="vacio" class="hidden" aria-live="polite"></div>
    <div data-zona="grid" class="hidden ${CLASES_GRID}"></div>`;

  const zonas = {
    cargando: nodo.querySelector('[data-zona="cargando"]'),
    error: nodo.querySelector('[data-zona="error"]'),
    vacio: nodo.querySelector('[data-zona="vacio"]'),
    grid: nodo.querySelector('[data-zona="grid"]'),
  };

  /**
   * Muestra UN solo estado y oculta los demás.
   * (M1: la animación de entrada de zonas se eliminó — sin subidas
   * fuera de las cards; aquí solo se gestiona la visibilidad.)
   * @param {'cargando'|'error'|'vacio'|'grid'} cual
   * @returns {void}
   */
  const mostrar = (cual) => {
    for (const [nombre, zona] of Object.entries(zonas)) {
      zona.classList.toggle('hidden', nombre !== cual);
    }
    zonas.cargando.setAttribute('aria-busy', String(cual === 'cargando'));
  };

  /**
   * Pinta N skeletons de tarjeta en la zona de carga.
   * @param {number} [cantidad=8]
   * @returns {void}
   */
  const pintarSkeletons = (cantidad = 8) => {
    // Fragment: una sola inserción al DOM por lote (menos reflows).
    const fragmento = document.createDocumentFragment();
    for (let i = 0; i < cantidad; i++) {
      fragmento.appendChild(crearSkeletonCard());
    }
    zonas.cargando.replaceChildren(fragmento);
  };

  /**
   * Compone y muestra el estado de error (con acción opcional).
   * @param {string} [mensaje]
   * @param {{titulo?: string, textoAccion?: string, alAccion?: () => void}} [extras]
   * @returns {void}
   */
  const setError = (mensaje, extras = {}) => {
    zonas.error.replaceChildren(
      crearEstadoError({
        titulo: extras.titulo || 'No se pudieron cargar los personajes',
        mensaje,
        textoAccion: extras.textoAccion || (alReintentar ? 'Reintentar' : undefined),
        alAccion: extras.alAccion || alReintentar,
      })
    );
    mostrar('error');
  };

  /**
   * Compone y muestra el estado vacío (ilustración opcional, Fase 3).
   * @param {string} [titulo]
   * @param {string} [mensaje]
   * @param {{ilustracion?: 'favoritos'|'busqueda'}} [extras]
   * @returns {void}
   */
  const setVacio = (titulo, mensaje, extras = {}) => {
    zonas.vacio.replaceChildren(crearEstadoVacio({ titulo, mensaje, ...extras }));
    mostrar('vacio');
  };

  return { nodo, grid: zonas.grid, mostrar, pintarSkeletons, setError, setVacio };
}
