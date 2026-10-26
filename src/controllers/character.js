/**
 * character.js — Controlador de la página de detalle (Composición).
 * -------------------------------------------------------------------
 * Responsabilidad: ORQUESTAR la vista de detalle de UN personaje:
 * leer el id de la URL, pedirlo a la API, pintar sus datos ampliados
 * y gestionar su botón de favorito. Reutiliza las piezas existentes
 * (auth, api, favoritos) y los NUEVOS componentes (header, badge,
 * FavoriteButton, skeletons, ErrorState) sin duplicar lógica (DRY).
 *
 * Estados visuales (mismo patrón que el catálogo):
 *   detalle-cargando -> detalle | detalle-error
 */

import { rutaProtegida, idDeUsuario } from '../services/auth.js';
import { obtenerSesion } from '../core/storage.js';
import { obtenerPersonaje } from '../services/characters-api.js';
import {
  crearBadgeEstado,
  crearBotonFavorito,
  pintarBotonFavorito,
  crearSkeletonDetalle,
  crearEstadoError,
  mostrarToast,
} from '../ui/components.js';
import { icono } from '../ui/icons.js';
import { montarHeader } from '../ui/header.js';
import { esFavorito, alternarFavorito } from '../services/favorites-repository.js';
import { RUTAS } from '../config/config.js';

/* ----------------------------------------------------------------
 * Utilidades locales de esta página (SRP: vistas sin dependencias)
 * ---------------------------------------------------------------- */

/**
 * Muestra UN estado del detalle y oculta los demás.
 * Al mostrar el detalle completo aplica el "portal" de entrada (T4.2:
 * 150ms, no bloquea el contenido — reduced-motion lo aplana a 0ms).
 * @param {"cargando"|"error"|"detalle"} cual - Estado a mostrar.
 * @returns {void}
 */
function mostrarEstadoDetalle(cual) {
  const estados = {
    cargando: document.getElementById('detalle-cargando'),
    error: document.getElementById('detalle-error'),
    detalle: document.getElementById('detalle'),
  };

  for (const [nombre, nodo] of Object.entries(estados)) {
    if (!nodo) continue;
    nodo.classList.toggle('hidden', nombre !== cual);
  }

  // Re-trigger del portal al entrar en el detalle.
  if (cual === 'detalle' && estados.detalle) {
    estados.detalle.classList.remove('portal-entrada');
    void estados.detalle.offsetWidth;
    estados.detalle.classList.add('portal-entrada');
  }
}

/**
 * Compone el estado de error del detalle (componente ErrorState).
 * @param {string} mensaje - Mensaje amigable.
 * @returns {void}
 */
function renderizarErrorDetalle(mensaje) {
  const contenedor = document.getElementById('detalle-error');
  if (contenedor) {
    contenedor.replaceChildren(
      crearEstadoError({
        titulo: 'No se pudo cargar el personaje',
        mensaje,
        textoAccion: 'Volver al catálogo',
        alAccion: () => {
          window.location.href = RUTAS.index;
        },
      })
    );
  }
  mostrarEstadoDetalle('error');
}

/**
 * Extrae y valida el id del personaje desde la query string.
 * Ejemplo: character.html?id=7 => "7"; ?id=abc => null (inválido).
 * @returns {string|null} Id limpio o null si no es válido.
 */
function leerIdDeLaUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || '').trim();

  // Solo dígitos: evita rutas raras hacia la API (validación de entrada).
  return /^\d+$/.test(id) ? id : null;
}

/** Nº máximo de chips de episodios visibles (el resto se resume). */
const MAX_CHIPS_EPISODIOS = 12;

/**
 * Pinta chips "EP###" a partir de las URLs del array `episode`.
 * El número se extrae del último segmento de la URL (sin fetch extra:
 * los datos ya vienen con el personaje => rendimiento, T3.4).
 * @param {HTMLElement} contenedor - Nodo destino de los chips.
 * @param {Array<string>} urls - URLs tipo .../episode/12.
 * @returns {void}
 */
