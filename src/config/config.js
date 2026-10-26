/**
 * config.js — Constantes globales del sistema (Principio DRY y SRP).
 * ---------------------------------------------------------------
 * Centraliza TODOS los "magic strings" de la aplicación: URLs de la API,
 * claves de almacenamiento y rutas de navegación.
 *
 * ¿Por qué un solo archivo?
 *  - Si la API o las claves cambian, se toca UN solo lugar (Open/Closed).
 *  - Evita que storage.js, auth.js o api.js dupliquen literales y diverjan.
 *
 * Mapa de almacenamiento con su propósito (requisito del enunciado):
 *  - LocalStorage  -> usuarios registrados y favoritos (persisten siempre).
 *  - SessionStorage-> sesión del usuario (muere al cerrar la pestaña).
 *  - Cookies       -> preferencias de UI (recordar correo en login).
 */

/* ----------------------------------------------------------------
 * API pública de Rick and Morty
 * ---------------------------------------------------------------- */
export const API_BASE = 'https://rickandmortyapi.com/api';

/* Timeout de peticiones: si la API no responde en X ms, se aborta
 * para no dejar al usuario en un estado de carga infinito. */
export const API_TIMEOUT_MS = 8000;

/* Rate limiting client-side (Fase 7 / T7.1): token bucket sobre la API.
 * LÍMITE HONESTO: un atacante puede quitar estas restricciones desde
 * las DevTools; la protección real de rate limit DEBE vivir en el
 * servidor. Aquí protege contra ráfagas accidentales de la propia UI. */
export const API_RATE_MAX_TOKENS = 6;
export const API_RATE_RECARGA_MS = 400; // 1 token nuevo cada 400ms (~2.5 req/s sostenidas)

/* Reintentos con backoff exponencial ante fallos TRANSITORIOS de red
 * (timeout, 5xx, 429). Los 404 de negocio ("nothing here") NUNCA
 * se reintentan: no son errores de red. */
export const API_REINTENTOS = 2;
export const API_BACKOFF_MS = 300; // 300ms · 600ms

/* ----------------------------------------------------------------
 * Claves de almacenamiento del navegador
 * ---------------------------------------------------------------- */
export const STORAGE_KEYS = {
  /** LocalStorage: lista de usuarios registrados. */
  usuarios: 'usuarios',
  /** SessionStorage: sesión activa del usuario logueado. */
  sesion: 'sesion',
  /** LocalStorage: prefijo base de favoritos (se añade :<usuarioId>). */
  favoritos: 'favoritos',
};

/* ----------------------------------------------------------------
 * Cookies (tercer mecanismo, propósito distinto a LS/SS)
 * ---------------------------------------------------------------- */
export const COOKIE_KEYS = {
  /** Cookie que recuerda el correo del usuario en el login. */
  recordarCorreo: 'recordar_correo',
  /** Cookie de preferencia de tema (claro/oscuro) de la interfaz. */
  tema: 'tema',
};

/** Días de vida de la cookie "recordar correo". */
export const COOKIE_DIAS_RECORDAR = 30;

/* ----------------------------------------------------------------
 * Rutas de navegación del sistema
 * ---------------------------------------------------------------- */
export const RUTAS = {
  login: './login.html',
  index: './index.html',
  favoritos: './favorites.html',
  registro: './register.html',
  detalle: './character.html',
  cuenta: './mi_account.html',
};

/* ----------------------------------------------------------------
 * Parámetros de seguridad / sesión
 * ---------------------------------------------------------------- */
/** Duración de la sesión en minutos (expira y redirige al login). */
export const SESION_DURACION_MIN = 60;

/** Intentos fallidos de login permitidos antes de bloquear temporalmente. */
export const MAX_INTENTOS_LOGIN = 5;

/** Minutos de bloqueo tras superar los intentos fallidos de login. */
export const BLOQUEO_INTENTOS_MIN = 2;
