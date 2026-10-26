import { registrarUser, rutaPublica, RUTAS } from '../services/auth.js';
import { crearControlPassword } from '../ui/components.js';
import {
  validarCampo,
  validarCoincidencia,
  mostrarErrores,
  mostrarExito,
  limpiarCampos,
} from '../domain/validators.js';

document.addEventListener('DOMContentLoaded', () => {
  rutaPublica();

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

    const userRegistrado = await registrarUser(datos);

    if (!userRegistrado.exito) {
      mostrarErrores(userRegistrado);
      return;
    }

    form_registro.reset();
    btnRegister.disabled = true;
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed');
    mensajeExito.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = RUTAS.login;
    }, 1000);
  });
});
