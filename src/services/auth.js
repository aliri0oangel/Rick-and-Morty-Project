/**
 * auth.js — Reglas de autenticación y rutas protegidas (SRP).
 * -------------------------------------------------------------------
 * Responsabilidad ÚNICA: quién puede ver qué página y qué pasa al
 * registrarse/iniciar sesión/cerrar sesión. NO conoce el detalle del
 * DOM (eso vive en login.js, register.js, index.js... => bajo acoplamiento).
 *
 * Patrón aplicado: cada función devuelve un objeto-resultado
 * ({ exito, mensaje, ... }) en vez de lanzar excepciones ni usar alert,
 * para que la capa de vista decida cómo pintar.
 */

import { guardarUser, obtenerUser, obtenerSesion, borrarSesion } from '../core/storage.js';
import { RUTAS, SESION_DURACION_MIN } from '../config/config.js';
import { soportaHash, hashearPassword, verificarPassword } from '../core/hash.js';

/* Re-exportamos RUTAS desde la fuente única de verdad (config.js) para
 * no romper a los consumidores existentes (login.js, register.js)
 * y evitar literales duplicados — principio DRY. */
export { RUTAS };

/** Normaliza el correo: sin espacios y en minúsculas (consistencia). */
const normalizar = (correo) => correo.trim().toLowerCase();

/**
 * Genera un id único y estable para un usuario nuevo.
 * Se usa como clave de aislamiento de favoritos (no el correo, que puede
 * cambiar desde "Mi cuenta" y perdería la lista del usuario).
 * @returns {string} Id único.
 */
