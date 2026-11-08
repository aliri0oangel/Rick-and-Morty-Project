/**
 * components.js — Biblioteca de componentes UI atómicos (Fase 2 / PLAN.md T2.2).
 * -------------------------------------------------------------------
 * Fábricas PURAS: cada función crea un nodo DOM con todos sus estados
 * y atributos de accesibilidad, sin tocar el documento ni conocer
 * controladores (Dependency Inversion: los callbacks se inyectan).
 *
 * Catálogo: StatusBadge · FavoriteButton · CharacterCard · Skeleton ·
 * EmptyState · ErrorState · Toast (singleton) · Modal · FormField.
 * Estética: clases semánticas de Fase 1 (tubo-card, btn, badge-*, aviso)
 * => funcionan en ambos temas sin variantes dark: explícitas.
 */

import { icono, asegurarSprite } from './icons.js';
import { evaluarFuerza } from '../domain/validators.js';

/* ==================================================================
   STATUS BADGE (Fase 1: vivo=cian · muerto=magenta · desconocido=ámbar)
   ================================================================== */

/** Mapa OCP: claves en español (datos ya traducidos por la capa de
 *  servicio) + valores en inglés de favoritos guardados antes de esa
 *  unificación. */
const BADGE_POR_ESTADO = {
  Vivo: { clase: 'badge-vivo', etiqueta: 'Vivo' },
  Muerto: { clase: 'badge-muerto', etiqueta: 'Muerto' },
  Desconocido: { clase: 'badge-desconocido', etiqueta: 'Desconocido' },
  Alive: { clase: 'badge-vivo', etiqueta: 'Vivo' },
  Dead: { clase: 'badge-muerto', etiqueta: 'Muerto' },
  unknown: { clase: 'badge-desconocido', etiqueta: 'Desconocido' },
  Unknown: { clase: 'badge-desconocido', etiqueta: 'Desconocido' },
};

/** Entrada defensiva para estados fuera del mapa (la API puede crecer). */
const BADGE_POR_DEFECTO = { clase: 'badge-desconocido', etiqueta: 'Desconocido' };

/**
 * Crea el badge de estado de un personaje.
 * @param {string} estado - "Vivo" | "Muerto" | "Desconocido" (o legado en inglés).
 * @returns {HTMLElement} <span class="badge badge-*">
 */
export function crearBadgeEstado(estado) {
  const { clase, etiqueta } = BADGE_POR_ESTADO[estado] || BADGE_POR_DEFECTO;
  const nodo = document.createElement('span');
  nodo.className = `badge ${clase}`;
  // Punto + etiqueta traducida (los datos crudos de la API no se pintan).
  nodo.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true"></span>';
  nodo.append(document.createTextNode(etiqueta));
  return nodo;
}

/* ==================================================================
   FAVORITE BUTTON (aria-pressed dinámico + icono SVG)
   ================================================================== */

/**
 * Crea el botón de favorito (corazón) con su estado inicial.
 * @param {Object} [opciones]
 * @param {boolean} [opciones.activo=false] - ¿Ya es favorito?
 * @param {boolean} [opciones.conTexto=false] - ¿Etiqueta visible junto al icono?
 * @returns {HTMLElement} <button aria-pressed="...">
 */
export function crearBotonFavorito({ activo = false, conTexto = false } = {}) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.setAttribute('data-favorito', '');
  boton.className = conTexto
    ? 'btn btn-ghost gap-2'
    : 'absolute top-2 right-2 w-9 h-9 rounded-full bg-panel/85 backdrop-blur-sm text-dim hover:text-danger hover:scale-110 transition flex items-center justify-center shadow-sm ring-1 ring-line';
  boton.innerHTML = `${icono('heart', conTexto ? 'w-4 h-4' : 'w-5 h-5')}${
    conTexto ? '<span data-campo="favorito-texto"></span>' : ''
  }`;
  pintarBotonFavorito(boton, activo);
  return boton;
}

/**
 * Refleja el estado del favorito en el botón (icono, aria y color).
 * Compatible con el botón del detalle (conTexto) y con el de la card.
 * @param {HTMLElement} boton - Botón creado por crearBotonFavorito.
 * @param {boolean} activo - Estado final tras el alternar.
 * @returns {void}
 */
