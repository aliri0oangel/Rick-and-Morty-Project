import { loginUser, rutaPublica, RUTAS } from '../services/auth.js';
import { guardarSesion } from '../core/storage.js';
import { leerCookie, guardarRecordarCorreo } from '../core/cookies.js';
import { crearControlPassword, ponerBotonCargando, quitarBotonCargando } from '../ui/components.js';
import { COOKIE_KEYS, MAX_INTENTOS_LOGIN, BLOQUEO_INTENTOS_MIN } from '../config/config.js';
import { inicializarMallaCuantica } from '../ui/interactive-mesh.js';

/* --------------------------------------------------------------
 * Control de intentos fallidos (seguridad anti fuerza bruta).
 *
 * Se guarda en SessionStorage por correo => vive solo en esta pestaña.
 * LIMITACIÓN HONESTA: un atacante podría limpiarlo desde las DevTools;
 * la protección real de fuerza bruta DEBE vivir en el servidor. Aquí
 * sirve para dificultar pruebas manuales y como requisito didáctico.
 * -------------------------------------------------------------- */

/** Clave por correo (normalizada) dentro de SessionStorage. */
const claveIntentos = (correo) => `intentos_login:${correo.trim().toLowerCase()}`;

/**
 * Lee el estado de intentos de un correo.
 * @param {string} correo - Correo ingresado.
 * @returns {{fallidos: number, bloqueadoHasta: number}} Estado (0 = limpio).
 */
function leerIntentos(correo) {
  try {
    const crudo = sessionStorage.getItem(claveIntentos(correo));
    const dato = crudo ? JSON.parse(crudo) : null;
    return {
      fallidos: dato?.fallidos || 0,
      bloqueadoHasta: dato?.bloqueadoHasta || 0,
    };
  } catch {
    return { fallidos: 0, bloqueadoHasta: 0 };
  }
}

/**
 * Registra un intento fallido; bloquea al llegar al máximo.
 * @param {string} correo - Correo ingresado.
 * @returns {{bloqueado: boolean, restantes: number}}
 */
function registrarIntentoFallido(correo) {
  const estado = leerIntentos(correo);
  const fallidos = estado.fallidos + 1;
  const bloqueado = fallidos >= MAX_INTENTOS_LOGIN;

  const nuevo = {
    fallidos,
    // Si bloquea, se fija el momento en que podrá reintentar.
    bloqueadoHasta: bloqueado ? Date.now() + BLOQUEO_INTENTOS_MIN * 60 * 1000 : 0,
  };

  try {
    sessionStorage.setItem(claveIntentos(correo), JSON.stringify(nuevo));
  } catch {
    // Storage bloqueado: no se rompe el login, solo sigue sin límite.
  }

  return { bloqueado, restantes: Math.max(0, MAX_INTENTOS_LOGIN - fallidos) };
}

