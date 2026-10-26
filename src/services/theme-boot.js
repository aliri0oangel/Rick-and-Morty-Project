/**
 * theme-boot.js — Aplicación del tema visual ANTES del primer pintado.
 * -------------------------------------------------------------------
 * Es un script CLÁSICO y BLOQUEANTE en <head> (a diferencia de los
 * módulos, que se diferían): ejecuta sí o sí antes de parsear <body>,
 * evitando el "flash" de tema claro en usuarios con tema oscuro.
 *
 * Seguridad: es archivo externo ('self') => compatible con la CSP
 * (sin scripts inline, que la CSP bloquearía).
 *
 * Orden de decisión del tema (PLAN.md T1.5):
 *   1) Cookie "tema" (decisión explícita del usuario, persiste 1 año).
 *   2) prefers-color-scheme del sistema (si no hay cookie).
 *   3) Fallback CRT oscuro: si el sistema no es conocido (no hay
 *      matchMedia o no reporta light), se aplica el tema temático.
 *
 * Nota: este archivo NO usa import/export porque debe ser síncrono;
 * la lógica de cookies está replicada a propósito en una línea (DRY
 * sacrificado a cambio de cero flash de tema — decisión consciente).
 */
(function () {
  var cookies = document.cookie ? document.cookie.split('; ') : [];
  var valor = null;

  for (var i = 0; i < cookies.length; i++) {
    if (cookies[i].indexOf('tema=') === 0) {
      valor = decodeURIComponent(cookies[i].slice(5));
      break;
    }
  }

  // Sin cookie => preferencia del sistema; sin sistema conocido => CRT.
  if (!valor) {
    var mq = window.matchMedia;
    var sistemaClaro = mq && mq.call(window, '(prefers-color-scheme: light)').matches;
    valor = sistemaClaro ? 'claro' : 'oscuro';
  }

  // Raíz del documento: todas las variantes dark: cuelgan de .dark
  if (valor === 'oscuro') {
    document.documentElement.classList.add('dark');
  }

  // theme-color del navegador (Fase 6 / T6.1): coincide con el fondo
  // del tema ya resuelto => la barra del navegador no parpadea.
  var metaTema = document.querySelector('meta[name="theme-color"]');
  if (metaTema) {
    metaTema.setAttribute('content', valor === 'oscuro' ? '#0b0c10' : '#f4efe6');
  }
})();
