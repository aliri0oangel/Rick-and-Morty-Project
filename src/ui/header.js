/**
 * header.js — Cabecera de navegación unificada (Fase 2 / PLAN.md T2.1).
 * -------------------------------------------------------------------
 * Reemplaza las copias del <header> estático por UNA única fábrica en JS:
 *  - la navegación, el usuario y el logout son idénticos en todas partes;
 *  - el marcado usa las clases semánticas de Fase 1 (sigue ambos temas);
 *  - el logout confirma vía Modal accesible (T2.2);
 *  - el toggle de tema se conecta aquí mismo (sin depender del orden
 *    de los módulos);
 *  - skip-link al contenido (T8.1);
 *  - Fase 4: los enlaces navegan con View Transitions cuando hay
 *    soporte (degradación elegante, T4.4).
 *
 * Modificaciones posteriores (M3/M4):
 *  - M3: la cabecera es STICKY con barra "glass" (fondo translúcido +
 *    backdrop-blur) => nunca desaparece al hacer scroll.
 *  - M4: SIN hamburguesa. ≥768px: enlaces de texto (estilo actual);
 *    <768px: iconos redondos de 44px (Catálogo, Favoritos, tema).
 *    El botón "Mi cuenta" abre un dropdown (en TODOS los tamaños) con
 *    "Mi cuenta" y "Cerrar sesión". Logo visible: "Catálogo de Personajes".
 *
 * Se inyecta antes del <main> de la página; los controladores reciben
 * el handle devuelto para actualizar el aria-label del botón de cuenta
 * tras editar la cuenta.
 */

import { icono, asegurarSprite } from './icons.js';
import { crearModal } from './components.js';
import { conectarToggleTema } from '../services/theme-toggle.js';
import { mejorarEnlaces } from './view-transitions.js';
import { logOut } from '../services/auth.js';
import { RUTAS } from '../config/config.js';

/**
 * Enlaces del nav. `id` coincide con el valor de `activo` que se pase
 * a montarHeader() para marcar aria-current="page" (extensible: OCP).
 * Se renderizan DOS veces (texto ≥768px e icono <768px) => aria-current
 * se aplica con querySelectorAll.
 */
const ENLACES = [
  { id: 'catalogo', href: RUTAS.index, etiqueta: 'Catálogo' },
  { id: 'favoritos', href: RUTAS.favoritos, etiqueta: 'Favoritos' },
];

/**
 * Construye e inyecta el header. Idempotente: si ya existe un header
 * (o un header montado previamente), lo reemplaza.
 * @param {Object} [opciones]
 * @param {{nombre?: string, correo?: string}|null} [opciones.sesion] - Usuario en sesión.
 * @param {string|null} [opciones.activo] - Id del enlace activo ('catalogo'|'favoritos').
 * @returns {{nombre: HTMLElement, actualizarNombre: (texto: string) => void}}
 */
