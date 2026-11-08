# Web-Manual — Catálogo Interdimensional

Aplicación **HTML + CSS + JS + Tailwind v4** (sin frameworks) con estética "Dimensión CRT": catálogo de personajes de Rick and Morty con búsqueda, filtros, favoritos, ficha de detalle, doble tema (CRT oscuro / día claro) y todo el sistema de usuarios del enunciado (registro, login, sesión, mi cuenta).

> Plan completo, fases y decisiones: [`PLAN.md`](./PLAN.md).

## Requisitos

- Node ≥ 20 y **pnpm** (gestor exclusivo; no usar npm/yarn).
- `pnpm exec playwright install chromium` (solo para tests E2E/axe).

## Comandos

| Comando                        | Qué hace                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| `pnpm dev`                     | Servidor en :4173 + watch de Tailwind + livereload (SSE)     |
| `pnpm build`                   | Compila `src/styles/app.css` → `dist/app.css` minificado     |
| `pnpm build:deploy`            | Build + ensambla `public/` lista para Netlify (Drop)         |
| `pnpm watch`                   | Solo watch del build (sin servidor)                          |
| `pnpm lint`                    | ESLint (flat config)                                         |
| `pnpm format` / `format:check` | Prettier escribe / verifica                                  |
| `pnpm check:imports`           | Valida imports relativos de todos los módulos `src/`         |
| `pnpm check:contrast`          | 28 pares token↔fondo AA (WCAG)                               |
| `pnpm audit:budgets`           | Presupuestos: CSS < 20KB gzip · JS < 68KB gzip               |
| `pnpm test:e2e`                | Playwright: build + E2E + axe + responsive (3 viewports)     |
| `pnpm test:a11y`               | Solo axe-core (6 páginas × 2 temas, cero violaciones graves) |
| `pnpm test:responsive`         | Solo spot-checks responsive (375 / 768 / 1280)               |
| `pnpm audit:lighthouse`        | Lighthouse (requiere `pnpm dev` corriendo y red para npx)    |

## Estructura

```
/
├─ index.html · login.html · register.html · favorites.html
├─ character.html · mi_account.html · 404.html
├─ src/
│  ├─ config/       config.js               (API, storage keys, rutas, rate-limit)
│  ├─ core/         storage.js · cookies.js · hash.js · rate-limit.js
│  ├─ services/     auth.js · favorites-repository.js · characters-api.js
│  │               · session-boot.js · theme-boot.js · theme-toggle.js
│  ├─ domain/       validators.js           (login/registro/fuerza de contraseña)
│  ├─ ui/           header.js · components.js · page-states.js · characters.js
│  │               · icons.js · view-transitions.js
│  ├─ controllers/  login.js · register.js · catalog.js · favorites-page.js
│  │               · character.js · account.js
│  └─ styles/       app.css (entrada) · tokens.css · components.css
├─ dist/            app.css (build, versionado)
├─ tests/           e2e.spec.js · a11y.spec.js · responsive.spec.js · regressions.spec.js
│  ├─ helpers/      mock-api.js              (page.route: API hermética)
│  └─ fixtures/     personajes.js            (formato crudo de la API)
├─ scripts/         dev.mjs · check-imports.mjs · check-contrast.mjs · audit-budgets.mjs
├─ favicon.svg · robots.txt · sitemap.xml
├─ PLAN.md · README.md · playwright.config.js
```

> `dist/app.css` se versiona para el despliegue estático. Tras cambiar estilos,
> ejecuta `pnpm build` y commitea el CSS generado.

## Despliegue en Netlify

La app es 100% estática, pero **no se publica la raíz del repo** (contiene
`node_modules`, tests y docs): se publica el artefacto `public/`, que solo
incluye los ficheros de runtime (HTML, `src/`, `dist/app.css`, assets y
`_headers`).

