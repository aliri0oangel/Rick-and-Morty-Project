/**
 * catalog.js — Controlador de la página principal (Composición / Main Layer).
 * -------------------------------------------------------------------
 * Responsabilidad: ORQUESTAR. Conecta auth (sesión), api (datos),
 * zona de estados (page-states), cards (characters) y favoritos
 * sin que estos se conozcan entre sí (cada módulo es sustituible
 * aquí mismo: este archivo es el único que los compone).
 *
 * Funcionalidades (Fase 3 / T3.2):
 *  - Catálogo paginado (20 por página) con "Cargar más" + spinner.
 *  - Buscador por nombre con debounce + indicador visual de búsqueda.
 *  - Filtros estado/especie (endpoint combinado de la API) + orden
 *    client-side (mapa OCP en ui/characters.js).
 *  - Favoritos por usuario con reflejo inmediato + toast de feedback.
 *  - Navegación al detalle con clic en la card.
 */

import { rutaProtegida, idDeUsuario } from '../services/auth.js';
import { obtenerSesion } from '../core/storage.js';
import { obtenerPersonajes, buscarPersonajes } from '../services/characters-api.js';
import {
  renderizarPersonajes,
  montarGridDelegacion,
  pintarBotonFavorito,
  ordenarPersonajes,
} from '../ui/characters.js';
import { crearZonaPersonajes } from '../ui/page-states.js';
import { montarHeader } from '../ui/header.js';
import { mostrarToast } from '../ui/components.js';
import { navegar } from '../ui/view-transitions.js';
import { esFavorito, alternarFavorito } from '../services/favorites-repository.js';
import { RUTAS } from '../config/config.js';