export function pintarBotonFavorito(boton, activo) {
  if (!boton) return;

  const uso = boton.querySelector('use');
  if (uso) {
    // Mismo trazo, distinto symbol: outline <-> relleno (sin emoji).
    uso.setAttribute('href', activo ? '#icon-heart-fill' : '#icon-heart');
  }

  boton.setAttribute('aria-pressed', String(activo));
  boton.classList.toggle('text-danger', activo);
  boton.classList.toggle('text-dim', !activo);

  // Etiqueta visible del detalle ("Favorito" / "En favoritos"), si existe.
  const etiqueta = boton.querySelector('[data-campo="favorito-texto"]');
  if (etiqueta) {
    // Con texto visible, el nombre accesible ES ese texto: un aria-label
    // distinto viola axe label-content-name-mismatch (el texto visible
    // debe estar dentro del nombre). El estado lo comunica aria-pressed.
    boton.removeAttribute('aria-label');
    etiqueta.textContent = activo ? 'En favoritos' : 'Favorito';
  } else {
    // Botón solo-icono (cards): nombre accesible obligatorio vía aria-label.
    boton.setAttribute('aria-label', activo ? 'Quitar de favoritos' : 'Agregar a favoritos');
  }
}

/* ==================================================================
   CHARACTER CARD (marco de tubo, sin <template> en el HTML)
   ================================================================== */

/**
 * Crea una card de personaje a partir del MODELO DE VISTA (ya mapeado).
 * El marcado estático se asigna vía innerHTML con string propio (sin
 * datos externos); los datos se pueblan SIEMPRE con textContent => XSS.
 * @param {{id, nombre, imagen, alt, especie, meta, estado}} datos - Vista ya mapeada.
 * @param {(id: string|number) => boolean} esFavorito - Consulta inyectada.
 * @returns {HTMLElement} <article class="tubo-card">
 */
export function crearCardPersonaje(datos, esFavorito) {
  const nodo = document.createElement('div');
  // plantilla estática propia (cero datos de terceros en el string)
  // T12.3: "group" es OBLIGATORIA para que group-hover de la imagen
  // funcione (bug: sin ella el zoom nunca se disparaba); "relative" da
  // ancla al cue "abrir expediente". El contenedor de imagen usa
  // .skeleton (T12.2) como placeholder mientras la imagen carga.
  nodo.innerHTML = `
    <article class="tubo-card group relative flex flex-col cursor-pointer" data-id="">
      <div class="relative w-full aspect-[4/3] skeleton rounded-none overflow-hidden">
        <img data-campo="imagen" alt="" loading="lazy" decoding="async"
             class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"></img>
      </div>
      <div class="tubo-card-portal" aria-hidden="true"></div>
      <div class="flex-1 p-4 flex flex-col justify-between gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <h4 data-campo="nombre" class="font-semibold text-ink truncate"></h4>
          <span data-campo="estado" class="shrink-0"></span>
        </div>
        <p data-campo="especie" class="text-sm text-dim truncate"></p>
        <p data-campo="meta" class="text-xs text-dim truncate"></p>
      </div>
      <span class="tubo-card-cue microcopy" aria-hidden="true">abrir expediente &rsaquo;</span>
    </article>`;
  const card = nodo.querySelector('article');
  card.dataset.id = String(datos.id);

  // Poblado seguro (nunca innerHTML con datos de la API).
  card.querySelector('[data-campo="nombre"]').textContent = datos.nombre;
  card.querySelector('[data-campo="especie"]').textContent = datos.especie;
  card.querySelector('[data-campo="meta"]').textContent = datos.meta;

  const img = card.querySelector('[data-campo="imagen"]');
  // Fade-in al cargar (T5.2): base opacity-0 + load => opacity-100.
  img.classList.add('img-fade', 'opacity-0');
  img.addEventListener('load', () => img.classList.remove('opacity-0'), { once: true });
  img.src = datos.imagen;
  img.alt = datos.alt;
  // Imagen ya cacheada por el navegador: no se espera al evento load.
  if (img.complete) img.classList.remove('opacity-0');

  // Placeholder .skeleton (T12.2): se RETIRA al cargar; sin esto el
  // shimmer corre SIN FIN en cada card cargada (CPU constante, bug real).
  const marcoImagen = img.parentElement;
  const retirarShimmer = () => marcoImagen.classList.remove('skeleton');
  if (img.complete) retirarShimmer();
  else {
    img.addEventListener('load', retirarShimmer, { once: true });
    img.addEventListener('error', retirarShimmer, { once: true });
  }

  // Badge de estado (componente reutilizado, no clases sueltas).
  card.querySelector('[data-campo="estado"]').replaceChildren(crearBadgeEstado(datos.estado));

  // Botón favorito superpuesto a la imagen (estado inyectado desde fuera).
  card.querySelector('.relative').appendChild(crearBotonFavorito({ activo: esFavorito(datos.id) }));

  return card;
}

