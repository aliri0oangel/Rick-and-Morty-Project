/**
 * footer.js — Componente de pie de página global
 */
export function montarFooter(contenedor) {
  if (!contenedor) return;

  const footer = document.createElement('footer');
  footer.className = 'w-full py-8 mt-auto border-t border-app/10';
  // text-dim SIN opacity-60: con opacity el contraste caía a 2.37:1 (axe
  // color-contrast "serious"); text-dim sobre bg da 5.05:1 (día) / 5.90:1 (CRT).
  footer.innerHTML = `
    <div class="max-w-7xl mx-auto px-6 text-center">
      <p class="microcopy text-dim">
        Copyright &copy; 2026 &mdash; Proyecto desarrollado por Alirio
      </p>
    </div>
  `;

  contenedor.appendChild(footer);
}
