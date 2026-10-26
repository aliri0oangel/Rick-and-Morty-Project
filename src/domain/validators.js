/* Clases de error y exito */
const errorClass = 'errorValidacion';
const successClass = 'exitoValidacion';

/* RegexsObj */
const regexs = {
  nombre: /^[a-zA-ZñÑáÁéÉíÍóÓúÚ\s']{3,20}$/i,
  apellido: /^[a-zA-ZñÑáÁéÉíÍóÓúÚ\s']{3,20}$/i,
  correo: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{3,}$/,
  password: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\w\s])[A-Za-z\d\W]{8,50}$/,
};

/* VALIDAR CAMPO */

const validacion_obj = {
  nombre: {
    regex: regexs.nombre,
    mensaje: (campo) => `El ${campo} debe tener entre 3 y 20 caracteres.`,
  },
  apellido: {
    regex: regexs.apellido,
    mensaje: (campo) => `El ${campo} debe tener entre 3 y 20 caracteres.`,
  },
  correo: {
    regex: regexs.correo,
    mensaje: () => 'El correo no tiene un formato válido.',
  },
  password: {
    regex: regexs.password,
    mensaje: () =>
      'La contraseña debe tener entre 8 y 50 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial.',
  },
};

export const validarCampo = (tipoCampo, valorCampo, nombreCampo) => {
  const validate = validacion_obj[tipoCampo];

  if (valorCampo.trim() === '') {
    return {
      error: true,
      campo: `${tipoCampo}`,
      mensaje: `El campo es obligatorio.`,
    };
  } else if (!validate.regex.test(valorCampo)) {
    return {
      error: true,
      campo: `${tipoCampo}`,
      mensaje: validate.mensaje(nombreCampo),
    };
  }
  return { error: false, campo: `${tipoCampo}`, mensaje: 'Campo válido' };
};

export const validarCoincidencia = (pass, passConfirm) => {
  if (passConfirm.trim() === '') {
    return { error: true, campo: 'confirm_password', mensaje: `El campo es obligatorio.` };
  } else if (pass !== passConfirm) {
    return {
      error: true,
      campo: 'confirm_password',
      mensaje: `Las contraseñas no coinciden`,
    };
  }
  return {
    error: false,
    campo: 'confirm_password',
    mensaje: 'Las contraseñas coinciden.',
  };
};

export const limpiarCampos = (listaCampos) => {
  for (const nombre of listaCampos) {
    document.querySelector(`#error-${nombre}`).textContent = '';
    document.querySelector(`#${nombre}`).classList.remove(errorClass, successClass);
  }
};

export const mostrarEstado = (nombreCampo, clase) => {
  const input = document.querySelector(`#${nombreCampo}`);
  input.classList.remove(errorClass, successClass);
  input.classList.add(clase);
};

export const mostrarErrores = (resultado) => {
  document.querySelector(`#error-${resultado.campo}`).textContent = resultado.mensaje;
  mostrarEstado(resultado.campo, errorClass);
};
export const mostrarExito = (resultado) => {
  document.querySelector(`#error-${resultado.campo}`).textContent = '';
  mostrarEstado(resultado.campo, successClass);
};

/* FUERZA DE CONTRASEÑA (medidor visual — Fase 3 / T3.1)
   Refleja la MISMA política del regex de arriba: 4 criterios
   (longitud, caja mixta, dígito, especial) => 0..4 puntos. */

const criteriosFuerza = {
  longitud: (v) => v.length >= 8,
  cajaMixta: (v) => /[A-Z]/.test(v) && /[a-z]/.test(v),
  digito: (v) => /\d/.test(v),
  especial: (v) => /[^\w\s]/.test(v),
};

const ETIQUETAS_FUERZA = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'];

/**
 * Evalúa la fuerza de una contraseña bajo la política del proyecto.
 * @param {string} password - Valor crudo del input.
 * @returns {{puntos: 0|1|2|3|4, etiqueta: string}} Nivel + texto a mostrar.
 */
export function evaluarFuerza(password) {
  const valor = String(password || '');
  let puntos = 0;
  for (const criterio of Object.values(criteriosFuerza)) {
    if (criterio(valor)) puntos++;
  }
  return { puntos, etiqueta: ETIQUETAS_FUERZA[puntos] };
}