/* ==================================================================
   SKELETONS (carga percibida)
   ================================================================== */

/**
 * Tarjeta fantasma con la MISMA forma que CharacterCard (sin desplazamiento).
 * @param {number} [indice=0] - Posición en el lote: desfaza el shimmer
 *        (T12.2) para que los skeletons no "respiren" sincronizados.
 * @returns {HTMLElement}
 */
export function crearSkeletonCard(indice = 0) {
  const nodo = document.createElement('div');
  nodo.setAttribute('aria-hidden', 'true');
  // Fase del shimmer por skeleton (carga percibida más orgánica).
  nodo.style.setProperty('--skeleton-delay', `${(indice % 8) * 0.12}s`);
  // Nota: sin "!" => las utilities ganan a @layer components (Tailwind v4),
  // así cursor/rounded sobre escriben .tubo-card/.skeleton sin importancia forzada.
  nodo.innerHTML = `
    <div class="tubo-card cursor-default" style="pointer-events:none">
      <div class="skeleton w-full aspect-[4/3] rounded-none"></div>
      <div class="p-4 space-y-3">
        <div class="skeleton h-4 w-3/4"></div>
        <div class="skeleton h-3 w-1/2"></div>
        <div class="skeleton h-3 w-2/3"></div>
      </div>
    </div>`;
  return nodo.firstElementChild;
}

/**
 * Esqueleto del DETALLE de personaje (dos columnas: imagen + datos).
 * @returns {HTMLElement}
 */
export function crearSkeletonDetalle() {
  const nodo = document.createElement('div');
  nodo.setAttribute('aria-hidden', 'true');
  nodo.className =
    'tubo-card cursor-default grid grid-cols-1 md:grid-cols-[minmax(0,360px)_1fr] gap-6';
  nodo.style.pointerEvents = 'none';
  nodo.innerHTML = `
    <div class="skeleton aspect-square rounded-none md:aspect-auto"></div>
    <div class="p-6 space-y-4">
      <div class="skeleton h-7 w-2/3"></div>
      <div class="skeleton h-4 w-1/3"></div>
      <div class="skeleton h-4 w-1/2"></div>
      <div class="skeleton h-4 w-1/2"></div>
      <div class="skeleton h-4 w-2/3"></div>
    </div>`;
  return nodo;
}

/* ==================================================================
   CARGA EN BOTONES (T12.2) — spinner + aria-busy con ancho estable
   ================================================================== */

/**
 * Pone un botón en modo "cargando": spinner + texto contextual,
 * aria-busy (lectores de pantalla) y disabled (anti doble envío).
 * El ancho se congela en minWidth para que spinner+texto no
 * redimensionen el botón (checklist de diseño #6: sin saltos).
 * Llamar SIEMPRE con quitarBotonCargando en el catch (y en el éxito
 * solo si no se navega: si hay redirect, se queda cargando).
 * @param {HTMLButtonElement} boton - Botón a bloquear.
 * @param {string} [texto='Procesando...'] - Etiqueta de progreso.
 * @returns {void}
 */
export function ponerBotonCargando(boton, texto = 'Procesando...') {
  if (!boton || boton.dataset.cargando === 'true') return; // idempotente
  boton.dataset.cargando = 'true';
  boton.dataset.contenidoOriginal = boton.innerHTML;
  boton.style.minWidth = `${boton.offsetWidth}px`;
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  boton.innerHTML = icono('loader', 'w-4 h-4 animate-spin');
  const spanTexto = document.createElement('span');
  spanTexto.textContent = texto;
  boton.appendChild(spanTexto);
}