/** Milisegundos de espera tras la última tecla antes de buscar (debounce). */
const DEBOUNCE_MS = 400;

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- Seguridad de rutas ---------------- */
  rutaProtegida();

  /* ---------------- Sesión + header unificado (T2.1) ---------------- */
  const sesion = obtenerSesion();
  const usuarioId = idDeUsuario(sesion);
  montarHeader({ sesion, activo: 'catalogo' });

  /* ---------------- Zona de estados (T2.3) ---------------- */
  // alReintentar usa una referencia diferida: cargar se define más abajo.
  const zona = crearZonaPersonajes({
    alReintentar: () => cargar({ reemplazar: true }),
  });
  document.getElementById('zona-catalogo')?.replaceWith(zona.nodo);

  /* ---------------- Elementos de la barra de herramientas ---------------- */
  const inputBuscar = document.getElementById('buscar');
  const formBusqueda = document.getElementById('form-busqueda');
  const btnLimpiar = document.getElementById('btn-limpiar');
  const selEstado = document.getElementById('filtro-estado');
  const selEspecie = document.getElementById('filtro-especie');
  const selOrden = document.getElementById('orden');
  const indicadorBusqueda = document.getElementById('indicador-busqueda');
  const contenedorMas = document.getElementById('contenedor-cargar-mas');
  const btnCargarMas = document.getElementById('btn-cargar-mas');

  /* ---------------- Estado del controlador ---------------- */
  let paginaActual = 1; // última página pedida a la API
  let listaCargada = []; // datos crudos acumulados (base para ordenar)
  let relojBusqueda = null; // timer del debounce
  let secuencia = 0; // token anti-respuestas-obsoletas
  let cargandoPagina = false; // bloqueo doble clic en "Cargar más"

  /* --------------------------------------------------------------
   * Consulta de favoritos inyectada al render (Dependency Inversion)
   * -------------------------------------------------------------- */
  const consultaFavorito = (id) => esFavorito(usuarioId, id);

  /**
   * Lee el estado actual de la barra de herramientas.
   * @returns {{nombre: string, estado: string, especie: string}}
   */
  const leerFiltros = () => ({
    nombre: inputBuscar?.value.trim() || '',
    estado: selEstado?.value || '',
    especie: selEspecie?.value || '',
  });

  /**
   * ¿Hay algún filtro activo (texto o selects)?
   * @returns {boolean}
   */
  const hayFiltros = () => {
    const f = leerFiltros();
    return Boolean(f.nombre || f.estado || f.especie);
  };

  /**
   * Muestra u oculta el botón de limpiar (solo con filtros activos).
   * @returns {void}
   */
  const actualizarBotonLimpiar = () => {
    btnLimpiar?.classList.toggle('hidden', !hayFiltros());
  };

  /**
   * Muestra u oculta el spinner inline del buscador.
   * @param {boolean} visible
   * @returns {void}
   */
  const mostrarSpinnerBusqueda = (visible) => {
    indicadorBusqueda?.classList.toggle('hidden', !visible);
    formBusqueda?.setAttribute('aria-busy', String(visible));
  };

  /**
   * Muestra u oculta el bloque "Cargar más".
   * @param {boolean} visible
   * @returns {void}
   */
  const mostrarCargarMas = (visible) => {
    contenedorMas?.classList.toggle('hidden', !visible);
  };

  /**
   * Pinta el indicador de conteo + descripción de filtros activos.
   * @returns {void}
   */
  const pintarIndicador = () => {
    const contenedor = document.getElementById('indicador-lista');
    if (!contenedor) return;
    const total = listaCargada.length;
    const f = leerFiltros();
    const partes = [`Mostrando ${total} personajes`];
    if (f.estado) partes.push(`estado=${f.estado}`);
    if (f.especie) partes.push(`especie=${f.especie}`);
    contenedor.textContent = partes.join(' · ');
  };

  /**
   * Repinta la grid desde la lista cargada aplicando el orden actual.
   * (El orden es client-side: cero peticiones extra a la API.)
   * @returns {void}
   */
  const pintarGrid = () => {
    const orden = selOrden?.value || 'api';
    renderizarPersonajes(zona.grid, ordenarPersonajes(listaCargada, orden), consultaFavorito);
  };

  /* ==============================================================
   * 1) CARGA UNIFICADA — página 1 (reemplazo) o siguientes (append)
   * ============================================================== */

  /**
   * Trae una página (con o sin filtros) y pinta la UI correspondiente.
   * Los filtros de estado/especie van al endpoint de la API (combinables
   * con name y page); sin filtros se usa la caché de páginas intacta.
   * @param {{reemplazar?: boolean}} [opciones]
   * @returns {Promise<void>}
   */
  async function cargar({ reemplazar = false } = {}) {
    const miSecuencia = ++secuencia; // descarta respuestas obsoletas
    const pagina = reemplazar ? 1 : paginaActual + 1;
    const filtros = leerFiltros();

    if (reemplazar) {
      listaCargada = [];
      paginaActual = 1;
      zona.pintarSkeletons(8);
      zona.mostrar('cargando');
      mostrarCargarMas(false);
    }

    try {
      // Sin filtros => endpoint crudo con caché de sessionStorage.
      const nuevos = hayFiltros()
        ? await buscarPersonajes({ ...filtros, pagina: reemplazar ? 1 : pagina })
        : await obtenerPersonajes(pagina);

      if (miSecuencia !== secuencia) return; // otra carga lo adelantó

      if (reemplazar && nuevos.length === 0) {
        const hayTexto = Boolean(filtros.nombre);
        zona.setVacio(
          hayTexto ? 'Sin resultados' : 'El universo está vacío',
          hayTexto
            ? `No hay personajes que coincidan con "${filtros.nombre}".`
            : 'La API no devolvió personajes. Intenta de nuevo más tarde.',
          { ilustracion: 'busqueda' }
        );
        return;
      }

      if (!reemplazar && nuevos.length === 0) {
        // Fin de la lista (última página o fin de resultados filtrados).
        mostrarCargarMas(false);
        return;
      }

      if (reemplazar) {
        listaCargada = nuevos;
      } else {
        listaCargada = [...listaCargada, ...nuevos];
        paginaActual = pagina;
      }

      pintarGrid();
      zona.mostrar('grid');
      mostrarCargarMas(true);
      pintarIndicador();
    } catch (error) {
      if (miSecuencia !== secuencia) return;
      console.error('[index] Error cargando personajes:', error);
      // 404 al paginar = fin natural de la lista, no un error.
      if (!reemplazar && error.status === 404) {
        mostrarCargarMas(false);
        return;
      }
      if (!reemplazar && listaCargada.length > 0) {
        // No perder lo ya cargado: se avisa en el indicador.
        const indicador = document.getElementById('indicador-lista');
        if (indicador) {
          indicador.textContent = 'No se pudieron cargar más personajes. Intenta de nuevo.';
        }
        return;
      }
      zona.setError(error.message || 'Error desconocido al cargar.');
    } finally {
      if (miSecuencia === secuencia) mostrarSpinnerBusqueda(false);
    }
  }

  /* ==============================================================
   * 2) CARGAR MÁS (paginación 20 en 20, con filtros incluidos)
   * ============================================================== */
  btnCargarMas?.addEventListener('click', async () => {
    if (cargandoPagina) return; // bloqueo doble clic
    cargandoPagina = true;
    btnCargarMas.disabled = true;
    btnCargarMas.classList.add('opacity-50', 'cursor-not-allowed');
    // Spinner inline + texto: feedback de progreso visible (T3.2).
    btnCargarMas.innerHTML =
      '<span class="inline-flex items-center gap-2"><svg class="w-4 h-4 animate-spin" aria-hidden="true"><use href="#icon-loader"/></svg>Cargando…</span>';

    try {
      await cargar();
    } finally {
      cargandoPagina = false;
      btnCargarMas.disabled = false;
      btnCargarMas.classList.remove('opacity-50', 'cursor-not-allowed');
      btnCargarMas.textContent = 'Cargar más';
    }
  });

  /* ==============================================================
   * 3) BUSCADOR + FILTROS + ORDEN (T3.2)
   * ============================================================== */

  // Debounce: solo busca 400ms DESPUÉS de que el usuario deja de escribir
  // (evita una petición a la API por cada tecla pulsada). El spinner
  // aparece YA al teclear (feedback visual de inmediatez, sin animar).
  inputBuscar?.addEventListener('input', () => {
    mostrarSpinnerBusqueda(true);
    actualizarBotonLimpiar();
    clearTimeout(relojBusqueda);
    relojBusqueda = setTimeout(() => cargar({ reemplazar: true }), DEBOUNCE_MS);
  });

  // Enter en el input => búsqueda inmediata (sin esperar el debounce).
  formBusqueda?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    clearTimeout(relojBusqueda);
    mostrarSpinnerBusqueda(true);
    cargar({ reemplazar: true });
  });

  // Cambios en los selects => recarga inmediata con los filtros de la API.
  for (const select of [selEstado, selEspecie]) {
    select?.addEventListener('change', () => {
      actualizarBotonLimpiar();
      cargar({ reemplazar: true });
    });
  }

  // Cambio de orden => solo re-pinta la lista YA cargada (sin red).
  selOrden?.addEventListener('change', pintarGrid);

  // "Limpiar todo" => resets de la barra + vuelta al catálogo completo.
  btnLimpiar?.addEventListener('click', () => {
    clearTimeout(relojBusqueda);
    if (inputBuscar) inputBuscar.value = '';
    if (selEstado) selEstado.value = '';
    if (selEspecie) selEspecie.value = '';
    if (selOrden) selOrden.value = 'api';
    actualizarBotonLimpiar();
    cargar({ reemplazar: true });
  });

  /* ==============================================================
   * 4) EVENTOS DE LA GRID (delegación compartida con favorites)
   * ============================================================== */
  montarGridDelegacion(zona.grid, {
    // ♥ => alternar favorito, reflejar el estado y avisar con toast.
    alternarFavorito: (personaje, boton) => {
      if (!sesion) return;

      const { estado, guardado } = alternarFavorito(usuarioId, personaje);

      if (!guardado) {
        // Storage bloqueado/lleno: se revierte el reflejo visual.
        console.warn('[favoritos] No se pudo persistir el cambio.');
        pintarBotonFavorito(boton, !estado);
        mostrarToast('No se pudo guardar el cambio de favorito.', 'error');
        return;
      }
      pintarBotonFavorito(boton, estado);
      mostrarToast(
        estado
          ? `${personaje.name} añadido a favoritos`
          : `${personaje.name} eliminado de favoritos`
      );
    },

    // Clic en la card => navegar al detalle (?id=) con View Transitions.
    abrirPersonaje: (personaje) => {
      navegar(`${RUTAS.detalle}?id=${encodeURIComponent(personaje.id)}`);
    },
  });

  /* ---------------- Arranque ---------------- */
  actualizarBotonLimpiar();
  cargar({ reemplazar: true });
});