function generarIdUsuario() {
  // randomUUID requiere contexto seguro (localhost/https); el fallback
  // por timestamp+random cubre el caso de abrir por file://.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Devuelve el id estable de un usuario en sesión.
 * Prioriza el id inmutable y hace fallback al correo para usuarios
 * antiguos que no fueron creados con id (compatibilidad).
 * @param {Object} usuario - Usuario en sesión.
 * @returns {string} Id usado como clave de favoritos.
 */
export function idDeUsuario(usuario) {
  if (!usuario) return '';
  return usuario.id || normalizar(usuario.correo || '');
}

/**
 * Hashea una contraseña si la plataforma lo permite; si no (contexto no
 * seguro), la guarda en claro como fallback con advertencia explícita.
 * @param {string} password - Contraseña en claro.
 * @returns {Promise<string>} Valor a persistir en storage.
 */
async function protegerPassword(password) {
  if (soportaHash()) {
    return hashearPassword(password);
  }
  // Contexto no seguro (p.ej. file://): Web Crypto no está disponible.
  console.warn('[auth] Contexto no seguro: contraseña guardada sin hash. Usar localhost/https.');
  return password;
}

/**
 * Intenta autenticar a un usuario con correo y contraseña.
 * async/await (req. del enunciado): el hash exige operación asíncrona.
 * @param {string} correo   - Correo ingresado.
 * @param {string} password - Contraseña ingresada.
 * @returns {Promise<{exito: boolean, mensaje?: string, usuario?: Object}>}
 */
export const loginUser = async (correo, password) => {
  const usuarios = obtenerUser();
  // find devuelve undefined si no coincide => falsy en el if.
  const usuario = usuarios.find((u) => u.correo === normalizar(correo));

  // Mensaje genérico a propósito: no revelar si el correo existe (seguridad).
  if (!usuario) {
    return { exito: false, mensaje: 'Correo y/o contraseña incorrecta.' };
  }

  if (soportaHash()) {
    const { coincide, legacy } = await verificarPassword(password, usuario.password);

    if (!coincide) {
      return { exito: false, mensaje: 'Correo y/o contraseña incorrecta.' };
    }

    // Migración lazy: usuarios guardados en claro se re-hashean aquí,
    // sin pedirle nada al usuario y sin perder su cuenta.
    if (legacy) {
      usuario.password = await hashearPassword(password);
      guardarUser(usuarios);
    }
  } else if (usuario.password !== password) {
    return { exito: false, mensaje: 'Correo y/o contraseña incorrecta.' };
  }

  return { exito: true, usuario };
};

/**
 * Registra un usuario nuevo validando que el correo no esté en uso.
 * La contraseña se guarda hasheada (nunca en claro) — ver hash.js.
 * @param {Object} datos - { nombre, apellido, correo, password }
 * @returns {Promise<{exito: boolean, campo?: string, mensaje?: string}>}
 */
export const registrarUser = async (datos) => {
  const usuarios = obtenerUser();
  const yaExiste = usuarios.some((u) => u.correo === normalizar(datos.correo));

  if (yaExiste) {
    return {
      exito: false,
      campo: 'correo',
      mensaje: 'El correo ya está registrado.',
    };
  }

  // Se persiste la copia normalizada del correo en LocalStorage,
  // siempre con un id estable (clave de aislamiento de favoritos),
  // y la contraseña protegida con SHA-256 + salt.
  guardarUser([
    ...usuarios,
    {
      id: generarIdUsuario(),
      ...datos,
      password: await protegerPassword(datos.password),
      correo: normalizar(datos.correo),
    },
  ]);

  return { exito: true, mensaje: 'Usuario registrado correctamente.' };
};

/**
 * Actualiza los datos del usuario logueado (página "Mi cuenta").
 * Resuelve aquí la lógica de persistencia y unicidad de correo para que
 * el controlador solo pinte resultados (Separación de Concerns).
 *
 * @param {string} usuarioIdActual - Clave estable actual del usuario (id o correo).
 * @param {Object} cambios         - { nombre, apellido, correo, password? }
 *        password opcional: si viene vacío NO se modifica la contraseña.
 * @returns {Promise<{exito: boolean, campo?: string, mensaje?: string,
 *            usuario?: Object, claveAntigua?: string, claveNueva?: string}>}
 *          claveAntigua/claveNueva sirven al caller para migrar favoritos.
 */
export const actualizarUsuario = async (usuarioIdActual, cambios) => {
  const usuarios = obtenerUser();

  // Búsqueda por id estable, con fallback a correo (usuarios legacy).
  const indice = usuarios.findIndex((u) => (u.id || normalizar(u.correo)) === usuarioIdActual);

  if (indice === -1) {
    return { exito: false, mensaje: 'No se encontró el usuario en sesión.' };
  }

  const original = usuarios[indice];
  const correoNuevo = normalizar(cambios.correo);

  // Unicidad del correo: se excluye al propio usuario de la comparación.
  const correoOcupado = usuarios.some((u, i) => i !== indice && u.correo === correoNuevo);
  if (correoOcupado) {
    return {
      exito: false,
      campo: 'correo',
      mensaje: 'El correo ya está registrado.',
    };
  }

  const actualizado = {
    ...original,
    nombre: cambios.nombre,
    apellido: cambios.apellido,
    correo: correoNuevo,
  };

  // Solo se reemplaza la contraseña si llegó un valor nuevo (hasheada).
  if (cambios.password) {
    actualizado.password = await protegerPassword(cambios.password);
  }

  // Usuario legacy sin id => se le asigna uno estable ahora.
  if (!actualizado.id) {
    actualizado.id = generarIdUsuario();
  }

  usuarios[indice] = actualizado;
  guardarUser(usuarios);

  return {
    exito: true,
    mensaje: 'Datos actualizados correctamente.',
    usuario: actualizado,
    // Claves de favoritos ANTES y DESPUÉS (para la migración en el caller).
    claveAntigua: usuarioIdActual,
    claveNueva: actualizado.id || correoNuevo,
  };
};

/**
 * Valida que exista sesión ACTIVA (con token de tiempo no vencido).
 * Si no la hay => redirige al login. Usada por páginas protegidas.
 * @returns {void}
 */
export const rutaProtegida = () => {
  const usr = obtenerSesion();

  if (!usr) {
    window.location.href = RUTAS.login;
    return; // early return: evita continuar con sesión inválida
  }

  // Control de expiración: si la sesión superó su duración máxima,
  // se cierra automáticamente y se vuelve al login (seguridad).
  const edadMs = Date.now() - (usr._loginAt || 0);
  const expirada = edadMs > SESION_DURACION_MIN * 60 * 1000;

  if (expirada) {
    borrarSesion();
    window.location.href = RUTAS.login;
  }
};

/**
 * Protege las páginas PÚBLICAS (login/registro): si ya hay sesión,
 * manda al usuario al index para no mostrar el formulario otra vez.
 * @returns {void}
 */
export const rutaPublica = () => {
  const usr = obtenerSesion();

  if (usr) {
    window.location.href = RUTAS.index;
  }
};

/**
 * Cierra la sesión: borra SessionStorage y regresa al login.
 * LocalStorage (favoritos/usuarios) NO se toca (requisito del enunciado).
 * @returns {void}
 */
export const logOut = () => {
  borrarSesion();
  window.location.href = RUTAS.login;
};
