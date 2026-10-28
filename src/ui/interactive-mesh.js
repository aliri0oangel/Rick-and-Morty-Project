/**
 * ============================================================================
 * interactive-mesh.js — Malla Cuántica Multiversal (Fondo Interactivo)
 * ============================================================================
 * Implementa la Opción 2: Malla Cuántica Multiversal sobre un <canvas> nativo
 * para las páginas de Login y Registro.
 *
 * Características:
 *  - Nodos flotantes representando dimensiones (C-137, Citadel, Prime, 35-C...)
 *  - Enlaces de línea entre nodos y tethers cuánticos hacia el cursor del mouse.
 *  - Telemetría en tiempo real: actualiza coordenadas (X/Y) en el HUD superior.
 *  - Soporte multi-tema: adapta paleta en vivo según .dark (CRT) o modo día.
 *  - A11y (WCAG 2.1 AA): respeta prefers-reduced-motion inmovilizando los nodos.
 *  - Eficiencia: pausa el bucle requestAnimationFrame cuando la pestaña está oculta.
 */

/** Dimensiones célebres de la serie para etiquetar nodos clave */
const DIMENSIONES = [
  'C-137',
  'Citadel',
  'J19-ζ7',
  'Prime',
  '35-C',
  'Cronenberg',
  'C-500',
  'Dimension 51',
];

/**
 * Inicia la malla cuántica en el canvas especificado y conecta el HUD de telemetría.
 *
 * @param {HTMLCanvasElement} canvas - Elemento canvas donde dibujar.
 * @param {Object} [config] - Opciones de configuración.
 * @param {HTMLElement} [config.hudCoords] - Elemento DOM para imprimir coordenadas X/Y.
 * @param {number} [config.nodeCount] - Cantidad de nodos (por defecto 55 en escritorio, 30 en móvil).
 * @returns {() => void} Función de limpieza para desmontar listeners y bucle.
 */
export function inicializarMallaCuantica(canvas, config = {}) {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    return () => {};
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const hudCoords = config.hudCoords || document.getElementById('hud-coordenadas');
  const esMovil = window.innerWidth < 640;
  const totalNodos = config.nodeCount || (esMovil ? 28 : 55);

  let animacionId = null;
  let activo = true;

  // Estado del mouse (centrado por defecto)
  const mouse = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    activo: false,
  };

  // Detección de reduced-motion
  const mediaReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = mediaReducedMotion.matches;
  const onMotionChange = (e) => {
    reducedMotion = e.matches;
  };
  mediaReducedMotion.addEventListener('change', onMotionChange);

  // Redimensionamiento con soporte para DPR (pantallas Retina)
  let ancho = window.innerWidth;
  let alto = window.innerHeight;

  function redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = window.innerWidth;
    alto = window.innerHeight;

    canvas.width = Math.floor(ancho * dpr);
    canvas.height = Math.floor(alto * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;

    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', redimensionar);
  redimensionar();

  // Generación inicial de nodos dimensionales
  const nodos = [];
  for (let i = 0; i < totalNodos; i++) {
    nodos.push({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radio: 1.8 + Math.random() * 2.2,
      // Solo algunos nodos portan designación de dimensión
      etiqueta:
        Math.random() > 0.72 ? DIMENSIONES[Math.floor(Math.random() * DIMENSIONES.length)] : null,
      tipoColor: Math.random() > 0.35 ? 'info' : 'brand', // Cian o Ámbar
    });
  }

  // Escuchar posición del puntero
  const onMouseMove = (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.activo = true;

    if (hudCoords) {
      hudCoords.textContent = `X: ${Math.round(e.clientX)} | Y: ${Math.round(e.clientY)}`;
    }
  };
  window.addEventListener('mousemove', onMouseMove);

  // Bucle de renderizado
  function dibujar() {
    if (!activo) return;

    const esOscuro = document.documentElement.classList.contains('dark');

    // Suavizado de seguimiento del cursor
    mouse.x += (mouse.targetX - mouse.x) * 0.1;
    mouse.y += (mouse.targetY - mouse.y) * 0.1;

    ctx.clearRect(0, 0, ancho, alto);

    const maxDistancia = esMovil ? 95 : 135;
    const distanciaMouse = esMovil ? 110 : 170;

    // 1) Líneas de interconexión entre nodos
    for (let i = 0; i < nodos.length; i++) {
      const a = nodos[i];

      for (let j = i + 1; j < nodos.length; j++) {
        const b = nodos[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxDistancia) {
          const factor = 1 - dist / maxDistancia;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);

          if (esOscuro) {
            ctx.strokeStyle = `rgba(57, 215, 230, ${factor * 0.22})`;
          } else {
            ctx.strokeStyle = `rgba(11, 107, 120, ${factor * 0.18})`;
          }
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 2) Tether cuántico hacia el cursor del mouse
      if (mouse.activo) {
        const dmx = a.x - mouse.x;
        const dmy = a.y - mouse.y;
        const distM = Math.hypot(dmx, dmy);

        if (distM < distanciaMouse) {
          const factorM = 1 - distM / distanciaMouse;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);

          if (esOscuro) {
            ctx.strokeStyle = `rgba(255, 176, 0, ${factorM * 0.45})`;
          } else {
            ctx.strokeStyle = `rgba(143, 90, 0, ${factorM * 0.35})`;
          }
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Repulsión elástica sutil
          if (!reducedMotion) {
            a.x += (dmx / distM) * 0.65;
            a.y += (dmy / distM) * 0.65;
          }
        }
      }
    }

    // 3) Dibujar nodos dimensionales
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];

      if (!reducedMotion) {
        nodo.x += nodo.vx;
        nodo.y += nodo.vy;

        // Rebote suave en los bordes de la pantalla
        if (nodo.x < 0 || nodo.x > ancho) nodo.vx *= -1;
        if (nodo.y < 0 || nodo.y > alto) nodo.vy *= -1;
      }

      ctx.beginPath();
      ctx.arc(nodo.x, nodo.y, nodo.radio, 0, Math.PI * 2);

      if (nodo.tipoColor === 'brand') {
        // Ámbar fósforo
        ctx.fillStyle = esOscuro ? '#ffb000' : '#8f5a00';
        ctx.shadowColor = esOscuro ? '#ffb000' : 'transparent';
      } else {
        // Cian portal
        ctx.fillStyle = esOscuro ? '#39d7e6' : '#0b6b78';
        ctx.shadowColor = esOscuro ? '#39d7e6' : 'transparent';
      }

      ctx.shadowBlur = esOscuro ? 6 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Etiquetas dimensionales con tipografía mono
      if (nodo.etiqueta && esOscuro) {
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillStyle = 'rgba(155, 139, 116, 0.75)';
        ctx.fillText(`[${nodo.etiqueta}]`, nodo.x + 6, nodo.y - 4);
      }
    }

    animacionId = requestAnimationFrame(dibujar);
  }

  // Gestión de pausa al ocultar pestaña (optimización energética)
  const onVisibilityChange = () => {
    if (document.hidden) {
      if (animacionId) cancelAnimationFrame(animacionId);
    } else if (activo) {
      animacionId = requestAnimationFrame(dibujar);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Iniciar ciclo de dibujo
  animacionId = requestAnimationFrame(dibujar);

  // Retornar función de desmontaje / limpieza
  return function destruir() {
    activo = false;
    if (animacionId) cancelAnimationFrame(animacionId);
    window.removeEventListener('resize', redimensionar);
    window.removeEventListener('mousemove', onMouseMove);
    mediaReducedMotion.removeEventListener('change', onMotionChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
