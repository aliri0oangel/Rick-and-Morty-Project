/**
 * favoritos.js — Repositorio de favoritos por usuario (SRP + DIP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: persistir en LocalStorage la lista de
 * favoritos del usuario ACTUAL, aislada por usuario.
 *
 * Aislamiento entre cuentas (requisito del enunciado):
 *  la clave es "favoritos:<usuarioId>" => dos usuarios NUNCA comparten
 *  lista, y los favoritos NO se borran al hacer logout (solo LS lo sabe).
 *
 * Almacena el objeto completo del personaje (no solo el id) para poder
 * pintar la futura página de favoritos sin volver a llamar a la API.
 */

import { STORAGE_KEYS } from '../config/config.js';

/**
 * Construye la clave de storage única para cada usuario.
 * @param {string|number} usuarioId - Id o correo del usuario en sesión.
 * @returns {string} Clave tipo "favoritos:correo@x.com".
 */
function claveDe(usuarioId) {
  return `${STORAGE_KEYS.favoritos}:${String(usuarioId)}`;
}

/**
 * Lista los favoritos de un usuario.
 * @param {string|number} usuarioId - Usuario dueño de la lista.
 * @returns {Array<Object>} Personajes favoritos (o [] si no hay/falla).
 */
export function obtenerFavoritos(usuarioId) {
  if (!usuarioId) return [];
  try {
    const crudo = localStorage.getItem(claveDe(usuarioId));
    const lista = crudo ? JSON.parse(crudo) : [];
    // Defensa: si el dato está corrupto o no es array, devolvemos [].
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

/**
 * ¿Es este personaje favorito del usuario?
 * @param {string|number} usuarioId - Usuario.
 * @param {string|number} personajeId - Id del personaje.
 * @returns {boolean}
 */
export function esFavorito(usuarioId, personajeId) {
  return obtenerFavoritos(usuarioId).some((p) => String(p.id) === String(personajeId));
}

/**
 * Persiste la lista completa de favoritos del usuario.
 * @param {string|number} usuarioId - Usuario dueño.
 * @param {Array<Object>} lista - Lista a guardar.
 * @returns {boolean} true si se guardó correctamente.
 */
function persistir(usuarioId, lista) {
  try {
    localStorage.setItem(claveDe(usuarioId), JSON.stringify(lista));
    return true;
  } catch {
    // Storage lleno/bloqueado: el caller decide qué mostrar.
    return false;
  }
}

/**
 * Agrega un personaje a favoritos (si aún no está).
 * @param {string|number} usuarioId - Usuario dueño.
 * @param {Object} personaje - Personaje crudo completo de la API.
 * @returns {boolean} true si quedó agregado.
 */
export function agregarFavorito(usuarioId, personaje) {
  const lista = obtenerFavoritos(usuarioId);
  if (lista.some((p) => String(p.id) === String(personaje.id))) {
    return false; // ya existía, sin duplicados
  }
  lista.push(personaje);
  return persistir(usuarioId, lista);
}

/**
 * Elimina un personaje de favoritos por su id.
 * @param {string|number} usuarioId - Usuario dueño.
 * @param {string|number} personajeId - Id a eliminar.
 * @returns {boolean} true si se quitó.
 */
export function quitarFavorito(usuarioId, personajeId) {
  const lista = obtenerFavoritos(usuarioId);
  // Se conservan SOLO los que NO coinciden con el id a eliminar.
  const restantes = lista.filter((p) => String(p.id) !== String(personajeId));
  if (restantes.length === lista.length) return false; // no estaba
  return persistir(usuarioId, restantes);
}

/**
 * Alterna el estado de favorito de un personaje (patrón toggle).
 * @param {string|number} usuarioId - Usuario dueño.
 * @param {Object} personaje - Personaje crudo.
 * @returns {{estado: boolean, guardado: boolean}} Nuevo estado + si se persistió.
 */
export function alternarFavorito(usuarioId, personaje) {
  const esta = esFavorito(usuarioId, personaje.id);

  if (esta) {
    const ok = quitarFavorito(usuarioId, personaje.id);
    return { estado: false, guardado: ok };
  }
  const ok = agregarFavorito(usuarioId, personaje);
  return { estado: true, guardado: ok };
}

/**
 * MIGRA la lista de favoritos de una clave de usuario a otra.
 * Caso de uso real: un usuario registrado ANTES de existir el id estable
 * tenía la lista bajo "favoritos:<correo>"; si luego cambia de correo o
 * se le asigna un id, sin esta migración PERDERÍA sus favoritos.
 * @param {string|number} claveAntigua - Clave origen (ej: correo viejo).
 * @param {string|number} claveNueva   - Clave destino (id estable).
 * @returns {boolean} true si había datos que migrar.
 */
export function migrarFavoritos(claveAntigua, claveNueva) {
  if (!claveAntigua || !claveNueva || String(claveAntigua) === String(claveNueva)) {
    return false; // nada que hacer
  }

  const origen = obtenerFavoritos(claveAntigua);
  if (origen.length === 0) return false; // no había lista previa

  // Se fusiona sin duplicar con la lista destino (por si ya tenía algo).
  const destino = obtenerFavoritos(claveNueva);
  const idsExistentes = new Set(destino.map((p) => String(p.id)));
  const fusion = [...destino, ...origen.filter((p) => !idsExistentes.has(String(p.id)))];

  const ok = persistir(claveNueva, fusion);
  if (ok) {
    // Solo se borra la clave vieja si la nueva quedó persistida.
    localStorage.removeItem(claveDe(claveAntigua));
  }
  return ok;
}