function pintarEpisodios(contenedor, urls) {
  if (!contenedor) return;
  const lista = Array.isArray(urls) ? urls : [];
  const fragmento = document.createDocumentFragment();

  for (const url of lista.slice(0, MAX_CHIPS_EPISODIOS)) {
    const coincidencia = String(url).match(/\/(\d+)\s*$/);
    if (!coincidencia) continue;
    const chip = document.createElement('span');
    chip.className = 'badge'; // chip neutro (borde heredado, sin color de estado)
    chip.textContent = `EP${coincidencia[1].padStart(3, '0')}`;
    fragmento.appendChild(chip);
  }

  // Resumen honesto del resto (la lista completa es muy larga para la UI).
  const restantes = lista.length - MAX_CHIPS_EPISODIOS;
  if (restantes > 0) {
    const resumen = document.createElement('span');
    resumen.className = 'microcopy';
    resumen.textContent = `+${restantes} más`;
    fragmento.appendChild(resumen);
  }

  contenedor.replaceChildren(fragmento);
}

/* ----------------------------------------------------------------
 * Pintado del detalle
 * ---------------------------------------------------------------- */

/**
 * Rellena la plantilla de detalle con los datos del personaje.
 * @param {Object} p - Personaje crudo de la API.
 * @param {boolean} enFavoritos - Estado actual del favorito.
 * @param {HTMLElement} btnFavorito - Botón (componente) ya montado.
 * @returns {void}
 */
function pintarDetalle(p, enFavoritos, btnFavorito) {
  // --- Imagen grande (fade-in al cargar, T5.2; LCP con priority en HTML) ---
  const img = document.querySelector('#detalle [data-campo="imagen"]');
  img.classList.add('img-fade', 'opacity-0');
  img.onload = () => img.classList.remove('opacity-0');
  img.src = p.image;
  img.alt = `Retrato grande de ${p.name || 'personaje'}`;
  // Si venía de caché y ya está decodificada, no se espera al evento load.
  if (img.complete) img.classList.remove('opacity-0');

  // --- Textos (SIEMPRE textContent: datos externos => anti-XSS) ---
  const setText = (campo, valor) => {
    const nodo = document.querySelector(`#detalle [data-campo="${campo}"]`);
    if (nodo) nodo.textContent = valor;
  };

  setText('nombre', p.name || 'Sin nombre');
  setText('especie', p.species || 'Desconocida');
  setText('genero', p.gender || 'Desconocido');
  setText('origen', p.origin?.name || 'Desconocido');
  setText('ubicacion', p.location?.name || 'Desconocida');
  // Nº de episodios: el array `episode` trae un registro por episodio.
  setText('episodios', String(Array.isArray(p.episode) ? p.episode.length : 0));

  // Ficha tipo terminal: "#007 · expediente interdimensional" (T3.4).
  setText('ficha-id', `#${String(p.id).padStart(3, '0')} · expediente interdimensional`);

  // Nombre display + glitch (data-text alimenta los pseudo-elementos).
  const nodoNombre = document.querySelector('#detalle [data-campo="nombre"]');
  if (nodoNombre) nodoNombre.setAttribute('data-text', p.name || 'Sin nombre');

  // Chips de episodios: extraídos de las URLs, sin fetch adicional.
  pintarEpisodios(document.querySelector('#detalle [data-campo="episodios-chips"]'), p.episode);

  // --- Badge de estado: componente reutilizado (T2.2) ---
  document
    .querySelector('#detalle [data-campo="estado"]')
    ?.replaceChildren(crearBadgeEstado(p.status || 'unknown'));

  // --- JSON-LD Person (T6.3): el buscador recibe la entidad real ---
  // JSON.stringify + escape de "<": el dato externo jamás inyecta markup.
  const datosLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name || 'Sin nombre',
    description: `${p.status || ''} · ${p.species || ''} · ${p.gender || ''}`.trim(),
    image: p.image,
  };
  let scriptLd = document.getElementById('ld-personaje');
  if (!scriptLd) {
    scriptLd = document.createElement('script');
    scriptLd.type = 'application/ld+json';
    scriptLd.id = 'ld-personaje';
    document.head.appendChild(scriptLd);
  }
  scriptLd.textContent = JSON.stringify(datosLd).replace(/</g, '\\u003c');

  // --- Botón favorito: estado reflejado en el componente ---
  pintarBotonFavorito(btnFavorito, enFavoritos);
}