/**
 * Restaura el botón a su contenido original (idempotente: si no estaba
 * en modo carga, no hace nada).
 * @param {HTMLButtonElement} boton - Botón a normalizar.
 * @returns {void}
 */
export function quitarBotonCargando(boton) {
  if (!boton || boton.dataset.cargando !== 'true') return;
  delete boton.dataset.cargando;
  boton.removeAttribute('aria-busy');
  boton.disabled = false;
  boton.innerHTML = boton.dataset.contenidoOriginal || '';
  delete boton.dataset.contenidoOriginal;
  boton.style.minWidth = '';
}

/* ==================================================================
   ESTADOS DE PÁGINA (vacío / error) — T2.3
   ================================================================== */

/**
 * Mensaje central "sin resultados", con ilustración opcional (Fase 3)
 * y acciones CTA contextuales (T12.1).
 * @param {{titulo: string, mensaje?: string,
 *          ilustracion?: 'favoritos'|'busqueda',
 *          acciones?: Array<{texto: string, variante?: string, alClic: () => void}>}} opciones
 * @returns {HTMLElement}
 */
export function crearEstadoVacio({ titulo, mensaje, ilustracion, acciones } = {}) {
  const nodo = document.createElement('div');
  nodo.className = 'pt-12 text-center text-dim space-y-3';
  if (ilustracion) {
    const svg = crearIlustracion(ilustracion);
    // setAttribute y NO className: en SVGElement className es de solo
    // lectura (SVGAnimatedString) y asignarlo lanza TypeError, rompiendo
    // TODO el estado vacío (bug real detectado en los tests T10.2).
    // estado-vacio-ilustr (T12.1): flicker de tubo CRT (keyframes
    // anulados por el guard global de reduced-motion => opacidad base).
    svg.setAttribute('class', 'mx-auto text-dim opacity-70 estado-vacio-ilustr');
    svg.style.width = '140px';
    svg.style.height = 'auto';
    nodo.appendChild(svg);
  }
  const pTitulo = document.createElement('p');
  pTitulo.className = 'text-lg font-semibold';
  pTitulo.textContent = titulo || 'No hay personajes para mostrar';
  nodo.appendChild(pTitulo);
  if (mensaje) {
    const pMsg = document.createElement('p');
    pMsg.className = 'text-sm';
    pMsg.textContent = mensaje;
    nodo.appendChild(pMsg);
  }

  // Acciones CTA (T12.1): fila de botones bajo el mensaje. Los callbacks
  // los inyecta la página (DIP): el componente no conoce rutas ni
  // formularios. Variante por defecto btn-primary (es LA salida del vacío).
  const listaAcciones = Array.isArray(acciones)
    ? acciones.filter((accion) => accion?.texto && typeof accion.alClic === 'function')
    : [];
  if (listaAcciones.length > 0) {
    const filaAcciones = document.createElement('div');
    filaAcciones.className = 'flex flex-wrap justify-center gap-3 pt-3';
    for (const accion of listaAcciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `btn ${accion.variante || 'btn-primary'}`;
      boton.textContent = accion.texto;
      boton.addEventListener('click', accion.alClic);
      filaAcciones.appendChild(boton);
    }
    nodo.appendChild(filaAcciones);
  }
  return nodo;
}

/**
 * Caja de error con acción opcional (reintentar / volver).
 * role="alert": el lector lo anuncia en cuanto aparece.
 * @param {{titulo?: string, mensaje?: string, textoAccion?: string,
 *          alAccion?: () => void}} opciones
 * @returns {HTMLElement}
 */
export function crearEstadoError({ titulo, mensaje, textoAccion, alAccion } = {}) {
  const nodo = document.createElement('div');
  nodo.className = 'aviso aviso-error max-w-md mx-auto space-y-3 text-center';
  nodo.innerHTML = `
    <p class="font-semibold flex items-center justify-center gap-2">${icono(
      'alert',
      'w-5 h-5 shrink-0'
    )}<span data-campo="titulo"></span></p>
    <p class="text-sm" data-campo="mensaje"></p>`;
  // textContent => mensaje del sistema/usuario jamás inyecta HTML.
  nodo.querySelector('[data-campo="titulo"]').textContent = titulo || 'Algo salió mal';
  nodo.querySelector('[data-campo="mensaje"]').textContent = mensaje || '';

  if (textoAccion && alAccion) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn-danger mt-2';
    boton.textContent = textoAccion;
    boton.addEventListener('click', alAccion);
    nodo.appendChild(boton);
  }
  return nodo;
}

