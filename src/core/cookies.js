/**
 * cookies.js — Tercer mecanismo de almacenamiento del navegador (SRP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: crear, leer y borrar cookies de la aplicación.
 *
 * ¿Por qué cookies si ya existen LocalStorage y SessionStorage?
 *  - LocalStorage  -> datos que sobreviven a la sesión (usuarios, favoritos).
 *  - SessionStorage-> sesión viva que muere al cerrar la pestaña.
 *  - Cookies       -> datos que el servidor Y el cliente pueden leer,
 *                     aquí se usan para PREFERENCIAS de UI que deben
 *                     recordarse entre visitas sin iniciar sesión
 *                     (ej: el correo a prellenar en el login).
 *
 * Seguridad aplicada:
 *  - SameSite=Lax  -> la cookie no se envía en peticiones cross-site (CSRF).
 *  - path=/        -> visible en toda la aplicación.
 *  - NUNCA se guardan contraseñas ni datos sensibles en cookies.
 */

import { COOKIE_KEYS, COOKIE_DIAS_RECORDAR } from '../config/config.js';

/**
 * Crea o sobrescribe una cookie con fecha de expiración.
 * @param {string} nombre  - Nombre de la cookie.
 * @param {string} valor   - Valor texto (se codifica automáticamente).
 * @param {number} [dias]  - Días de vigencia. 0 = cookie de sesión.
 * @returns {void}
 */
export function crearCookie(nombre, valor, dias = COOKIE_DIAS_RECORDAR) {
  // Sanitización básica: nunca inyectar caracteres invalidos en document.cookie
  const valorSeguro = encodeURIComponent(valor);

  let expiracion = '';
  if (dias > 0) {
    const fecha = new Date();
    // Se fija la fecha "dias" en el futuro a partir de ahora.
    fecha.setTime(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
    expiracion = `; expires=${fecha.toUTCString()}`;
  }

  // Construcción manual de la cadena Set-Cookie que entiende el navegador.
  // Secure SOLO en https (en http://localhost el navegador ignoraría la cookie).
  const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${nombre}=${valorSeguro}` + `${expiracion}; path=/; SameSite=Lax${seguro}`;
}

/**
 * Lee el valor de una cookie por su nombre.
 * @param {string} nombre - Nombre de la cookie.
 * @returns {string|null} Valor decodificado o null si no existe.
 */
export function leerCookie(nombre) {
  // document.cookie devuelve "a=1; b=2; c=3" en un solo string.
  const busqueda = `${nombre}=`;
  const partes = document.cookie.split('; ');

  for (const parte of partes) {
    if (parte.startsWith(busqueda)) {
      return decodeURIComponent(parte.slice(busqueda.length));
    }
  }
  return null; // No encontrada
}

/**
 * Elimina una cookie existente (misma ruta que al crearla).
 * @param {string} nombre - Nombre de la cookie.
 * @returns {void}
 */
export function borrarCookie(nombre) {
  // Ponemos expiración en el pasado => el navegador la descarta.
  const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${seguro}`;
}

/**
 * Conveniencia: guarda o borra el correo a recordar según la casilla.
 * @param {boolean} activar   - ¿Marcar "recordar mi correo"?
 * @param {string}  correo    - Correo del usuario.
 * @returns {void}
 */
export function guardarRecordarCorreo(activar, correo) {
  if (activar) {
    crearCookie(COOKIE_KEYS.recordarCorreo, correo, COOKIE_DIAS_RECORDAR);
  } else {
    borrarCookie(COOKIE_KEYS.recordarCorreo);
  }
}