export function montarHeader({ sesion = null, activo = null } = {}) {
  asegurarSprite();

  const header = document.createElement('header');
  // M3: sticky en el bloque completo (si no, el nav pegado no podría
  // salir de su propio contenedor y scrollearía con la página).
  header.className = 'cabecera-fija';
  header.innerHTML = `
    <a href="#contenido" class="skip-link">Saltar al contenido</a>
    <nav class="barra-vidrio border-b border-line" aria-label="Principal">
      <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
        <!-- M4: el logo puede encoger y truncarse en pantallas estrechas
             (los controles son shrink-0 => sin overflow horizontal). -->
        <a href="${RUTAS.index}" class="enlace-nav font-display text-base md:text-xl text-brand shrink min-w-0 truncate"
           title="Catálogo de Personajes" data-nav="marca">
          Catálogo de Personajes
        </a>

        <div class="flex items-center gap-2 md:gap-4 shrink-0">
          <!-- Enlaces de texto (≥768px, estilo actual) -->
          <ul class="hidden md:flex items-center gap-4 text-sm">
            ${ENLACES.map(
              (enlace) => `
              <li>
                <a href="${enlace.href}" data-nav="${enlace.id}"
                   class="enlace-nav text-dim hover:text-brand transition-colors px-1 py-1.5">${enlace.etiqueta}</a>
              </li>`
            ).join('')}
          </ul>

          <!-- Iconos redondos (<768px, M4): sin hamburguesa -->
          <a href="${RUTAS.index}" data-nav="catalogo" class="btn-icono md:hidden"
             aria-label="Catálogo" title="Catálogo">${icono('grid', 'w-5 h-5')}</a>
          <a href="${RUTAS.favoritos}" data-nav="favoritos" class="btn-icono md:hidden"
             aria-label="Favoritos" title="Favoritos">${icono('heart', 'w-5 h-5')}</a>

          <!-- Tema: único botón visible en todos los tamaños -->
          <button type="button" id="btn-tema" aria-label="Cambiar tema"
                  class="btn btn-ghost p-2 rounded-full" title="Cambiar tema"></button>

          <!-- Mi cuenta: dropdown en TODOS los tamaños (M4) -->
          <div class="relative">
            <button type="button" id="btn-cuenta"
                    class="btn btn-ghost p-2 rounded-full md:px-4 md:py-2 gap-2"
                    aria-haspopup="true" aria-expanded="false" aria-controls="menu-cuenta"
                    aria-label="Mi cuenta" title="Mi cuenta">
              ${icono('user', 'w-5 h-5')}
              <span class="hidden md:inline">Mi cuenta</span>
            </button>
            <div id="menu-cuenta" class="menu-cuenta hidden">
              <a href="${RUTAS.cuenta}" class="menu-cuenta-item">
                ${icono('user', 'w-4 h-4')} Mi cuenta
              </a>
              <button type="button" id="btn-salir" class="menu-cuenta-item menu-cuenta-item--salir">
                ${icono('logout', 'w-4 h-4')} Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>`;

  /* ---------------- Dropdown "Mi cuenta" (M4, disclosure accesible) -------- */
  const btnCuenta = header.querySelector('#btn-cuenta');
  const menuCuenta = header.querySelector('#menu-cuenta');
  const contenedorCuenta = btnCuenta.parentElement;

  /**
   * Abre o cierra el dropdown sincronizando aria-expanded.
   * @param {boolean} abierto
   * @returns {void}
   */
  const sincronizarCuenta = (abierto) => {
    btnCuenta.setAttribute('aria-expanded', String(abierto));
    menuCuenta.classList.toggle('hidden', !abierto);
  };

  btnCuenta.addEventListener('click', () => {
    const abierto = btnCuenta.getAttribute('aria-expanded') === 'true';
    sincronizarCuenta(!abierto);
  });

  // Escape cierra el dropdown y devuelve el foco al botón (a11y).
  header.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && btnCuenta.getAttribute('aria-expanded') === 'true') {
      sincronizarCuenta(false);
      btnCuenta.focus();
    }
  });

  // Clic fuera del contenedor del dropdown (incluida el resto de la barra) => cierra.
  document.addEventListener('click', (evento) => {
    if (!contenedorCuenta.contains(evento.target)) {
      sincronizarCuenta(false);
    }
  });

  // Ruta activa: aria-current + acento de color (T2.1 "ruta activa").
  // Duplicado por breakpoint (texto e icono) => querySelectorAll.
  if (activo) {
    header.querySelectorAll(`[data-nav="${activo}"]`).forEach((enlace) => {
      enlace.setAttribute('aria-current', 'page');
      // Los iconos redondos ya pintan su estado activo desde CSS
      // (.btn-icono[aria-current]); solo los enlaces de texto llevan clases.
      if (enlace.classList.contains('btn-icono')) return;
      enlace.classList.add('text-brand');
      enlace.classList.remove('text-dim');
    });
  }

  // Nombre del usuario: sin texto visible en el nav (icono + dropdown);
  // el dato vive en aria-label/title del botón (atributos, nunca
  // innerHTML con datos => anti-XSS).
  /**
   * Actualiza la etiqueta accesible del botón de cuenta con el usuario
   * en sesión («Mi cuenta de X»); sin sesión queda «Mi cuenta».
   * @param {string} [texto] - Nombre o correo del usuario.
   * @returns {void}
   */
  const pintarNombre = (texto) => {
    const etiqueta = texto ? `Mi cuenta de ${texto}` : 'Mi cuenta';
    btnCuenta.setAttribute('aria-label', etiqueta);
    btnCuenta.setAttribute('title', etiqueta);
  };
  pintarNombre(sesion && (sesion.nombre || sesion.correo));

  // Toggle de tema: conexión directa (idempotente: no duplica listeners).
  conectarToggleTema(header.querySelector('#btn-tema'));

  // Logout con confirmación modal (evita cierres accidentales).
  const modal = crearModal({
    titulo: 'Cerrar sesión',
    mensaje: '¿Quieres salir de tu cuenta? Tu sesión se cerrará en este dispositivo.',
    textoConfirmar: 'Cerrar sesión',
    alConfirmar: logOut,
  });
  header.querySelector('#btn-salir').addEventListener('click', () => {
    sincronizarCuenta(false);
    modal.abrir();
  });

  // Reemplazo del header previo (si lo hubiera) e inserción antes del main.
  document.querySelector('header')?.remove();
  const main = document.querySelector('main');
  if (main) {
    main.before(header);
  } else {
    document.body.prepend(header);
  }

  // Navegación entre páginas con View Transitions si hay soporte (T4.4).
  mejorarEnlaces(document);

  return { nombre: btnCuenta, actualizarNombre: pintarNombre };
}
