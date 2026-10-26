/**
 * view-transitions.js — Navegación con View Transitions API (Fase 4 / T4.4).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: envolver la navegación entre páginas en
 * document.startViewTransition() CUANDO el navegador lo soporta.
 * Sin soporte (o con prefers-reduced-motion) => navegación normal:
 * degradación elegante, cero riesgo funcional (feature-detect puro).
 *
 * Uso: mejorarEnlaces() parchea los clics en <a> del mismo origen;
 * navegar() queda para llamadas programáticas (cards del catálogo).
 */

/**
 * ¿Hay soporte útil de View Transitions para esta sesión?
 * @returns {boolean}
 */
function haySoporte() {
  return (
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Navega a una URL con transición suave si es posible.
 * @param {string} destino - URL relativa o absoluta del mismo origen.
 * @returns {void}
 */
export function navegar(destino) {
  if (!haySoporte()) {
    window.location.href = destino;
    return;
  }
  // Se protege por si el navegador aborta la transición (cierre pestaña).
  try {
    const transicion = document.startViewTransition(() => {
      window.location.href = destino;
    });
    // Evita uncaught rejection si el usuario navega antes del snapshot.
    transicion?.finished?.catch(() => {});
  } catch {
    window.location.href = destino;
  }
}

/**
 * Parchea TODOS los <a> del documento (mismo origen, sin target _blank,
 * sin modifier keys) para navegar con transición. Idempotente por nodo
 * (marca data-vt="1").
 * @param {ParentNode} [raiz=document] - Ámbito a mejorar.
 * @returns {void}
 */
export function mejorarEnlaces(raiz = document) {
  raiz.addEventListener('click', (evento) => {
    if (!haySoporte()) return;
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

    const enlace = evento.target.closest('a[href]');
    if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return;

    const url = new URL(enlace.href, window.location.href);
    // Solo mismo origen y navegación REAL de página (no hashes ni self).
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return; // mismo documento (anclas tipo skip-link, #seccion, etc.)
    }

    evento.preventDefault();
    navegar(url.href);
  });
}