/* ----------------------------------------------------------------
 * Controlador
 * ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- Seguridad de rutas ---------------- */
  rutaProtegida();

  const sesion = obtenerSesion();
  const usuarioId = idDeUsuario(sesion);

  /* ---------------- Header unificado (T2.1) ---------------- */
  montarHeader({ sesion });

  /* ---------------- Estados del detalle (componentes) ---------------- */
  // Esqueleto de carga construido por JS (mismo aspecto que el card).
  document.getElementById('detalle-cargando')?.replaceChildren(crearSkeletonDetalle());

  // Copia local del personaje pintado (para alternar favorito sin re-fetch).
  let personajeActual = null;

  /**
   * Pide el personaje a la API y pinta el estado correspondiente.
   * @returns {Promise<void>}
   */
  async function cargarDetalle() {
    const id = leerIdDeLaUrl();

    // a) Id ausente o no numérico => error SIN llamar a la API.
    if (!id) {
      renderizarErrorDetalle('El identificador del personaje es inválido o falta en la URL.');
      return;
    }

    // b) Estado de carga inmediato.
    mostrarEstadoDetalle('cargando');

    try {
      const personaje = await obtenerPersonaje(id);
      personajeActual = personaje;

      // c) Pintar con el estado de favorito consultado a LS.
      const enFav = esFavorito(usuarioId, personaje.id);
      pintarDetalle(personaje, enFav, btnFavorito);
      mostrarEstadoDetalle('detalle');
    } catch (error) {
      // d) Id inexistente (404 de la API) o fallo de red/timeout.
      console.error('[detail] Error cargando detalle:', error);
      const noExiste = error.status === 404;
      renderizarErrorDetalle(noExiste ? 'Ese personaje no existe en la API.' : error.message);
    }
  }

  /* ---------------- Botón favorito del detalle (componente) ---------------- */
  // Se construye con crearBotonFavorito (icono SVG + aria-pressed) y se
  // monta el PRIMERO de la fila de acciones (junto a "Volver al catálogo").
  const btnFavorito = crearBotonFavorito({ activo: false, conTexto: true });
  const acciones = document.querySelector('#detalle [data-acciones]');
  acciones?.prepend(btnFavorito);

  btnFavorito.addEventListener('click', () => {
    if (!personajeActual || !sesion) return;

    const { estado, guardado } = alternarFavorito(usuarioId, personajeActual);

    if (!guardado) {
      // Storage bloqueado/lleno => revertir el reflejo visual.
      console.warn('[favoritos] No se pudo persistir el cambio.');
      pintarBotonFavorito(btnFavorito, !estado);
      mostrarToast('No se pudo guardar el cambio de favorito.', 'error');
      return;
    }

    // Reflejo inmediato: icono + etiqueta + toast de feedback.
    pintarBotonFavorito(btnFavorito, estado);
    mostrarToast(
      estado
        ? `${personajeActual.name} añadido a favoritos`
        : `${personajeActual.name} eliminado de favoritos`
    );
  });

  /* ---------------- Botón compartir (T3.4: navigator.share + fallback) -- */
  const btnCompartir = document.getElementById('btn-compartir');
  if (btnCompartir) {
    // Icono + etiqueta (string estático propio, sin datos externos).
    btnCompartir.innerHTML = `${icono('share', 'w-4 h-4')}<span>Compartir</span>`;
    btnCompartir.addEventListener('click', async () => {
      if (!personajeActual) return;
      const url = window.location.href;
      const titulo = `${personajeActual.name || 'Personaje'} · Web-Manual`;

      // 1) Web Share API (móvil/sistemas que la soportan).
      if (navigator.share) {
        try {
          await navigator.share({ title: titulo, url });
          return;
        } catch (error) {
          // Cancelar el sheet del SO NO es un error: no se hace fallback.
          if (error.name === 'AbortError') return;
          // TypeError/NotAllowed => se continúa al fallback de clipboard.
        }
      }

      // 2) Fallback: copiar el enlace al portapapeles + toast.
      try {
        await navigator.clipboard.writeText(url);
        mostrarToast('Enlace copiado al portapapeles');
      } catch {
        mostrarToast('No se pudo compartir ni copiar el enlace.', 'error');
      }
    });
  }

  /* ---------------- Volver con historial (T3.4) ---------------- */
  // Si se llegó desde otra página del mismo origen => history.back()
  // (conserva el scroll/estado del catálogo); si no, navegación directa.
  const btnVolver = document.getElementById('btn-volver');
  btnVolver?.addEventListener('click', (evento) => {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer && referrer.origin === window.location.origin) {
        evento.preventDefault();
        window.history.back();
      }
    } catch {
      /* referrer inválido => se sigue el href del anchor por defecto */
    }
  });

  /* ---------------- Arranque ---------------- */
  cargarDetalle();
});
