/**
 * theme-toggle.js — Alternancia claro/oscuro (Composición).
 * -------------------------------------------------------------------
 * Responsabilidad: al hacer clic en el botón de tema, alternar la clase
 * .dark del documento y persistir la decisión en la cookie "tema"
 * (3er mecanismo: preferencias de UI).
 *
 * Fase 2: se exporta conectarToggleTema() para que header.js conecte SU
 * botón inyectado; el auto-init con DOMContentLoaded sigue cubriendo las
 * páginas con botón estático (login/register). El guardia por atributo
 * data evita listeners duplicados si ambos caminos tocan el mismo botón.
 * Los glifos Unicode (☀/☾) se sustituyeron por el sprite SVG (T2.4).
 */

import { crearCookie } from '../core/cookies.js';
import { COOKIE_KEYS } from '../config/config.js';
import { icono, asegurarSprite } from '../ui/icons.js';

/** Duración de la cookie de tema: 1 año. */
const DIAS_TEMA = 365;

/**
 * Conecta el listener y pinta el estado inicial del botón.
 * Idempotente: un mismo botón solo se conecta una vez.
 * @param {HTMLElement} boton - Botón de tema (#btn-tema).
 * @returns {void}
 */
export function conectarToggleTema(boton) {
  if (!boton || boton.dataset.temaConectado === '1') return;
  boton.dataset.temaConectado = '1';
  asegurarSprite();

  /**
   * Pinta icono y etiqueta accesible según el tema ACTUAL del documento.
   * Sincroniza además el meta theme-color del navegador (T6.1).
   * @returns {void}
   */
  const pintar = () => {
    const oscuro = document.documentElement.classList.contains('dark');
    // CRT oscuro activo => se ofrece pasar a "día" (sol); y viceversa.
    boton.innerHTML = icono(oscuro ? 'sun' : 'moon', 'w-5 h-5');
    boton.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    boton.setAttribute('title', boton.getAttribute('aria-label'));

    // theme-color: la barra del móvil sigue el tema activo (T6.1).
    const metaTema = document.querySelector('meta[name="theme-color"]');
    if (metaTema) {
      metaTema.setAttribute('content', oscuro ? '#0b0c10' : '#f4efe6');
    }
  };

  pintar();

  boton.addEventListener('click', () => {
    // Alterna la clase raíz: TODAS las variantes dark: reaccionan ya.
    const oscuro = document.documentElement.classList.toggle('dark');
    // Persistencia de la preferencia (cookie de UI, 1 año).
    crearCookie(COOKIE_KEYS.tema, oscuro ? 'oscuro' : 'claro', DIAS_TEMA);
    pintar();
  });
}

// Auto-init para páginas con botón estático (login/register).
// header.js llama a conectarToggleTema() directamente al inyectar el suyo.
document.addEventListener('DOMContentLoaded', () => {
  conectarToggleTema(document.getElementById('btn-tema'));
});
