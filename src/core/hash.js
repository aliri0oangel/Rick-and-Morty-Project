/**
 * hash.js — Hasheado de contraseñas con Web Crypto (SRP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: convertir una contraseña en un hash con salt
 * y verificar coincidencias. NO conoce usuarios, storage ni DOM.
 *
 * Formato persistido:  sha256:<salt>:<hash>
 *   - salt: 16 bytes aleatorios en hex => dos usuarios iguales tienen
 *           hashes distintos (evita rainbow tables).
 *   - hash: SHA-256 de "salt:contraseña" en hex.
 *
 * ADVERTENCIA honesta (seguridad real):
 *  esto MITIGA el riesgo de leer contraseñas en claro desde las
 *  DevTools de localStorage, pero NO sustituye a un backend con
 *  hashing lento (bcrypt/argon2) + HTTPS + rate limiting en servidor.
 *
 * Requisito de plataforma: crypto.subtle solo existe en contextos
 * seguros (https o localhost). Fuera de ellos se usa el modo legado
 * (texto plano) con un console.warn — nunca se rompe la aplicación.
 */

/** Prefijo del formato de hash almacenado. */
const PREFIJO = 'sha256';

/**
 * ¿El navegador expone Web Crypto en contexto seguro?
 * @returns {boolean}
 */
export function soportaHash() {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
}

/**
 * ¿Este valor guardado ya tiene formato de hash nuestro?
 * @param {string} valor - Valor leído del storage.
 * @returns {boolean}
 */
export function esHash(valor) {
  return typeof valor === 'string' && valor.startsWith(`${PREFIJO}:`);
}

/**
 * Genera un salt aleatorio de 16 bytes en texto hexadecimal.
 * @returns {string} Salt en hex (32 caracteres).
 */
function generarSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // spread + toString(16) por byte => hex de 2 dígitos c/u.
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula SHA-256 en hex sobre un texto.
 * @param {string} texto - Texto a hashear.
 * @returns {Promise<string>} Hash hexadecimal.
 */
async function sha256(texto) {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashea una contraseña con salt nuevo.
 * @param {string} password - Contraseña en claro.
 * @returns {Promise<string>} "sha256:<salt>:<hash>" listo para storage.
 */
export async function hashearPassword(password) {
  const salt = generarSalt();
  const hash = await sha256(`${salt}:${password}`);
  return `${PREFIJO}:${salt}:${hash}`;
}

/**
 * Comparación que no corta en la primera diferencia distinta
 * (timing-safe aproximado): reduce el canal lateral de tiempo.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function compararSeguro(a, b) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

/**
 * Verifica una contraseña contra el valor guardado.
 * Soporta migración: si el valor es legado (en claro), compara directo
 * y devuelve legacy=true para que el caller lo re-hashee al iniciar sesión.
 * @param {string} password - Contraseña ingresada por el usuario.
 * @param {string} guardado - Valor almacenado (hash o legado).
 * @returns {Promise<{coincide: boolean, legacy: boolean}>}
 */
export async function verificarPassword(password, guardado) {
  if (!esHash(guardado)) {
    // Usuario creado antes de esta fase => texto plano en storage.
    return {
      coincide: compararSeguro(String(guardado ?? ''), String(password)),
      legacy: true,
    };
  }

  // formato: sha256:<salt>:<hash>
  const [, salt, hash] = String(guardado).split(':');
  const intento = await sha256(`${salt}:${password}`);
  return { coincide: compararSeguro(intento, hash), legacy: false };
}