/* ==================================================================
   ILUSTRACIONES VACÍAS (Fase 3 — estados "sin resultados" memorables)
   TV de tubo dibujada a mano con variantes: corazón roto (favoritos)
   o lupa (búsqueda sin resultados). SVG estático propio, cero datos
   externos => innerHTML seguro.
   ================================================================== */

/** Mapa OCP de variantes: añadir un estado nuevo = una entrada nueva. */
const ILUSTRACIONES = {
  favoritos: `
    <path d="M85 20 h90 a10 10 0 0 1 10 10 v70 a10 10 0 0 1-10 10 h-90 a10 10 0 0 1-10-10 v-70 a10 10 0 0 1 10-10 z" stroke="currentColor" stroke-width="3" fill="none"/>
    <rect x="22" y="28" width="116" height="54" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M80 70 l-10-10 a7 7 0 1 1 10-10 a7 7 0 1 1 10 10 z" fill="currentColor" opacity="0.85"/>
    <path d="M75 55 l6 6 M91 55 l-6 6" stroke="var(--app-bg, currentColor)" stroke-width="2"/>
    <circle cx="155" cy="40" r="4" fill="currentColor"/><circle cx="155" cy="56" r="4" fill="currentColor"/>
    <path d="M60 110 h60 M70 118 h40" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    <path d="M40 36 l-8-6 M40 48 l-10 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>`,
  busqueda: `
    <path d="M85 20 h90 a10 10 0 0 1 10 10 v70 a10 10 0 0 1-10 10 h-90 a10 10 0 0 1-10-10 v-70 a10 10 0 0 1 10-10 z" stroke="currentColor" stroke-width="3" fill="none"/>
    <rect x="22" y="28" width="116" height="54" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="74" cy="50" r="14" stroke="currentColor" stroke-width="3" fill="none"/>
    <path d="M85 61 l12 12" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M112 44 h14 M112 52 h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
    <circle cx="155" cy="40" r="4" fill="currentColor"/><circle cx="155" cy="56" r="4" fill="currentColor"/>
    <path d="M60 110 h60 M70 118 h40" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`,
};

const ILUSTRACION_POR_DEFECTO = ILUSTRACIONES.busqueda;

/**
 * Ilustración SVG decorativa (aria-hidden) para estados vacíos.
 * @param {'favoritos'|'busqueda'} [tipo='busqueda'] - Variante.
 * @returns {SVGSVGElement}
 */
export function crearIlustracion(tipo = 'busqueda') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 180 130');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ILUSTRACIONES[tipo] || ILUSTRACION_POR_DEFECTO;
  return svg;
}

/* ==================================================================
   CONTROL DE CONTRASEÑA (Fase 3 — T3.1): mostrar/ocultar + medidor
   ================================================================== */

/**
 * Envuelve un input de contraseña con botón ojo y, OPCIONALMENTE,
 * medidor de fuerza (M2: el medidor solo tiene sentido donde se CREA o
 * CAMBIA una contraseña — registro y "Nueva contraseña" de la cuenta;
 * en login/confirmar sería incoherente).
 * El botón alterna type password/text sin tocar el valor (mantiene la
 * autorellena del navegador); el medidor usa la MISMA política de
 * validators.js (evaluarFuerza) y se actualiza en cada input.
 * @param {HTMLInputElement} input - Input tipo password (id obligatorio).
 * @param {Object} [opciones]
 * @param {boolean} [opciones.conMedidor=false] - Añadir medidor de fuerza.
 * @returns {{medidor: HTMLElement|null}} Nodo del medidor o null.
 */
