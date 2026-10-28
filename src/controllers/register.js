import { registrarUser, rutaPublica, RUTAS } from '../services/auth.js';
import { crearControlPassword, mostrarToast } from '../ui/components.js';
import { inicializarMallaCuantica } from '../ui/interactive-mesh.js';
import {
  validarCampo,
  validarCoincidencia,
  mostrarErrores,
  mostrarExito,
  limpiarCampos,
} from '../domain/validators.js';

document.addEventListener('DOMContentLoaded', () => {
  rutaPublica();

  // Fondo interactivo: Malla Cuántica Multiversal (Opción 2)
  const canvasMalla = document.querySelector('#canvas-malla');
  if (canvasMalla) {
    inicializarMallaCuantica(canvasMalla);
  }

  const form_registro = document.getElementById('form_register');

  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputCorreo = document.getElementById('correo');
  const inputPassword = document.getElementById('password');
  const inputPasswordConfirm = document.getElementById('confirm_password');
  const btnRegister = document.querySelector('#btn_register');
  const mensajeExito = document.getElementById('mensaje_exito_form');

  // Botón ojo en ambas; medidor de fuerza SOLO en la contraseña (M2:
  // el campo de confirmación repite la misma clave => no evalúa fuerza).
  if (inputPassword) crearControlPassword(inputPassword, { conMedidor: true });
  if (inputPasswordConfirm) crearControlPassword(inputPasswordConfirm);

  const campos = {
    nombre: inputNombre,
    apellido: inputApellido,
    correo: inputCorreo,
    password: inputPassword,
  };

  const todosCampos = ['nombre', 'apellido', 'correo', 'password', 'confirm_password'];

  const pintarResultado = (resultado) => {
    if (resultado.error) {
      mostrarErrores(resultado);
    } else {
      mostrarExito(resultado);
    }
  };

  for (const campo in campos) {
    campos[campo].addEventListener('blur', () => {
      const valorCampo = campos[campo].value.trim();
      pintarResultado(validarCampo(campo, valorCampo, campo));
    });
  }

  inputPasswordConfirm.addEventListener('blur', () => {
    const passwordConfirm = inputPasswordConfirm.value.trim();
    const password = inputPassword.value.trim();
    pintarResultado(validarCoincidencia(password, passwordConfirm));
  });

  // handler async: registrarUser ahora es async (hash con Web Crypto).
  form_registro.addEventListener('submit', async (e) => {
    e.preventDefault();

    limpiarCampos(todosCampos);
    const hudEstado = document.getElementById('hud-estado');
    const originalEstado = hudEstado?.textContent;

    const datos = {
      nombre: inputNombre.value.trim(),
      apellido: inputApellido.value.trim(),
      correo: inputCorreo.value.trim(),
      password: inputPassword.value.trim(),
    };

    const errores = [];

    for (const campo in datos) {
      const resultado = validarCampo(campo, datos[campo], campo);
      if (resultado.error) errores.push(resultado);
    }

    const coincidencia = validarCoincidencia(datos.password, inputPasswordConfirm.value.trim());
    if (coincidencia.error) errores.push(coincidencia);

    if (errores.length > 0) {
      errores.forEach(pintarResultado);
      return;
    }

    /**
     * Pinta un fallo: mensaje en SU campo (si se conoce), glitch y HUD.
     * Siempre {campo, mensaje}: mostrarErrores() hace
     * querySelector('#error-<campo>') y con un Error se rompía.
     * @param {{campo?: string, mensaje?: string}} [fallo]
     * @returns {void}
     */
    const marcarFallo = ({ campo, mensaje } = {}) => {
      if (campo && mensaje && document.getElementById(`error-${campo}`)) {
        mostrarErrores({ error: true, campo, mensaje });
      }

      // Efecto Glitch de Error
      form_registro.classList.add('glitch-error');
      setTimeout(() => form_registro.classList.remove('glitch-error'), 300);

      if (hudEstado) {
        hudEstado.textContent = 'ERROR DE DATOS';
        hudEstado.className = 'text-danger font-semibold';
        setTimeout(() => {
          hudEstado.textContent = originalEstado || 'SINCRONIZADO';
          hudEstado.className = 'text-info font-semibold';
        }, 3000);
      }
    };

    try {
      if (hudEstado) {
        hudEstado.textContent = 'SINCRONIZANDO...';
        hudEstado.className = 'text-brand font-semibold';
      }

      const userRegistrado = await registrarUser(datos);

      if (!userRegistrado.exito) {
        // Fallo de negocio (p.ej. correo duplicado): mensaje en SU campo.
        marcarFallo({
          campo: userRegistrado.campo,
          mensaje: userRegistrado.mensaje || 'Error en el registro',
        });
        return;
      }

      form_registro.reset();
      btnRegister.disabled = true;
      btnRegister.classList.add('opacity-50', 'cursor-not-allowed');
      mensajeExito.classList.remove('hidden');

      if (hudEstado) {
        hudEstado.textContent = 'SINCRO COMPLETA';
        hudEstado.className = 'text-info font-semibold';
      }

      setTimeout(() => {
        window.location.href = RUTAS.login;
      }, 1000);
    } catch (error) {
      // Fallo inesperado (storage/crypto/red): sin campo asociado,
      // se avisa con toast y el HUD + glitch marcan el error.
      console.error('[registro] Error inesperado:', error);
      mostrarToast(error?.message || 'No se pudo completar el registro.', 'error');
      marcarFallo();
    }
  });
});
