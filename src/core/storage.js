/**
 * storage.js — Adaptador de LocalStorage y SessionStorage (SRP + DIP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: leer/escribir datos del navegador SIN conocer
 * la estructura de negocio. Quién decide QUÉ guardar es quien lo importa
 * (auth.js, favoritos.js, etc.), no este módulo (Dependency Inversion).
 *
 * Justificación del enunciado: la sesión vive en SessionStorage porque
 * debe morir al cerrar la pestaña => evita sesiones fantasma sin logout.
 *
 * Todos los accesos están envueltos en try/catch porque el navegador
 * puede bloquear el storage (modo privado, cuota llena, política ITP).
 */

import { STORAGE_KEYS } from '../config/config.js';

/* ------------------------------------------------------------------
 * LocalStorage (persistencia de datos)
 * ------------------------------------------------------------------ */

/**
 * Guarda la lista completa de usuarios registrados.
 * @param {Array<Object>} usuarios - Usuarios a persistir.
 * @returns {void}
 */
export function guardarUser(usuarios) {
  localStorage.setItem(STORAGE_KEYS.usuarios, JSON.stringify(usuarios));
}

/**
 * Obtiene la lista de usuarios registrados.
 * @returns {Array<Object>} Lista de usuarios o [] si no hay nada/corre.
 */
export function obtenerUser() {
  try {
    const datos = localStorage.getItem(STORAGE_KEYS.usuarios);
    // JSON.parse falla con strings corruptos => devolvemos lista vacía.
    return datos ? JSON.parse(datos) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------
 * SessionStorage (sesión viva del usuario)
 * ------------------------------------------------------------------ */

/**
 * Crea/actualiza la sesión del usuario logueado.
 * @param {Object} sesion - Datos mínimos del usuario en sesión.
 * @returns {void}
 */
export function guardarSesion(sesion) {
  // Marcamos cuándo se creó para poder expirarla (seguridad).
  const conFecha = { ...sesion, _loginAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEYS.sesion, JSON.stringify(conFecha));
}

/**
 * Lee la sesión activa.
 * @returns {Object|null} Sesión o null si no existe o está corrupta.
 */
export function obtenerSesion() {
  try {
    const datos = sessionStorage.getItem(STORAGE_KEYS.sesion);
    return datos ? JSON.parse(datos) : null;
  } catch {
    return null;
  }
}

/**
 * Elimina la sesión (logout). No toca LocalStorage: los favoritos
 * y los usuarios deben sobrevivir al cierre de sesión (enunciado).
 * @returns {void}
 */
export function borrarSesion() {
  sessionStorage.removeItem(STORAGE_KEYS.sesion);
}
