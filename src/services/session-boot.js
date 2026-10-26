/**
 * session-boot.js — Guardia de sesión ANTES del primer pintado.
 * -------------------------------------------------------------------
 * Es un script CLÁSICO y BLOQUEANTE en <head> (igual que theme-boot.js):
 * se ejecuta antes de que el parser llegue al <body>, así que una página
 * protegida sin sesión NUNCA pinta su contenido antes de redirigir al
 * login. Esto elimina el "flash" que producía rutaProtegida(), que corre
 * en DOMContentLoaded (cuando el HTML ya se ha pintado).
 *
 * Seguridad: es archivo externo ('self') => compatible con la CSP
 * (sin scripts inline, que la CSP bloquearía).
 *
 * Solo actúa si el propio <script> declara data-auth="protected":
 *   <script src="./src/services/session-boot.js" data-auth="protected"></script>
 *
 * Nota: la clave de storage y el TTL están replicados a propósito desde
 * config.js (STORAGE_KEYS.sesion / SESION_DURACION_MIN). Un script
 * bloqueante no puede importar módulos ES y debe decidir de inmediato;
 * si cambian allí, hay que actualizar aquí (decisión consciente, igual
 * que theme-boot.js con la cookie del tema).
 *
 * LIMITACIÓN: no es una frontera de seguridad (la auth es client-side).
 * Es una mejora de UX; rutaProtegida() sigue siendo la defensa en
 * profundidad dentro de cada controlador.
 */
(function () {
  var script = document.currentScript;
  if (!script || script.dataset.auth !== 'protected') return;

  var CLAVE_SESION = 'sesion';
  var DURACION_MIN = 60;
  var sesion = null;

  // Storage bloqueado o JSON corrupto => se trata como "sin sesión".
  try {
    var crudo = sessionStorage.getItem(CLAVE_SESION);
    sesion = crudo ? JSON.parse(crudo) : null;
  } catch {
    /* JSON corrupto o storage bloqueado: sesion queda en null */
  }

  // Misma regla que rutaProtegida(): _loginAt ausente => sesión vencida.
  var expirada = false;
  if (sesion) {
    var edadMs = Date.now() - (sesion._loginAt || 0);
    expirada = edadMs > DURACION_MIN * 60 * 1000;
  }

  if (!sesion || expirada) {
    // Red de seguridad: si el navegador alcanza a pintar el body antes de
    // procesar el replace, la regla html.auth-redirect body lo mantiene oculto.
    document.documentElement.classList.add('auth-redirect');

    if (expirada) {
      try {
        sessionStorage.removeItem(CLAVE_SESION);
      } catch {
        /* storage bloqueado: no hay nada que limpiar */
      }
    }

    // replace (no href): la página protegida no queda en el historial.
    window.location.replace('./login.html');
  }
})();
