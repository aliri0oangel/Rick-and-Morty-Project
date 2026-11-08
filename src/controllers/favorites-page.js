/**
 * favorites-page.js — Controlador de la página de favoritos (Composición).
 * -------------------------------------------------------------------
 * Responsabilidad: pintar SOLO los favoritos del usuario en sesión,
 * leyéndolos de LocalStorage (sin hacer ninguna petición a la API).
 *
 * Reutiliza los MISMOS componentes que el catálogo (zona de estados,
 * cards, delegación, header): la diferencia está en los CALLBACKS y
 * en la fuente de datos (LS en lugar de API).
 */

import { rutaProtegida, idDeUsuario } from '../services/auth.js';
import { obtenerSesion } from '../core/storage.js';
import {
  renderizarPersonajes,
  montarGridDelegacion,
  montarSeguimientoCursor,
  pintarBotonFavorito,
} from '../ui/characters.js';
import { crearZonaPersonajes } from '../ui/page-states.js';
import { montarHeader } from '../ui/header.js';
import { mostrarToast, retirarCardAnimada } from '../ui/components.js';
import { navegar } from '../ui/view-transitions.js';
import { obtenerFavoritos, alternarFavorito } from '../services/favorites-repository.js';
import { RUTAS } from '../config/config.js';

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- Seguridad de rutas ---------------- */
  rutaProtegida();

  const sesion = obtenerSesion();
  const usuarioId = idDeUsuario(sesion);

  /* ---------------- Header unificado (T2.1) ---------------- */
  montarHeader({ sesion, activo: 'favoritos' });

  /* ---------------- Zona de estados (T2.3) ---------------- */
  const zona = crearZonaPersonajes();
  document.getElementById('zona-favoritos')?.replaceWith(zona.nodo);

  /**
   * Muestra el estado vacío con la ilustración CRT de favoritos (T3.3)
   * y su CTA "Explorar catálogo" (T12.1: la salida natural del vacío).
   * @returns {void}
   */
  const mostrarVacio = () =>
    zona.setVacio(
      'Aún no tienes favoritos',
      'Haz clic en el ícono ♥ de cualquier personaje del catálogo.',
      {
        ilustracion: 'favoritos',
        acciones: [{ texto: 'Explorar catálogo', alClic: () => navegar(RUTAS.index) }],
      }
    );

  /* ---------------- Pintado inicial desde LocalStorage ---------------- */

  /**
   * Carga la lista de favoritos del usuario y pinta el estado oportuno.
   * @returns {number} Nº de favoritos pintados.
   */
  function pintarFavoritos() {
    // Fuente de datos: LS del USUARIO ACTUAL (aislamiento por clave).
    const favoritos = obtenerFavoritos(usuarioId);

    if (favoritos.length === 0) {
      // Texto propio de ESTA página (no el genérico del catálogo).
      mostrarVacio();
      return 0;
    }

    renderizarPersonajes(
      zona.grid,
      favoritos,
      () => true // en ESTA página todas las cards son favoritas
    );
    zona.mostrar('grid');
    return favoritos.length;
  }

  pintarFavoritos();

  /* ---------------- Eventos de la grid (delegación compartida) ------- */
  montarGridDelegacion(zona.grid, {
    // ♥ => alternar. Si dejó de ser favorito, la card SE RETIRA de aquí
    // con transición suave (T3.3; inmediata bajo reduced-motion).
    alternarFavorito: (personaje, boton) => {
      if (!sesion) return;

      const { estado, guardado } = alternarFavorito(usuarioId, personaje);

      if (!guardado) {
        console.warn('[favoritos] No se pudo persistir el cambio.');
        pintarBotonFavorito(boton, !estado);
        mostrarToast('No se pudo guardar el cambio de favorito.', 'error');
        return;
      }

      if (!estado) {
        // Se quitó de favoritos: aquí la card deja de tener sentido.
        const card = boton.closest('article[data-id]');
        mostrarToast(`${personaje.name} eliminado de favoritos`);
        retirarCardAnimada(card).then(() => {
          // Tras la animación: si ya no queda ninguna => estado vacío.
          const quedan = zona.grid.querySelectorAll('article[data-id]').length;
          if (quedan === 0) mostrarVacio();
        });
      } else {
        // Caso raro (re-agregar): solo se refleja en el ícono.
        pintarBotonFavorito(boton, estado);
        mostrarToast(`${personaje.name} añadido a favoritos`);
      }
    },

    // Clic en la card => mismo detalle que desde el catálogo (VT si hay soporte).
    abrirPersonaje: (personaje) => {
      navegar(`${RUTAS.detalle}?id=${encodeURIComponent(personaje.id)}`);
    },
  });

  // Portal glow dinámico (T12.3): mismo seguimiento que el catálogo.
  montarSeguimientoCursor(zona.grid);
});
