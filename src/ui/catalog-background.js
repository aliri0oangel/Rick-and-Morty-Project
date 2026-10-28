/**
 * ============================================================================
 * catalog-background.js — Fondo de Rejilla de Coordenadas Multiversales
 * ============================================================================
 * Implementa un fondo de rejilla geométrica con perspectiva y paralaje.
 *
 * Características:
 *  - Rejilla infinita que se desplaza en el eje Y.
 *  - Efecto de inclinación (paralaje) basado en la posición del mouse.
 *  - Adaptación de colores según el tema (.dark CRT vs Modo Día).
 *  - Soporte para prefers-reduced-motion.
 */

export function inicializarFondoCatalogo() {
  // Asegurar que el body exista antes de intentar insertar el canvas
  if (!document.body) {
    console.error('[Background] El body no está disponible aún.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'canvas-fondo-catalogo';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  canvas.style.opacity = '0.2';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Background] No se pudo obtener el contexto 2D.');
    return;
  }

  let ancho, alto;
  let offset = 0;
  const mouse = { x: 0, y: 0, realX: 0, realY: 0 };

  const mediaReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function redimensionar() {
    ancho = window.innerWidth;
    alto = window.innerHeight;
    // Usar DevicePixelRatio para evitar borrosidad y asegurar renderizado
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(ancho * dpr);
    canvas.height = Math.floor(alto * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();

  window.addEventListener('mousemove', (e) => {
    mouse.realX = e.clientX;
    mouse.realY = e.clientY;
    mouse.x = e.clientX / ancho - 0.5;
    mouse.y = e.clientY / alto - 0.5;
  });

  function dibujar() {
    // Verificar que el canvas siga en el DOM
    if (!document.body.contains(canvas)) return;

    ctx.clearRect(0, 0, ancho, alto);

    const esOscuro = document.documentElement.classList.contains('dark');
    const colorLínea = esOscuro ? 'rgba(57, 215, 230, 0.5)' : 'rgba(11, 107, 120, 0.4)';

    ctx.strokeStyle = colorLínea;
    ctx.lineWidth = 2;

    const tiltX = mouse.x * 20;
    const spacing = 60;

    if (!mediaReducedMotion.matches) {
      offset += 0.5;
      if (offset > spacing) offset = 0;
    }

    // Efecto Agujero Negro: Deformación de líneas
    const deformar = (px, py) => {
      const dx = px - mouse.realX;
      const dy = py - mouse.realY;
      const distSq = dx * dx + dy * dy;
      const radioInfluencia = 250 * 250;

      if (distSq < radioInfluencia) {
        const dist = Math.sqrt(distSq);
        const fuerza = (1 - dist / 250) * 15; // Intensidad de succión
        const factorX = dx / dist;
        const factorY = dy / dist;
        return {
          nx: px - factorX * fuerza,
          ny: py - factorY * fuerza,
        };
      }
      return { nx: px, ny: py };
    };

    ctx.save();
    // Aplicamos una ligera inclinación global basada en el mouse
    ctx.translate(ancho / 2, alto / 2);
    ctx.transform(1, 0, tiltX / 1000, 1, 0, 0);
    ctx.translate(-ancho / 2, -alto / 2);

    // Dibujar líneas horizontales deformadas
    for (let y = -alto; y < alto * 2; y += spacing) {
      ctx.beginPath();
      for (let x = -ancho; x < ancho * 2; x += 20) {
        const p = deformar(x, y + offset);
        if (x === -ancho) ctx.moveTo(p.nx, p.ny);
        else ctx.lineTo(p.nx, p.ny);
      }
      ctx.stroke();
    }

    // Dibujar líneas verticales deformadas
    for (let x = -ancho; x < ancho * 2; x += spacing) {
      ctx.beginPath();
      for (let y = -alto; y < alto * 2; y += 20) {
        const p = deformar(x, y + offset);
        if (y === -alto) ctx.moveTo(p.nx, p.ny);
        else ctx.lineTo(p.nx, p.ny);
      }
      ctx.stroke();
    }

    ctx.restore();
    requestAnimationFrame(dibujar);
  }

  dibujar();
}
