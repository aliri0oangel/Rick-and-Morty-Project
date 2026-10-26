/**
 * account.js — Controlador de "Mi cuenta" (Composición).
 * -------------------------------------------------------------------
 * Responsabilidad: cargar los datos del usuario en sesión, validar el
 * formulario de edición y orquestar la actualización (auth) + la
 * migración de favoritos (favoritos) + la sesión (storage).
 *
 * Fase 2: los 5 campos del formulario se construyen con el componente
 * FormField (label + input.campo + span de error con aria), lo que
 * elimina el marcado repetido del HTML y garantiza la accesibilidad
 * de cada campo de forma uniforme. La validación sigue intacta
 * (validators.js escribe en #error-<id> — mismo contrato).
 */

import { rutaProtegida, idDeUsuario, actualizarUsuario } from '../services/auth.js';
import { obtenerSesion, guardarSesion } from '../core/storage.js';
import {
  validarCampo,
  validarCoincidencia,
  mostrarErrores,
  mostrarExito,
  limpiarCampos,
} from '../domain/validators.js';
import { migrarFavoritos, obtenerFavoritos } from '../services/favorites-repository.js';
import { crearCampo, crearControlPassword, mostrarToast } from '../ui/components.js';
import { montarHeader } from '../ui/header.js';

/** Definición declarativa de los campos (fuente única: HTML y aria). */
const DEFINICION_CAMPOS = [
  { id: 'nombre', etiqueta: 'Nombre:', tipo: 'text', autocomplete: 'name' },
  { id: 'apellido', etiqueta: 'Apellido:', tipo: 'text', autocomplete: 'family-name' },
  { id: 'correo', etiqueta: 'Correo electrónico:', tipo: 'email', autocomplete: 'email' },
  {
    id: 'password',
    etiqueta: 'Nueva contraseña:',
    tipo: 'password',
    placeholder: 'Déjala en blanco para no cambiarla',
    autocomplete: 'new-password',
  },
  {
    id: 'confirm_password',
    etiqueta: 'Confirmar contraseña:',
    tipo: 'password',
    autocomplete: 'new-password',
  },
];

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- Seguridad de rutas ---------------- */
  rutaProtegida();

  const sesion = obtenerSesion();
  const usuarioId = idDeUsuario(sesion);

  /* ---------------- Header unificado (T2.1) ---------------- */
  const header = montarHeader({ sesion, activo: null });

  /* ---------------- Campos del formulario (FormField) ---------------- */
  const contenedorCampos = document.getElementById('campos-cuenta');
  if (contenedorCampos) {
    const fragmento = document.createDocumentFragment();
    for (const opciones of DEFINICION_CAMPOS) {
      fragmento.appendChild(crearCampo(opciones));
    }
    contenedorCampos.replaceChildren(fragmento);
  }

  /* ---------------- Resumen de perfil (T3.5) ---------------- */
  // Tarjeta tubo con nombre, correo y nº de favoritos: contexto inmediato
  // antes de editar. Se re-pinta tras cada guardado exitoso.
  const nodoResumen = document.getElementById('resumen-cuenta');

  /**
   * Pinta (o repinta) el resumen de la sesión ACTUAL.
   * Relee la sesión en cada llamada: tras guardar, la copia del closure
   * estaría obsoleta y el resumen mostraría los datos antiguos (bug real
   * detectado en los tests T10.2 de migración de correo).
   * @returns {void}
   */
  function pintarResumen() {
    const actual = obtenerSesion();
    if (!nodoResumen || !actual) return;
    const nFavoritos = obtenerFavoritos(idDeUsuario(actual)).length;
    const nombreCompleto = `${actual.nombre || ''} ${actual.apellido || ''}`.trim();

    nodoResumen.className = 'tubo-card cursor-default p-5 w-full max-w-md mb-6';
    // Plantilla estática propia; los datos se pueblan con textContent (anti-XSS).
    nodoResumen.innerHTML = `
      <p class="text-ink font-medium text-lg" data-campo="nombre"></p>
      <p class="text-dim text-sm" data-campo="correo"></p>
      <p class="microcopy mt-3" data-campo="favoritos"></p>`;
    nodoResumen.querySelector('[data-campo="nombre"]').textContent =
      nombreCompleto || actual.correo || 'Sin nombre';
    nodoResumen.querySelector('[data-campo="correo"]').textContent = actual.correo || '';
    nodoResumen.querySelector('[data-campo="favoritos"]').textContent =
      `favoritos guardados: ${nFavoritos}`;
  }

  pintarResumen();

  /* ---------------- Elementos del formulario ---------------- */
  const form = document.getElementById('form_cuenta');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputCorreo = document.getElementById('correo');
  const inputPassword = document.getElementById('password');
  const inputConfirm = document.getElementById('confirm_password');
  const errorGeneral = document.getElementById('error-general');
  const btnGuardar = document.getElementById('btn_guardar');

  // Botón ojo en ambas; medidor de fuerza SOLO en la Nueva contraseña
  // (M2: donde se crea/cambia la clave; el confirmar no la evalúa).
  if (inputPassword) crearControlPassword(inputPassword, { conMedidor: true });
  if (inputConfirm) crearControlPassword(inputConfirm);

  /**
   * Muestra el aviso general de error (role=alert => se anuncia ya).
   * @param {string} mensaje
   * @returns {void}
   */
  const mostrarErrorGeneral = (mensaje) => {
    errorGeneral.textContent = mensaje;
    errorGeneral.classList.remove('hidden');
  };

  /** Oculta el aviso general. */
  const ocultarErrorGeneral = () => {
    errorGeneral.textContent = '';
    errorGeneral.classList.add('hidden');
  };

  const todosCampos = DEFINICION_CAMPOS.map((c) => c.id);

  /* ---------------- Precarga desde la sesión ---------------- */
  // Se pinta lo que ya existe; la contraseña NUNCA se precarga (seguridad).
  inputNombre.value = sesion.nombre || '';
  inputApellido.value = sesion.apellido || '';
  inputCorreo.value = sesion.correo || '';

  /* ---------------- Validación en blur (patrón de register) ---------------- */
  const camposConValidacion = {
    nombre: inputNombre,
    apellido: inputApellido,
    correo: inputCorreo,
  };

  for (const [tipo, input] of Object.entries(camposConValidacion)) {
    input.addEventListener('blur', () => {
      const resultado = validarCampo(tipo, input.value.trim(), tipo);
      resultado.error ? mostrarErrores(resultado) : mostrarExito(resultado);
    });
  }

  /**
   * Regla especial de contraseña en edición:
   *  - Ambas vacías  => válido (no se cambia nada).
   *  - Ambas con dato => deben coincidir Y cumplir la política de seguridad.
   *  - Solo una      => error claro.
   * @returns {{error: boolean, campo: string, mensaje: string}}
   */
  const validarPasswordEdicion = () => {
    const pass = inputPassword.value;
    const conf = inputConfirm.value;

    if (pass === '' && conf === '') {
      return { error: false, campo: 'password', mensaje: 'Campo válido' };
    }
    if (pass === '' || conf === '') {
      return {
        error: true,
        campo: pass === '' ? 'password' : 'confirm_password',
        mensaje: 'Completa ambas contraseñas o déjalas en blanco.',
      };
    }
    // Se valida la política de seguridad sobre la nueva contraseña.
    const politica = validarCampo('password', pass, 'contraseña');
    if (politica.error) return politica;

    // Y que coincidan entre sí.
    return validarCoincidencia(pass, conf);
  };

  inputPassword.addEventListener('blur', () => {
    const r = validarPasswordEdicion();
    // Solo se marca la contraseña si el problema es de ELLA (no del confirm).
    if (r.campo === 'password') {
      r.error ? mostrarErrores(r) : mostrarExito(r);
    }
  });
  inputConfirm.addEventListener('blur', () => {
    const r = validarPasswordEdicion();
    if (r.campo === 'confirm_password') {
      r.error ? mostrarErrores(r) : mostrarExito(r);
    }
  });

  /* ---------------- Envío ---------------- */
  // handler async: actualizarUsuario ahora es async (hash con Web Crypto).
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    // Se limpian estados previos de todos los campos.
    limpiarCampos(todosCampos);
    ocultarErrorGeneral();

    const cambios = {
      nombre: inputNombre.value.trim(),
      apellido: inputApellido.value.trim(),
      correo: inputCorreo.value.trim(),
      password: inputPassword.value, // vacío => no se modifica
    };

    /* --- 1) Validaciones de campos obligatorios --- */
    const errores = [];
    for (const tipo of ['nombre', 'apellido', 'correo']) {
      const r = validarCampo(tipo, cambios[tipo], tipo);
      if (r.error) errores.push(r);
    }

    /* --- 2) Política de contraseña (opcional en edición) --- */
    const rPass = validarPasswordEdicion();
    if (rPass.error) errores.push(rPass);

    if (errores.length > 0) {
      errores.forEach((r) => (r.error ? mostrarErrores(r) : mostrarExito(r)));
      return; // el formulario NO se procesa hasta ser válido (enunciado)
    }

    /* --- 3) Persistencia vía auth.js (SRP: aquí no se toca el storage) --- */
    const resultado = await actualizarUsuario(usuarioId, cambios);

    if (!resultado.exito) {
      if (resultado.campo) {
        mostrarErrores(resultado);
      } else {
        mostrarErrorGeneral(resultado.mensaje);
      }
      return;
    }

    /* --- 4) Migración de favoritos si cambió la clave de usuario --- */
    // (usuario legacy sin id, o correo re-mapeado) — evita perder la lista.
    migrarFavoritos(resultado.claveAntigua, resultado.claveNueva);

    /* --- 5) Sesión actualizada: el nombre nuevo se refleja YA en header --- */
    // Se omite password: las credenciales no viajan en la sesión.
    const { password: _omitida, ...enSesion } = resultado.usuario;
    guardarSesion(enSesion);
    header.actualizarNombre(enSesion.nombre || enSesion.correo);

    /* --- 6) Feedback de éxito (sin redirigir: los cambios son inmediatos) --- */
    form.reset();
    inputNombre.value = resultado.usuario.nombre;
    inputApellido.value = resultado.usuario.apellido;
    inputCorreo.value = resultado.usuario.correo;
    // Sesión local ya actualizada arriba => el resumen se repinta al toque.
    pintarResumen();
    mostrarToast('Datos actualizados correctamente.');

    // El botón se deshabilita un instante para evitar doble envío.
    btnGuardar.disabled = true;
    btnGuardar.classList.add('opacity-50', 'cursor-not-allowed');
    setTimeout(() => {
      btnGuardar.disabled = false;
      btnGuardar.classList.remove('opacity-50', 'cursor-not-allowed');
    }, 1200);
  });
});