export function crearControlPassword(input, { conMedidor = false } = {}) {
  // Wrap relativo: el botón se superpone al extremo derecho del campo.
  const wrap = document.createElement('div');
  wrap.className = 'campo-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'campo-toggle';
  boton.setAttribute('aria-label', 'Mostrar contraseña');
  boton.setAttribute('aria-pressed', 'false');
  boton.innerHTML = icono('eye', 'w-5 h-5');
  wrap.appendChild(boton);

  boton.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    boton.setAttribute('aria-pressed', String(!visible));
    boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    boton.innerHTML = icono(visible ? 'eye' : 'eye-off', 'w-5 h-5');
  });

  // Sin medidor (login, campos de confirmación): solo el botón ojo.
  if (!conMedidor) return { medidor: null };

  // Medidor: barra de 4 segmentos + etiqueta (aria-live off: el input
  // ya tiene su feedback por blur/submit; esto es refuerzo visual).
  const medidor = document.createElement('div');
  medidor.className = 'fuerza';
  medidor.hidden = true;
  medidor.innerHTML = `
    <div class="fuerza-barra" aria-hidden="true">
      <span class="fuerza-seg"></span><span class="fuerza-seg"></span>
      <span class="fuerza-seg"></span><span class="fuerza-seg"></span>
    </div>
    <span class="fuerza-texto" data-campo="fuerza"></span>`;
  wrap.parentNode.insertBefore(medidor, wrap.nextSibling);

  input.addEventListener('input', () => {
    // Medidor solo cuando hay algo escrito (limpia el estado al borrar).
    if (!input.value) {
      medidor.hidden = true;
      medidor.removeAttribute('data-nivel');
      medidor.querySelector('[data-campo="fuerza"]').textContent = '';
      return;
    }
    const { puntos, etiqueta } = evaluarFuerza(input.value);
    medidor.hidden = false;
    medidor.dataset.nivel = String(puntos);
    medidor.querySelector('[data-campo="fuerza"]').textContent = etiqueta;
  });

  return { medidor };
}

/* ==================================================================
   RETIRO ANIMADO DE CARD (Fase 3 — T3.3)
   ================================================================== */

/**
 * Retira una card con transición suave de opacidad/escala.
 * Respeta prefers-reduced-motion (retiro inmediato sin animación).
 * @param {HTMLElement} card - Card a retirar del DOM.
 * @returns {Promise<void>} Se resuelve cuando la card ya no está en el DOM.
 */
export function retirarCardAnimada(card) {
  const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!motionOk || typeof card.animate !== 'function') {
    card.remove();
    return Promise.resolve();
  }
  return new Promise((resolver) => {
    const animacion = card.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.92)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' }
    );
    animacion.onfinish = () => {
      card.remove();
      resolver();
    };
  });
}

/* ==================================================================
   TOAST (singleton con aria-live=polite)
   ================================================================== */

/** Contenedor fijo creado una sola vez por página. */
let contenedorToast = null;

/**
 * Muestra un aviso flotante (toast) con auto-retiro.
 * Un ÚNICO contenedor con role="status" => los avisos se anuncian sin
 * mover el foco y sin acumular nodos huérfanos en el body.
 * @param {string} mensaje - Texto (siempre textContent, anti-XSS).
 * @param {'info'|'error'} [tipo='info'] - Variante de color.
 * @param {number} [ms=3200] - Duración en pantalla.
 * @returns {void}
 */
export function mostrarToast(mensaje, tipo = 'info', ms = 3200) {
  if (!contenedorToast || !contenedorToast.isConnected) {
    contenedorToast = document.createElement('div');
    // z-[110] queda por encima de las scanlines CRT (z-index 100).
    contenedorToast.className = 'fixed bottom-4 right-4 z-[110] flex flex-col gap-2 items-end';
    contenedorToast.setAttribute('role', 'status');
    contenedorToast.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedorToast);
  }

  const toast = document.createElement('div');
  toast.className = `aviso toast ${tipo === 'error' ? 'toast-error' : 'toast-info'} shadow-lg max-w-xs`;
  toast.textContent = mensaje;
  contenedorToast.appendChild(toast);

  // Retiro suave + limpieza (no deja display:none acumulándose).
  setTimeout(() => {
    toast.remove();
    if (contenedorToast && contenedorToast.childElementCount === 0) {
      contenedorToast.remove();
      contenedorToast = null;
    }
  }, ms);
}

/* ==================================================================
   MODAL (confirmación accesible: Escape, foco, aria-modal)
   ================================================================== */