1. `pnpm build:deploy` → compila Tailwind y ensambla `public/`.
2. Arrastra la carpeta **`public/`** a [app.netlify.com/drop](https://app.netlify.com/drop).
3. (Opcional, CI desde Git) Conecta el repo: `netlify.toml` ya fija
   `command = "pnpm build:deploy"`, `publish = "public"` y `NODE_VERSION = 24`.

Notas:

- `public/` es un artefacto regenerable: está en `.gitignore` (como `dist/`).
- `_headers` añade la CSP con `frame-ancestors 'none'` (que los `<meta>` no
  pueden llevar), `X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy`.
- Tras el primer deploy, sustituye `web-manual.example.com` en `robots.txt` y
  `sitemap.xml` por el dominio real y regenera el sitemap.

## Decisiones arquitectónicas (resumen)

1. **Capas SOLID en vanilla JS:** `core` (mecanismos puros) → `services` (reglas de negocio) → `domain` (validación/mapeo) → `ui` (render puro, fábricas sin estado) → `controllers` (orquestación por página con dependencias inyectadas: `initCatalog({ api, favorites, ui })`).
2. **Tokens semánticos, no colores crudos:** los componentes usan `bg-panel`, `text-ink`, `border-line`, `text-brand`… (`@theme inline`); el tema vive en `:root` (día) y `.dark` (CRT). Cambiar un color es tocar un token.
3. **CSP estricta:** `script-src 'self'` (sin inline, sin CDNs), Tailwind compilado en build local. El único `unsafe-inline` es `style-src` (atributos `style` de la app; documentado).
4. **XSS:** datos externos SIEMPRE con `textContent`; `innerHTML` solo con strings estáticos propios; JSON-LD escapando `<`.
5. **API con caché stale-while-revalidate:** memoria + sessionStorage versionada (`cache_personajes_v3_p*`, TTL 5 min), reintentos con backoff, cola rate-limit client-side (token bucket, `config.js`) y `AbortController` en `pagehide`. **Límite honesto:** sin backend esto solo controla la concurrencia de la UI; no protege contra atacantes reales.
6. **Auth client-side (del enunciado):** usuarios en localStorage (hash SHA-256), sesión en sessionStorage, favoritos en localStorage por usuario, tema/recordar en cookies endurecidas (`SameSite=Lax`, `Secure` en https). **No es una autenticación real:** en producción haría backend + bcrypt/argon2.
7. **Movimiento de alta señal:** efectos firma CRT (scanlines, glitch, glow) desactivados con `prefers-reduced-motion`; View Transitions solo si hay soporte y el usuario no pide menos movimiento. **M1:** las subidas al hover/reveal y los bordes remarcados existen SOLO en las cards de personaje; los paneles (formularios, ficha, resumen) están quietos y sin resalte de borde.
8. **Tests herméticos:** los E2E/axe interceptan la API con `page.route` (fixtures) para no depender del rate-limit de `rickandmortyapi.com`. La app real contra la API se valida manualmente con `pnpm dev` (smoke de URLs).
9. **Navbar sticky con glass (M3):** la cabecera es `position: sticky` con fondo translúcido + `backdrop-blur` => nunca desaparece al hacer scroll y el contenido pasa por debajo, en ambos temas.
10. **Nav adaptativa sin hamburguesa (M4):** ≥768px enlaces de texto (estilo original); <768px cuatro controles redondos de 44px (Catálogo, Favoritos, Tema, Cuenta). El botón «Mi cuenta» abre un dropdown —en todos los tamaños— con «Mi cuenta» y «Cerrar sesión». Logo visible: **«Catálogo de Personajes»**.
11. **Medidor de fuerza de contraseña (M2):** solo donde se crea o cambia la clave (registro y «Nueva contraseña» de Mi cuenta); en login y en los campos de confirmación sería incoherente.
12. **Sin microcopy `//` decorativo (M5):** se eliminaron los textos de anotación tipo `// portal-7…`; la clase `microcopy` sigue siendo la etiqueta estilizada de los `dt` del detalle y otros textos funcionales.
13. **Estados de interacción con callback inyectado (Fase 12):** los empty states aceptan CTA (`crearEstadoVacio({ acciones })`) y los botones de envío tienen modo carga (`ponerBotonCargando`/`quitarBotonCargando`: spinner + `aria-busy` + ancho congelado). El hover dinámico de las cards (portal glow que sigue al cursor) vive en UN listener delegado por grid con throttle rAF y se desactiva en táctil/reduced-motion; el glow y el cue solo existen bajo `@media (hover:hover) and (prefers-reduced-motion:no-preference)`.

## Cómo añadir un componente

1. **Decide la capa:** markup/estilos → `src/ui`; lógica de negocio → `services`; validación → `domain`; orquestación de página → `controllers`.
2. **Función fábrica pura** en `src/ui/components.js` (o módulo propio si crece): recibe opciones, devuelve `HTMLElement`, sin estado global.

   ```js
   export function crearEtiqueta({ texto, tono = 'info' } = {}) {
     const nodo = document.createElement('span');
     nodo.className = `badge badge-${tono}`;
     nodo.textContent = texto; // ← datos externos SIEMPRE textContent
     return nodo;
   }
   ```

3. **Estilo con tokens/layer:** reglas en `src/styles/components.css` dentro de `@layer components`, usando clases semánticas (`bg-panel`, `text-dim`…). Utilities de Tailwind ganan a la capa de componentes: no uses `!important` ni prefijos `!`.
4. **Documenta:** cabecera de archivo + JSDoc en toda función pública + comentario de "por qué" si la lógica no es obvia.
5. **Verifica:** `pnpm lint && pnpm check:imports && pnpm build`, y si toca contraste/nuevos tokens: `pnpm check:contrast`. Para interacciones críticas, añade aserción en `tests/e2e.spec.js` o `tests/regressions.spec.js`.

## QA / verificación

- **Gate automático:** `pnpm lint` · `format` · `check:imports` · `check:contrast` · `build` · `audit:budgets` · `pnpm test:e2e` (build + E2E core + axe 0 violaciones graves + overflow/header sticky/medidor M2/hueco M6 en 375/768/1280 — **117 tests**, 1 worker por defecto; `PW_WORKERS` lo amplía en CI y `PORT` desvía el servidor si :4173 está ocupado).
- **Matriz responsive completa (manual/CI):** 12 resoluciones × 6 páginas × 2 temas = 144 celdas (`PLAN.md` §10.2). El runner automatiza las 3 resoluciones críticas; el resto se amplía en `playwright.config.js` (`projects`).
- **Lighthouse (manual):** `pnpm dev` + `pnpm audit:lighthouse` → presupuestos de `PLAN.md` §10.1 (Performance ≥ 90, JS < 68KB gzip…).
- **API real (manual):** los tests mockean la API; el comportamiento real (rate-limit, 429, caché) se revisa con `pnpm dev` navegando el catálogo.
