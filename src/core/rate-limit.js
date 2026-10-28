/**
 * rate-limit.js — Límite de peticiones client-side (Fase 7 / T7.1).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: no saturar la API de Rick and Morty con
 * ráfagas de la propia interfaz (búsqueda + paginación + reveal).
 *
 * Implementación: TOKEN BUCKET clásico.
 *  - Hay N fichas; cada petición consume 1.
 *  - Las fichas se recargan 1 cada X ms (recarga continua).
 *  - Si no hay ficha, la llamada ESPERA en cola FIFO (no se descarta):
 *    la UI sigue funcional, solo se serializa un poco.
 *
 * LÍMITE HONESTO documentado: esto NO protege contra un atacante real
 * (puede llamar a la API directamente). Es control de concurrencia de
 * la propia aplicación, no seguridad de servidor.
 *
 * Extras para red (T7.1): cola FIFO + espera utilizable también como
 * "backoff" cuando la API responde 429.
 */

import { API_RATE_MAX_TOKENS, API_RATE_RECARGA_MS, API_TIMEOUT_MS } from '../config/config.js';

/** Fichas disponibles (se consume 1 por petición autorizada). */
let fichas = API_RATE_MAX_TOKENS;

/** Cola FIFO de peticiones esperando ficha. */
const cola = [];

/** ¿Hay un temporizador de recarga en marcha? (evita timers duplicados) */
let relojRecargaActivo = false;

/** Identificador del temporizador de recarga (para detenerlo al vaciar la cola). */
let idTemporizador = 0;

/**
 * Procesa la cola mientras haya fichas (resuelve promesas en orden FIFO).
 * @returns {void}
 */
function procesarCola() {
  while (fichas > 0 && cola.length > 0) {
    fichas--;
    const siguiente = cola.shift();
    siguiente();
  }
}

/**
 * Asegura que el temporizador de recarga esté corriendo.
 * @returns {void}
 */
function asegurarRecarga() {
  if (relojRecargaActivo || cola.length === 0) return;
  relojRecargaActivo = true;
  idTemporizador = setInterval(() => {
    if (fichas < API_RATE_MAX_TOKENS) {
      fichas++;
      procesarCola();
    }
    // El timer vive solo mientras la cola tenga trabajo real.
    if (cola.length === 0) {
      relojRecargaActivo = false;
      clearInterval(idTemporizador);
    }
  }, API_RATE_RECARGA_MS);
}

/**
 * Espera el turno antes de hacer una petición a la API.
 * Resuelve cuando se consume una ficha (inmediato si hay disponibilidad).
 * @returns {Promise<void>}
 */
export function esperarTurno() {
  return new Promise((resolver) => {
    if (fichas > 0) {
      fichas--;
      resolver();
      return;
    }
    cola.push(resolver);
    asegurarRecarga();
  });
}

/**
 * Espera ms arbitrarios (backoff tras 429 o reintento).
 * No consume fichas: es solo una pausa deliberada.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 */
export function esperar(ms) {
  const tope = Math.max(0, Math.min(ms, API_TIMEOUT_MS * 2));
  return new Promise((resolver) => setTimeout(resolver, tope));
}