/** Limpia el contador tras un login exitoso. */
function limpiarIntentos(correo) {
  try {
    sessionStorage.removeItem(claveIntentos(correo));
  } catch {
    /* sin storage no hay contador que limpiar */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  rutaPublica();

  // Fondo interactivo: Malla Cuántica Multiversal (Opción 2)
  const canvasMalla = document.querySelector('#canvas-malla');
  if (canvasMalla) {
    inicializarMallaCuantica(canvasMalla);
  }

  const form_login = document.querySelector('#form_login');
  const inputCorreo = document.querySelector('#correo');
  const inputPassword = document.querySelector('#password');
  const checkRecordar = document.querySelector('#recordar_correo');
  const btn_login = document.querySelector('button[type="submit"]');
  const errorGeneral = document.querySelector('#error-general');

  // Botón ojo para mostrar/ocultar la contraseña (T3.1).
  if (inputPassword) crearControlPassword(inputPassword);

  /**
   * Muestra el aviso general de error (role=alert => se anuncia ya).
   * @param {string} mensaje
   * @returns {void}
   */
  const mostrarError = (mensaje) => {
    errorGeneral.textContent = mensaje;
    errorGeneral.classList.remove('hidden');
  };

  /** Oculta el aviso (login correcto). */
  const ocultarError = () => {
    errorGeneral.textContent = '';
    errorGeneral.classList.add('hidden');
  };

  /* --------------------------------------------------------------
   * Cookies (3er mecanismo): si existe la cookie "recordar_correo",
   * se precarga el correo y se marca la casilla.
   * -------------------------------------------------------------- */
  const correoRecordado = leerCookie(COOKIE_KEYS.recordarCorreo);
  if (correoRecordado) {
    inputCorreo.value = correoRecordado;
    if (checkRecordar) checkRecordar.checked = true;
  }

  // handler async: loginUser ahora es async (hash con Web Crypto).
  form_login.addEventListener('submit', async (e) => {
    e.preventDefault();

    const correo = inputCorreo.value.trim();
    const password = inputPassword.value.trim();
    const hudEstado = document.getElementById('hud-estado');
    const originalEstado = hudEstado?.textContent;

    if (correo === '' || password === '') {
      mostrarError('Por favor, completa todos los campos.');
      return;
    }

    /* --- 1) ¿Está bloqueado este correo? --- */
    const estado = leerIntentos(correo);
    if (estado.bloqueadoHasta > Date.now()) {
      const minutos = Math.ceil((estado.bloqueadoHasta - Date.now()) / (60 * 1000));
      mostrarError(`Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.`);
      return;
    }

    try {
      if (hudEstado) {
        hudEstado.textContent = 'SINCRONIZANDO...';
        hudEstado.className = 'text-brand font-semibold';
      }

      // T12.2: spinner + aria-busy + ancho estable mientras se autentica
      // (se RESTAURA en el catch; en el éxito queda hasta la redirección).
      ponerBotonCargando(btn_login, 'Conectando portal...');

      /* --- 2) Autenticación (async por el hash) --- */
      const resultado = await loginUser(correo, password);

      if (!resultado.exito) {
        throw new Error(resultado.mensaje);
      }

      /* --- 3) Éxito --- */
      limpiarIntentos(correo);
      ocultarError();
      // El botón conserva el estado de carga durante la pausa de redirect
      // (T12.2): disabled + spinner ya vienen de ponerBotonCargando.

      /* --------------------------------------------------------------
       * Cookie de preferencia: crear/borrar según la casilla, SIEMPRE
       * después del login exitoso (nunca se guarda un correo fallido).
       * -------------------------------------------------------------- */
      guardarRecordarCorreo(checkRecordar?.checked === true, correo);

      /* --- 4) Sesión SIN contraseña (ni en claro ni hasheada) ---
       * Las credenciales jamás deben viajar en la sesión (seguridad). */
      const { password: _omitida, ...enSesion } = resultado.usuario;
      guardarSesion(enSesion);

      setTimeout(() => {
        window.location.href = RUTAS.index;
      }, 1000);
    } catch (error) {
      // T12.2: se restaura el botón para permitir el reintento.
      quitarBotonCargando(btn_login);
      const { bloqueado, restantes } = registrarIntentoFallido(correo);
      mostrarError(
        bloqueado
          ? `Cuenta bloqueada temporalmente (${BLOQUEO_INTENTOS_MIN} min) por intentos fallidos.`
          : `${error.message} Intentos restantes: ${restantes}.`
      );

      // Efecto Glitch de Error
      form_login.classList.add('glitch-error');
      setTimeout(() => form_login.classList.remove('glitch-error'), 300);

      if (hudEstado) {
        hudEstado.textContent = 'ERROR DE ACCESO';
        hudEstado.className = 'text-danger font-semibold';
        setTimeout(() => {
          hudEstado.textContent = originalEstado || 'SINCRONIZADO';
          hudEstado.className = 'text-info font-semibold';
        }, 3000);
      }
    }
  });
});
