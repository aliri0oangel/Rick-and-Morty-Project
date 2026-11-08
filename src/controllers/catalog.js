/**
 * catalog.js — Controlador de la página principal (Composición / Main Layer).
 * -------------------------------------------------------------------
 * Responsabilidad: ORQUESTAR. Conecta auth (sesión), api (datos),
 * zona de estados (page-states), cards (characters) y favoritos
 * sin que estos se conozcan entre sí (cada módulo es sustituible
 * aquí mismo: este archivo es el único que los compone).
 *
 * Funcionalidades (Fase 3 / T3.2):
 *  - Catálogo paginado por páginas (20 por página) con controles numéricos.
 *  - Buscador por nombre con debounce + indicador visual de búsqueda.
 *  - Filtros estado/especie (endpoint combinado de la API) + orden
 *    client-side (mapa OCP en ui/characters.js).
 *  - Favoritos por usuario con reflejo inmediato + toast de feedback.
 *  - Navegación al detalle con clic en la card.
 */

import { rutaProtegida, idDeUsuario } from '../services/auth.js';
import { obtenerSesion } from '../core/storage.js';
import { obtenerPagina } from '../services/characters-api.js';
import {
  renderizarPersonajes,
  montarGridDelegacion,
  montarSeguimientoCursor,
  pintarBotonFavorito,
  ordenarPersonajes,
} from '../ui/characters.js';
import { crearZonaPersonajes } from '../ui/page-states.js';
import { montarHeader } from '../ui/header.js';
import { montarFooter } from '../ui/footer.js';
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
  const contenedorPaginacion = document.getElementById('contenedor-paginacion');
  const controlesPaginacion = document.getElementById('paginacion-controles');
  const infoPaginacion = document.getElementById('paginacion-info');
  const btnSubirInicio = document.getElementById('btn-subir-inicio');

  /* ---------------- Estado del controlador ---------------- */
  let paginaActual = 1; // página actual activa
  let totalPaginas = 1; // total de páginas según la API
  let listaCargada = []; // datos crudos acumulados (base para ordenar)
  let relojBusqueda = null; // timer del debounce
  let secuencia = 0; // token anti-respuestas-obsoletas
  let cargandoPagina = false; // bloqueo para evitar peticiones duplicadas

  /* ---------------- Implementación del botón Subir al Inicio ---------------- */
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btnSubirInicio?.classList.add('visible');
      btnSubirInicio?.classList.remove('pointer-events-none');
    } else {
      btnSubirInicio?.classList.remove('visible');
      btnSubirInicio?.classList.add('pointer-events-none');
    }
  });

  btnSubirInicio?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------------- Cursor pointer en interactivos ---------------- */
  const interactivos = [selEstado, selEspecie, selOrden, btnLimpiar];
  interactivos.forEach((el) => {
    if (el) el.style.cursor = 'pointer';
  });

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
   * Muestra u oculta el bloque de paginación.
   * @param {boolean} visible
   * @returns {void}
   */
  const mostrarPaginacion = (visible) => {
    contenedorPaginacion?.classList.toggle('hidden', !visible);
  };

  /**
   * Renderiza los botones de navegación de página.
   * @returns {void}
   */
  const renderizarPaginacion = () => {
    if (!controlesPaginacion) return;
    controlesPaginacion.innerHTML = '';

    // Botón Anterior (type=button: nunca envía/recrea el formulario)
    const btnAnt = document.createElement('button');
    btnAnt.type = 'button';
    btnAnt.className = `btn btn-ghost ${paginaActual === 1 ? 'opacity-50 pointer-events-none' : ''}`;
    btnAnt.textContent = '← Anterior';
    btnAnt.disabled = paginaActual === 1;
    // El aria-label SIEMPRE contiene el texto visible (WCAG 2.5.3:
    // label-content-name-mismatch lo marca como "serious" en axe).
    btnAnt.setAttribute('aria-label', `← Anterior (página ${Math.max(1, paginaActual - 1)})`);
    btnAnt.onclick = () => cargar({ pagina: paginaActual - 1 });
    controlesPaginacion.appendChild(btnAnt);

    // Números de página (mostramos un rango para no saturar la UI)
    const rango = 2;
    for (let i = 1; i <= totalPaginas; i++) {
      if (
        i === 1 ||
        i === totalPaginas ||
        (i >= paginaActual - rango && i <= paginaActual + rango)
      ) {
        const btnPag = document.createElement('button');
        btnPag.type = 'button';
        btnPag.className = `btn ${paginaActual === i ? 'btn-primary' : 'btn-ghost'}`;
        btnPag.textContent = i;
        btnPag.disabled = paginaActual === i;
        btnPag.setAttribute('aria-label', `Ir a la página ${i}`);
        if (paginaActual === i) btnPag.setAttribute('aria-current', 'page');
        btnPag.onclick = () => cargar({ pagina: i });
        controlesPaginacion.appendChild(btnPag);
      } else if (i === paginaActual - rango - 1 || i === paginaActual + rango + 1) {
        const span = document.createElement('span');
        span.textContent = '...';
        span.className = 'px-2 text-dim';
        controlesPaginacion.appendChild(span);
      }
    }

    // Botón Siguiente
    const btnSig = document.createElement('button');
    btnSig.type = 'button';
    btnSig.className = `btn btn-ghost ${paginaActual === totalPaginas ? 'opacity-50 pointer-events-none' : ''}`;
    btnSig.textContent = 'Siguiente →';
    btnSig.disabled = paginaActual === totalPaginas;
    btnSig.setAttribute(
      'aria-label',
      `Siguiente → (página ${Math.min(totalPaginas, paginaActual + 1)})`
    );
    btnSig.onclick = () => cargar({ pagina: paginaActual + 1 });
    controlesPaginacion.appendChild(btnSig);

    if (infoPaginacion) {
      infoPaginacion.textContent = `Terminal: Página ${paginaActual} de ${totalPaginas}`;
    }
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
   * 1) CARGA UNIFICADA — página 1 (reemplazo) o cualquier página
   * ============================================================== */

  /**
   * Trae una página (con o sin filtros) y pinta la UI correspondiente.
   * Los filtros de estado/especie van al endpoint de la API (combinables
   * con name y page); sin filtros se usa la caché de páginas intacta.
   * @param {{reemplazar?: boolean, pagina?: number}} [opciones]
   * @returns {Promise<void>}
   */
  async function cargar({ reemplazar = false, pagina = null } = {}) {
    // Bloqueo de doble clic: solo UNA petición de página en vuelo.
    if (!reemplazar && cargandoPagina) return;

    const miSecuencia = ++secuencia; // descarta respuestas obsoletas

    // Determinamos qué página pedir
    let paginaAPedir;
    if (pagina !== null) {
      paginaAPedir = pagina;
    } else if (reemplazar) {
      paginaAPedir = 1;
    } else {
      paginaAPedir = paginaActual + 1;
    }

    const filtros = leerFiltros();

    if (reemplazar) {
      listaCargada = [];
      paginaActual = 1;
      zona.pintarSkeletons(8);
      zona.mostrar('cargando');
      mostrarPaginacion(false);
    }

    cargandoPagina = true; // se libera en finally (solo el dueño de la petición)
    try {
      const { info, results } = await obtenerPagina(paginaAPedir, filtros);

      if (miSecuencia !== secuencia) return; // otra carga lo adelantó

      const nuevos = results;
      totalPaginas = Math.max(1, Number(info?.pages) || 1);

      if (reemplazar && nuevos.length === 0) {
        const hayTexto = Boolean(filtros.nombre);
        zona.setVacio(
          hayTexto ? 'Sin resultados' : 'El universo está vacío',
          hayTexto
            ? `No hay personajes que coincidan con "${filtros.nombre}".`
            : 'La API no devolvió personajes. Intenta de nuevo más tarde.',
          {
            ilustracion: 'busqueda',
            // T12.1: CTA contextual — la salida más directa de cada vacío
            // (limpiar filtros si buscaba; reintentar si la API vino vacía).
            acciones: [
              hayTexto
                ? { texto: 'Limpiar búsqueda y filtros', alClic: limpiarFiltros }
                : { texto: 'Reintentar', alClic: () => cargar({ reemplazar: true }) },
            ],
          }
        );
        return;
      }

      if (!reemplazar && nuevos.length === 0) {
        mostrarPaginacion(false);
        return;
      }

      // La paginación reemplaza la página mostrada (sin acumular).
      listaCargada = nuevos;
      paginaActual = paginaAPedir;

      pintarGrid();
      zona.mostrar('grid');
      mostrarPaginacion(true);
      renderizarPaginacion();
      pintarIndicador();

      // UX: scroll al grid SOLO al paginar; la primera pintura respeta el hero.
      if (paginaAPedir > 1) {
        zona.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      if (miSecuencia !== secuencia) return;
      console.error('[index] Error cargando personajes:', error);
      // 404 de negocio fuera de la primera página: fin de lista, no error.
      if (!reemplazar && error.status === 404) {
        mostrarPaginacion(false);
        return;
      }
      if (!reemplazar && listaCargada.length > 0) {
        const indicador = document.getElementById('indicador-lista');
        if (indicador) {
          indicador.textContent = 'No se pudieron cargar más personajes. Intenta de nuevo.';
        }
        return;
      }
      zona.setError(error.message || 'Error desconocido al cargar.');
    } finally {
      // Solo el dueño actual de la petición libera el bloqueo.
      if (miSecuencia === secuencia) {
        cargandoPagina = false;
        mostrarSpinnerBusqueda(false);
      }
    }
  }

  /* ==============================================================
   * 2) BUSCADOR + FILTROS + ORDEN (T3.2)
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

  /**
   * Limpia la barra de herramientas y recarga el catálogo completo.
   * T12.1: extraído del listener de #btn-limpiar para REUTILIZARSE
   * desde el CTA del estado vacío "Sin resultados" (misma acción, un
   * solo camino => DRY).
   * @returns {void}
   */
  const limpiarFiltros = () => {
    clearTimeout(relojBusqueda);
    if (inputBuscar) inputBuscar.value = '';
    if (selEstado) selEstado.value = '';
    if (selEspecie) selEspecie.value = '';
    if (selOrden) selOrden.value = 'api';
    actualizarBotonLimpiar();
    cargar({ reemplazar: true });
  };

  // "Limpiar todo" => resets de la barra + vuelta al catálogo completo.
  btnLimpiar?.addEventListener('click', limpiarFiltros);

  /* ==============================================================
   * 3) EVENTOS DE LA GRID (delegación compartida con favorites)
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
  // Portal glow dinámico (T12.3): seguimiento de cursor delegado en la grid.
  montarSeguimientoCursor(zona.grid);
  actualizarBotonLimpiar();
  cargar({ reemplazar: true });
  montarFooter(document.getElementById('contenido'));
});