/**
 * Diálogo modal de confirmación.
 * Devuelve el control { nodo, abrir, cerrar }; el foco se guarda al abrir
 * y se restaura al cerrar (a11y), Escape y clic en el fondo cierran.
 * @param {{titulo: string, mensaje: string, textoConfirmar?: string,
 *          textoCancelar?: string, alConfirmar: () => void}} opciones
 * @returns {{nodo: HTMLElement, abrir: () => void, cerrar: () => void}}
 */
export function crearModal({ titulo, mensaje, textoConfirmar, textoCancelar, alConfirmar }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 hidden';
  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="modal-titulo"
         class="tubo-card cursor-default max-w-sm w-full p-6 space-y-4">
      <h2 id="modal-titulo" class="font-display text-2xl text-ink" data-campo="titulo"></h2>
      <p class="text-sm text-dim" data-campo="mensaje"></p>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" class="btn btn-ghost" data-campo="cancelar"></button>
        <button type="button" class="btn btn-danger" data-campo="confirmar"></button>
      </div>
    </div>`;

  overlay.querySelector('[data-campo="titulo"]').textContent = titulo;
  overlay.querySelector('[data-campo="mensaje"]').textContent = mensaje;
  const btnCancelar = overlay.querySelector('[data-campo="cancelar"]');
  const btnConfirmar = overlay.querySelector('[data-campo="confirmar"]');
  btnCancelar.textContent = textoCancelar || 'Cancelar';
  btnConfirmar.textContent = textoConfirmar || 'Confirmar';

  let enfoquePrevio = null;

  const cerrar = () => {
    overlay.classList.add('hidden');
    // Devuelve el foco al elemento que abrió el modal (regla a11y).
    if (enfoquePrevio && enfoquePrevio.isConnected) enfoquePrevio.focus();
  };

  const abrir = () => {
    enfoquePrevio = document.activeElement;
    overlay.classList.remove('hidden');
    btnCancelar.focus();
  };

  btnCancelar.addEventListener('click', cerrar);
  btnConfirmar.addEventListener('click', () => {
    cerrar();
    alConfirmar();
  });
  // Clic en el fondo (no en el diálogo) => cerrar.
  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) cerrar();
  });
  // Escape cierra; Tab queda atrapado dentro del diálogo mientras está abierto.
  overlay.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      cerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const foco = overlay.querySelectorAll('button');
    const primero = foco[0];
    const ultimo = foco[foco.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });

  document.body.appendChild(overlay);
  return { nodo: overlay, abrir, cerrar };
}

/* ==================================================================
   FORM FIELD (label + input + error con aria)
   ================================================================== */

/**
 * Campo de formulario accesible: label vinculado, input.campo y span de
 * error con id `error-<id>` (contrato de validators.js). El texto de
 * error queda ligado vía aria-describedby para lectores de pantalla.
 * @param {{id: string, etiqueta: string, tipo?: string, placeholder?: string,
 *          valor?: string, autocomplete?: string}} opciones
 * @returns {HTMLElement} Bloque listo para insertar en el <form>.
 */
export function crearCampo({ id, etiqueta, tipo = 'text', placeholder, valor, autocomplete }) {
  const nodo = document.createElement('div');
  nodo.className = 'mb-4';
  nodo.innerHTML = `
    <label for="${id}" class="block text-ink font-medium mb-2"></label>
    <input class="campo" type="${tipo}" id="${id}" name="${id}"
           aria-describedby="error-${id}" />
    <span id="error-${id}" class="text-sm" aria-live="polite"></span>`;

  const label = nodo.querySelector('label');
  label.textContent = etiqueta; // etiqueta fija del desarrollador (textContent por consistencia)

  const input = nodo.querySelector('input');
  if (placeholder) input.placeholder = placeholder;
  if (valor) input.value = valor;
  if (autocomplete) input.autocomplete = autocomplete;
  return nodo;
}

/* ==================================================================
   INICIALIZACIÓN DEL SPRITE para consumidores de iconos
   ================================================================== */
// Se asegura el sprite en cuanto este módulo se evalúa (los módulos son
// deferred: el body ya existe cuando aquí se ejecuta el top-level).
if (document.body) {
  asegurarSprite();
}
