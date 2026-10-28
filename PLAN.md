# PLAN DE REESTILIZACIÓN — Web-Manual (Rick & Morty)

> **Documento de planificación.** Único entregable de esta fase: NO contiene código ni inicia desarrollo.
> Modificaciones futuras se harán por capítulos sobre este documento.

---

## 1. Contexto y diagnóstico

**Estado actual del proyecto:**

- 6 páginas HTML estáticas (`index`, `login`, `register`, `favorites`, `character`, `mi_account`) + 16 módulos JS vanilla (ES Modules) + un único CSS propio (`css/customCss.css`, 36 líneas).
- **Tailwind v4 cargado por CDN** (`@tailwindcss/browser@4`): compilación en runtime, `<script>` bloqueante en `<head>`, exige `wasm-unsafe-eval` en la CSP. Es el problema de rendimiento más grave y está explícitamente desaconsejado para producción.
- Persistencia fiel al enunciado: usuarios → localStorage; sesión → sessionStorage; favoritos → localStorage (por usuario); cookies → tema y recordar correo.
- API externa `https://rickandmortyapi.com/api` consumida desde cliente con caché en sessionStorage (TTL 5 min) y timeout por AbortController.
- Sin assets locales (favicon, imágenes, fuentes), sin SEO on-page, sin pruebas automatizadas, Git inicializado sin commits.

**Problemas clave detectados:**

| Área          | Problema                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diseño        | Sin design tokens (colores hardcodeados en HTML); CSS de validación **sin variantes dark**; tipografía por defecto del sistema                                                |
| Estructura    | Header copiado ×4 páginas; IDs duplicados entre páginas (`#estado-*`, `#character-card`) como "truco" de reutilización; confusión de nombres `favorites.js` vs `favoritos.js` |
| Accesibilidad | Errores de formulario sin `role="alert"`/`aria-live`; nav sin `aria-label`; sin skip-link; sin `prefers-reduced-motion`; sin verificación de contraste AA                     |
| SEO           | Sin meta description, OG/Twitter, favicon, canonical, robots, sitemap, JSON-LD; `h1` placeholder "En construccion" en index; títulos genéricos ("LogIn")                      |
| UX            | faltan show/hide password y medidor de fuerza (opcionales del enunciado); sin filtros ni orden; sin notificaciones toast; sin página 404                                      |
| Seguridad     | CSP con `wasm-unsafe-eval` e inline innecesarios (por el CDN); sin rate limiting de llamadas a la API externa                                                                 |

---

## 2. Decisiones de alcance (confirmadas con el usuario)

1. **Base tecnológica: HTML + CSS + JS + Tailwind puro.** Sin frameworks (sin React ni Next.js). Se reestiliza _in-place_ sobre las páginas existentes.
2. **pnpm como gestor de paquetes exclusivo** (nada de npm) para tooling: Tailwind CLI, lint, format, testing.
3. **Persistencia fiel al enunciado:** los tres mecanismos de storage se conservan con sus actuales propósitos (usuarios→LS, sesión→SS, favoritos→LS, cookies→tema/recordar).
4. `enunciado-js-rick-and-morty.md` se conserva intacto como referencia.
5. **Comentarios de código obligatorios** (cabecera de archivo + JSDoc en funciones públicas + comentarios de "por qué" en lógica no obvia), pese a las reglas de clean code que desaconsejan comentarios — decisión explícita del usuario.
6. **Skills aplicadas:** `frontend-design-direction`, `frontend-slides`, `frontend-patterns` (solo partes no-React), `design-system`, `make-interfaces-feel-better`, `seo`, `security-review`.
7. **Skills omitidas:** `react-patterns`, `react-performance` (irrelevantes sin React; decisión explícita del usuario).

---

## 3. Dirección de diseño (temática futurista Rick & Morty)

### 3.1 Elección de dirección visual — "show, don't tell" (`frontend-slides`) — ✅ RESUELTO

Workflow completado: se generaron 3 previews HTML en `.design-previews/` y el usuario eligió.

> **Dirección elegida: C) "Dimensión CRT" (retro-futurista).** Carpeta `.design-previews/` eliminada tras la elección (T1.1 cerrada).

| Variante              | Preset base                       | Resultado                                                                         |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| A) Portal Neon        | _Neon Cyber_                      | Descartada                                                                        |
| B) Cadena de Comandos | _Terminal Green_ + _Swiss Modern_ | Descartada                                                                        |
| **C) Dimensión CRT**  | Retro-futurista                   | ✅ **Elegida** — fósforo ámbar/cian, scanlines, viñeta de tubo, glitch en títulos |

### 3.2 Los 5 ejes (`frontend-design-direction`)

1. **Propósito:** catálogo de consulta recurrente (no landing page) — la primera pantalla debe ser la experiencia usable.
2. **Audiencia:** usuarios que exploran personajes de forma repetida; escanean imágenes y estados primero.
3. **Tono:** techno-futurista con humor (guiños a la serie sin sacrificar claridad).
4. **Detalle memorable:** la transición **"portal"** al cargar/filtrar personajes (marca la identidad).
5. **Restricciones:** contraste AA, `prefers-reduced-motion`, cero dependencias pesadas, ambos temas completos.

### 3.3 Paleta CRT (tokens — multi-hue, ambos temas)

| Rol                          | Dark "CRT" (default)  | Light "Modo día"      |
| ---------------------------- | --------------------- | --------------------- |
| Fondo / panel                | `#0b0c10` / `#12141a` | `#f4efe6` / `#fffdf8` |
| Tinta / tenue                | `#ffd9a0` / `#9b8b74` | `#2a2418` / `#6f6455` |
| **Primario (fósforo ámbar)** | `#ffb000`             | `#c77f00`             |
| Info / secundario (cian)     | `#39d7e6`             | `#0e8b99`             |
| Peligro / favorito (magenta) | `#ff4fa3`             | `#e0246f`             |
| Líneas / bordes              | `#2b2f3a`             | `#d9d1c2`             |

Los pares light/dark viven como **CSS custom properties** en `tokens.css`, mapeadas al `@theme` de Tailwind v4. Dark es el tema por defecto ("modo CRT"); light es "modo día".

### 3.4 Tipografía

- **Display** (títulos/hero): **VT323** (fósforo de tubo) — `font-display: swap` + preconnect.
- **Mono** (cuerpo, datos, IDs, badges): **IBM Plex Mono** — refuerza la temática terminal.
- Ambas cargadas desde Google Fonts en Fase 1 (T1.3); la CSP deberá añadir `fonts.googleapis.com`/`fonts.gstatic.com`.

### 3.5 Efectos firma (detalle memorable — variante C)

- **Scanlines + viñeta de tubo:** overlays fijos con opacidad controlada por el token `--fx` (≈1 en dark CRT, ≈0.15 en "modo día"); anulados bajo `prefers-reduced-motion`.
- **Glitch cian/magenta en el hero:** solo en títulos display (VT323), capas pseudo-elemento con `clip-path`; sin animación con reduced-motion.
- **Glow ámbar/cian en focus/hover:** `box-shadow`/`text-shadow` con `color-mix()` — identifica foco (a11y) y estados interactivos.
- **Cards con "marco de tubo":** `border-radius` 14px + borde que enciende con glow en hover.
- **Microcopy tipo terminal:** prompts (`> cargando...`, `grep -i nombre...`, `#001`) como refuerzo temático sin sacrificar claridad.

### 3.6 Anti-patrones vetados

Gradientes púrpura genéricos · blobs decorativos · cards dentro de cards · un solo tono dominante en toda la UI · animación que enmascare lentitud · dependencias nuevas solo por un adorno.

### 3.7 Gate de aceptación

Checklist de 9 ítems de `frontend-design-direction` (sección 10.3).

---

## 4. Arquitectura (SOLID + clean code en vanilla JS)

### 4.1 Estructura de carpetas objetivo

```
/
├─ index.html · login.html · register.html · favorites.html · character.html · mi_account.html
├─ src/
│  ├─ config/       config.js                (constantes únicas: API, storage keys, rutas)
│  ├─ core/         storage.js · cookies.js · hash.js · http.js · rate-limit.js
│  ├─ services/     auth.js · favorites-repository.js · characters-api.js · theme.js
│  ├─ domain/       validators.js · mappers.js · errors.js
│  ├─ ui/           header.js · character-card.js · badge.js · skeleton.js · states.js
│  │                toast.js · form-field.js · theme-toggle.js · modal.js · icons.js
│  ├─ controllers/  login.js · register.js · catalog.js · favorites-page.js
│  │                character.js · account.js
│  └─ styles/       tokens.css · base.css · components.css   → entrada del build Tailwind v4
├─ public/          favicon.svg · robots.txt · sitemap.xml · 404.html · img/
├─ tests/           e2e (Playwright) · fixtures
├─ scripts/         dev.mjs (watch + servidor estático + livereload) · check-resolutions.mjs
├─ package.json     (scripts con pnpm) · .gitignore · .prettierrc · eslint.config.js
├─ PLAN.md · README.md
└─ .design-previews/   (temporal: 3 previews de dirección visual, se limpia al elegir)
```

### 4.2 Traducción SOLID a JS vanilla

| Principio                         | Aplicación concreta                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S** (Responsabilidad única)     | Capas separadas: `core` (mecanismos puros) → `services` (reglas de negocio) → `domain` (validación/mapeo) → `ui` (render puro) → `controllers` (orquestación por página) |
| **O** (Abierto/cerrado)           | Estrategias por mapa/objeto: `ESTADOS_STYLE`, `validators` por campo — se extiende añadiendo entradas, sin tocar la función de render                                    |
| **L** (Sustitución)               | Contrato uniforme de retorno `{exito, mensaje, campo}` en todos los services; el caller no distingue implementación                                                      |
| **I** (Segregación)               | Exportaciones mínimas por módulo; nada se exporta "por si acaso"; cada módulo tiene una sola razón para cambiar                                                          |
| **D** (Inversión de dependencias) | Los controllers reciben dependencias inyectadas: `initCatalog({ api, favorites, ui })` — dependen de abstracciones, no de implementaciones concretas                     |

### 4.3 Reglas clean code + comentarios

- Funciones < 40 líneas; parámetros ≤ 3-4; early returns.
- Nomenclatura en español, consistente y verbosa. **Renames obligatorios:** `favorites.js` (controlador) → `controllers/favorites-page.js`; `favoritos.js` (repositorio) → `services/favorites-repository.js`.
- Un solo `<header>` renderizado por componente `ui/header.js` (elimina duplicación ×4).
- Cero IDs duplicados entre páginas: la reutilización se logra con componentes, no con IDs coincidentes.
- **Comentarios (obligatorios):** cabecera de archivo (qué hace, quién lo consume), JSDoc en toda función pública, comentarios de "por qué" en lógica no obvia (debounce, rate limit, migración de hash, anti-FOUC). Prohibido comentar el "qué" trivial.

---

## 5. Stack y tooling (pnpm exclusivo)

**Dependencias de desarrollo:**

```bash
pnpm add -D tailwindcss@4 @tailwindcss/cli prettier eslint eslint-plugin-html \
  playwright @axe-core/playwright
```

**Scripts de `package.json`:**

| Script                      | Función                                                  |
| --------------------------- | -------------------------------------------------------- |
| `pnpm dev`                  | Watch de Tailwind + servidor estático local + livereload |
| `pnpm build`                | Compila y minifica CSS (producción)                      |
| `pnpm lint` / `pnpm format` | ESLint + Prettier                                        |
| `pnpm test:e2e`             | Flujos E2E con Playwright                                |
| `pnpm test:responsive`      | Matriz de resoluciones con capturas de evidencia         |
| `pnpm audit:lighthouse`     | Presupuestos de rendimiento/SEO/a11y                     |

**Resultado clave:** se elimina el CDN de Tailwind → CSS compilado y minificado en build, CSP sin `wasm-unsafe-eval`.

---

## 6. Fases y tareas

> Formato: **objetivo → tareas (T#) → criterios de aceptación (✅)**.
> Cada fase termina con gate: no se avanza sin su aceptación.

### Fase 0 — Andamiaje del proyecto (pnpm + Tailwind build)

**Objetivo:** tooling funcional y CDN eliminado antes de tocar diseño.

- `T0.1` `pnpm init`, `package.json` con todos los scripts, `.gitignore` ampliado, Prettier + ESLint configurados.
- `T0.2` Tailwind v4 CLI: entrada en `src/styles/`, `@theme` con tokens iniciales, `@custom-variant dark` (class-based) centralizado (hoy está duplicado inline en cada HTML).
- `T0.3` Script `dev.mjs`: watch de CSS + servidor estático local + livereload ligero.
- `T0.4` Mover JS a `src/` con imports actualizados; renombres consistentes (ver 4.3); eliminar el bloque Tailwind CDN + `<style type="text/tailwindcss">` de los 6 HTML.
- `T0.5` Checkpoint: build produce CSS; las 6 páginas sirven sin CDN.

✅ **Aceptación:** `pnpm dev` sirve las 6 páginas con Tailwind compilado localmente; **0 requests a jsdelivr**; lint pasa.

---

### Fase 1 — Design tokens y sistema de diseño

**Objetivo:** base visual con ambos temas, sin FOUC.

- `T1.1` ✅ **CERRADO — dirección elegida: C) Dimensión CRT** (workflow "show, don't tell" completado; previews A/B eliminados junto con `.design-previews/`).
- `T1.2` ✅ **CERRADO** — `src/styles/tokens.css`: custom properties light/dark (superficies, acentos, `--on-*`, soft, glow, radios, movimiento) mapeadas al `@theme` de Tailwind vía `@theme inline` (utilities semánticas: `bg-app`, `text-ink`, `text-brand`… con safelist `@source inline`).
- `T1.3` ✅ **CERRADO** — Tipografías VT323 + IBM Plex Mono con `display=swap` y `preconnect` (Google Fonts; self-host queda como upgrade opcional en Fase 5) + CSP ampliada en los 6 HTML.
- `T1.4` ✅ **CERRADO** — `src/styles/components.css` (`@layer components`): botones (primary/info/danger/ghost), `.campo`, validaciones migradas de `customCss.css` **con dark mode**, badges de estado, cards con glow hover, skeletons, avisos.
- `T1.5` ✅ **CERRADO** — Dark mode robusto: `theme-boot.js` (no inline; CSP `'self'`) con orden cookie → `prefers-color-scheme` → **fallback CRT oscuro**; toggle con persistencia cookie 365d.

✅ **Aceptación:** ambos temas completos en todos los componentes; sin FOUC al cargar/recargar; contraste AA verificado por token.

---

### Fase 2 — Sistema de componentes UI (JS)

**Objetivo:** reutilización real vía componentes (no vía IDs duplicados).

- `T2.1` ✅ **CERRADO** — `ui/header.js`: nav unificado (Catálogo/Favoritos con `aria-current`, nombre de usuario, toggle de tema, logout con **Modal** de confirmación); reemplaza las 4 copias estáticas (los enlaces muertos About/Contact se eliminan). Devuelve handle `actualizarNombre()`.
- `T2.2` ✅ **CERRADO** — `ui/components.js`: `crearBadgeEstado` (mapa OCP), `crearBotonFavorito`/`pintarBotonFavorito` (`aria-pressed` dinámico), `crearCardPersonaje` (sin `<template>` en HTML), `crearSkeletonCard`/`crearSkeletonDetalle`, `crearEstadoVacio`, `crearEstadoError`, `mostrarToast` (singleton `aria-live`), `crearModal` (Escape, foco, `aria-modal`), `crearCampo` (FormField: label + input.campo + `#error-<id>` con `aria-describedby` — usado por Mi cuenta).
- `T2.3` ✅ **CERRADO** — `ui/page-states.js`: `crearZonaPersonajes()` (cargando/error/vacío/grid por instancia, `aria-live`/`role="alert"`, retry inyectado) — sustituye los ids `#estado-*` compartidos entre páginas.
- `T2.4` ✅ **CERRADO** — `ui/icons.js`: sprite SVG propio (`<symbol>`: heart/heart-fill/sun/moon/user/logout/alert/check/close) + helper `icono()`; reemplaza los glifos Unicode ♥☀☾ en favoritos y toggle de tema.

✅ **Aceptación:** cada componente con todos sus estados demostrables; cero IDs duplicados entre páginas (sin `#estado-*` ni `#character-card`; header con data-attrs); navegación por teclado completa (modal con trap de foco + Escape, `aria-current`, focus-visible global).

---

### Fase 3 — Reestilización página por página

**Objetivo:** aplicar sistema de diseño + nueva UX a cada vista. Una tarea por página, reutilizando Fase 2.

- `T3.1` ✅ **CERRADO** — **Login + Registro:** layout "terminal de portal" (microcopy + h1 glitch), `crearControlPassword()` (botón ojo + medidor de fuerza 4 segmentos con `evaluarFuerza()` en dominio, misma política que el regex), errores con `role="alert"`, aviso login show/hide + `aria-live="assertive"`.
- `T3.2` ✅ **CERRADO** — **Catálogo (index):** hero con texto real + microcopy + glitch (reemplaza "En construccion"), `buscarPersonajes()` acepta `nombre/estado/especie/pagina` (endpoint combinado de la API), orden client-side (`ordenarPersonajes()` mapa OCP), spinner inline + `aria-busy` durante debounce/fetch, "Cargar más" con spinner y bloqueo doble clic, indicador "Mostrando N · filtros", empty state ilustrado (TV+lupa).
- `T3.3` ✅ **CERRADO** — **Favoritos:** header reestilizado (glitch), empty state ilustrado (TV+corazón, `crearIlustracion('favoritos')`), `retirarCardAnimada()` al quitar favorito (fade/scale 200ms, inmediato bajo reduced-motion; estado vacío tras el finish).
- `T3.4` ✅ **CERRADO** — **Detalle:** ficha jerárquica (microcopy `#007 · expediente`, nombre glitch, dl con dt microcopy), `fetchpriority="high"` en la imagen LCP, chips `EP###` extraídos de las URLs de `episode` (sin fetch extra, tope 12 + resumen "+N"), botón compartir (`navigator.share` → fallback clipboard + toast), "volver" con `history.back()` si el referrer es del mismo origen.
- `T3.5` ✅ **CERRADO** — **Mi cuenta:** resumen de perfil (nombre/correo/nº favoritos) re-pintado tras guardar, feedback con `mostrarToast`, FormField + ojo/medidor en contraseñas, error general `role="alert"` show/hide.
- `T3.6` ✅ **CERRADO (global)** — Efectos firma §3.5 en `components.css`: overlays scanlines + viñeta (`body::before/after`, opacidad `--fx`, guard `prefers-reduced-motion`), `.glitch` (clip-path cian/magenta ~8% del ciclo), `.microcopy`, `.campo-wrap`/`.campo-toggle`, `.fuerza*`, sprite ampliado (eye/eye-off/loader/share).

✅ **Aceptación por página:** checklist 9 ítems de dirección de diseño × 2 temas; ARIA correcto; **toda la lógica del enunciado sigue operativa** (auth, favoritos, rutas protegidas).

---

### Fase 4 — Animaciones fluidas (sencillas)

**Objetivo:** interfaz viva sin sacrificar rendimiento ni accesibilidad.

- `T4.1` ✅ **CERRADO** — Catálogo de motion en `components.css`: transiciones 150–250ms (`--trans`/`--ease`), press scale `.btn:active`, fade/slide de estados (`.estado-entrada` con retrigger en `page-states.js`), reveal on scroll one-shot (`observarReveal()` con IntersectionObserver en `characters.js`, cards con `.reveal`→`.reveal-listo`), transición del toggle de tema.
- `T4.2` ✅ **CERRADO** — Detalle "portal" de entrada: keyframes `portal-entrada` ≤150ms retriggered en `mostrarEstadoDetalle('detalle')`; nunca bloquea el contenido (clase sobre el nodo ya montado).
- `T4.3` ✅ **CERRADO** — Guard global `prefers-reduced-motion` en `tokens.css` (desactiva glitch/scanlines/keyframes/reveal) + `.skip-link` focus visible + `.img-fade` para imágenes.
- `T4.4` ✅ **CERRADO** — `ui/view-transitions.js`: feature-detect (`document.startViewTransition` + reduced-motion), `navegar(destino)` y `mejorarEnlaces(raiz)`; aplicado en navegación de cards (catálogo/favoritos) y header; keyframes VT dentro de `no-preference` con degradación elegante.

✅ **Aceptación:** contenido visible sin animación (estado estático siempre montado); reduced-motion desactiva todo (verificado por guard CSS); sin dependencias nuevas.

---

### Fase 5 — Rendimiento

**Objetivo:** presupuestos medibles.

- `T5.1` ✅ **CERRADO** — CSS crítico inline en los 6 HTML + `404.html` (background por tema, evita FOUC de primer paint) + `content-visibility: auto` + `contain-intrinsic-size` en `article[data-id]`.
- `T5.2` ✅ **CERRADO** — `loading="lazy"`/`decoding="async"` existentes + `fetchpriority="high"` en LCP del detalle + fade-in `.img-fade` (opacity 0→1 al cargar) como placeholder sin salto. _(Blur-up descartado: añadiría decode costosa sin retorno medible.)_
- `T5.3` ✅ **CERRADO** — Caché SWR en `characters-api.js`: memoria + sessionStorage versionada (`v3`, TTL 5min), stale → revalidación en fondo, reintentos backoff 300/600ms (2×) solo para fallos transitorios, `AbortController` en `pagehide`, 404 de negocio sin reintento.
- `T5.4` ✅ **CERRADO** — Módulos ES (`type="module"`, sin re-descargas: build local versionado por deploy) + medición con presupuestos: **`pnpm audit:budgets`** (CSS < 20KB gzip · JS < 65KB gzip) en `scripts/audit-budgets.mjs`.
- `T5.5` ✅ **CERRADO** — Script `pnpm audit:lighthouse` (Lighthouse CLI con presets; requiere `pnpm dev` + red — comandos en README §QA).

✅ **Aceptación (automatizable local):** budgets en verde (CSS ~7.5KB · JS ~55KB gzip); Lighthouse ≥ 90 queda como medición manual/CI documentada en README (navegador externo no instalado en el repo).

---

### Fase 6 — SEO

**Objetivo:** maximizar indexación dentro del enfoque estático.

- `T6.1` ✅ **CERRADO** — Meta por página en los 6 HTML: título con sufijo "· Web-Manual", description, canonical relativo, OG + Twitter, `theme-color` dinámico por tema (`id="meta-theme-color"` sincronizado en `theme-boot.js` y `theme-toggle.js`), `favicon.svg` propio (anillos ámbar/cian).
- `T6.2` ✅ **CERRADO** — `robots.txt` + `sitemap.xml` + `404.html` temática con **status 404 real** (servida por `scripts/dev.mjs`). _(Ubicados en la raíz, no `public/`: el servidor de desarrollo sirve desde la raíz del proyecto.)_
- `T6.3` ✅ **CERRADO** — JSON-LD `WebSite` en `index.html` + JSON-LD `Person` inyectado desde `character.js` (`#ld-personaje`, escape `<`→`<`); `h1` único y real por página; `lang="es"` ✓.
- `T6.4` ✅ **CERRADO (documentada)** — Limitación: contenido JS-rendered con techo de indexación; mitigado con metadata estática completa + JSON-LD del detalle. Prerender queda como futuro opcional (fuera de alcance). Anotado en README §Decisiones/QA.

✅ **Aceptación:** todo lo aplicable del checklist `seo` verificado (meta/JSON-LD/robots/sitemap/404/OG).

---

### Fase 7 — Seguridad y rate limiting

**Objetivo:** endurecer sin backend (rate limit client-side es la única opción real; se documenta como límite).

- `T7.1` ✅ **CERRADO** — `core/rate-limit.js`: token bucket (6 tokens, recarga 400ms, cola FIFO `esperarTurno` + `esperar` para backoff) integrado en `characters-api.js`; debounce de búsqueda 400ms; anti-brute-force de login endurecido (5 intentos → bloqueo 2 min) con **test E2E** ("bloqueo tras 5 intentos fallidos").
- `T7.2` ✅ **CERRADO** — CSP sin `wasm-unsafe-eval`/`unsafe-inline` de scripts (`script-src 'self'` en los 6 HTML + 404); `style-src 'unsafe-inline'` documentado como única concesión (atributos `style` de la app).
- `T7.3` ✅ **CERRADO** — Cookies endurecidas: `SameSite=Lax` + `Path=/` + `Secure` condicional en https (`core/cookies.js`, crear+borrar); `autocomplete` correctos en todos los formularios; límite `HttpOnly` imposible en cliente documentado.
- `T7.4` ✅ **CERRADO (revisión `security-review` aplicada)** — Ver detalle en §13 (Fase 7): secrets N/A · validación de entrada (`validators.js`, `?id=` sólo dígitos) · XSS (`textContent` obligatorio; 22 `innerHTML` auditados = strings estáticos propios) · auth client-side documentada · errores genéricos sin enumerar usuarios · sin credenciales en logs · **1 advisory `braces` dev-only sin parche upstream** documentado.
- `T7.5` ✅ **CERRADO (especificado, no implementado)** — Arquitectura futura con backend especificada en §13: proxy/edge que:
  1. mueve rate-limit y auth al servidor (tokens firmados, cookies `HttpOnly`+`Secure`);
  2. sirve `/api/proxy/*` → Rick and Morty con cuota global por IP/usuario (añadiendo cabeceras CORS y cache en edge);
  3. pasa a bcrypt/argon2 + cuentas reales y migración de favoritos a BBDD;
  4. headers de seguridad en el edge (CSP con nonces, HSTS). Nada de esto se implementa: fuera de alcance del enunciado.

✅ **Aceptación:** CSP limpia · rate limit demostrable (test) · checklist `security-review` aplicada con veredicto en §13.

---

### Fase 8 — Accesibilidad

**Objetivo:** cumplimiento AA + usabilidad por teclado.

- `T8.1` ✅ **CERRADO** — Skip-link (`#contenido` + `.skip-link` en los 6 HTML), `role="alert"`/`aria-live` en errores de formularios (`#error-general`), nav con `aria-label`, foco visible `:focus-visible`, disclosure accesible del dropdown «Mi cuenta» (`aria-expanded`/`aria-controls`/Escape/foco restaurado), botón favorito con `aria-pressed` + etiqueta visible.
- `T8.2` ✅ **CERRADO** — `pnpm check:contrast` (28 pares de tokens AA en ambos temas, verde).
- `T8.3` ✅ **CERRADO** — Modal de confirmación de logout con Escape + focus trap + restauración de foco (`components.js`).
- `T8.4` ✅ **CERRADO** — `pnpm test:a11y`: axe-core vía `@axe-core/playwright` en 6 páginas × 2 temas × 3 viewports = **0 violaciones graves** (test con `bypassCSP`).

✅ **Aceptación:** `@axe-core/playwright` limpio — cumplido (66/66 suite verde).

---

### Fase 9 — QA responsive (todas las resoluciones)

**Objetivo:** matriz completa verificada con evidencia.

**Matriz obligatoria:** `320 · 360 · 375 · 414 · 480 · 768 · 834 · 1024 · 1280 · 1440 · 1920 · 2560` (+ landscape en móvil/tablet) **× 6 páginas × 2 temas**.

- `T9.1` ✅ **CERRADO** — Checklist automatizado en `tests/responsive.spec.js`: 0 overflow horizontal en 6 páginas (375/768/1280), nav adaptativa en 375 (iconos redondos sin hamburguesa + dropdown de «Mi cuenta» operativo con Escape), enlaces de texto en 1280 y **cabecera sticky (M3)** verificada tras scroll. Matriz completa (144 celdas) documentada como verificación manual/CI en README §QA.
- `T9.2` ✅ **CERRADO** — `pnpm test:responsive` (proyectos de Playwright por viewport + reporte HTML en `reportes/playwright`; capturas al fallar).
- `T9.3` ✅ **CERRADO (documentado)** — Verificación manual complementaria (DevTools modo dispositivo + real) queda como checklist en README §QA — dispositivo físico no disponible en el repo.

✅ **Aceptación:** checks automáticos verdes + matriz manual documentada.

---

### Fase 10 — Pruebas E2E y validación final

**Objetivo:** cerrar con regresión, revisión y documentación.

- `T10.1` ✅ **CERRADO** — `tests/e2e.spec.js`: registro → login → catálogo → buscar → favorito → detalle → cuenta → logout; bloqueo tras 5 intentos; persistencia del tema; 404 con status real. API mockeada (`page.route` + fixtures) para suite hermética.
- `T10.2` ✅ **CERRADO** — Regresión del enunciado: rutas protegidas, sesión expira a 60 min (manipula `_loginAt`), migración de favoritos al cambiar email, logout no borra favoritos, aislamiento de favoritos por usuario.
- `T10.3` ✅ **CERRADO** — Code review final con checklists: 9 ítems `frontend-design-direction` ✅ + a11y/animación `frontend-patterns` ✅ + `seo` ✅ + `security-review` (✅ T7.4) + rubro de comentarios JSDoc ✅ (veredicto en «Detalle T10.3»).
- `T10.4` ✅ **CERRADO** — `README.md`: comandos pnpm, estructura, decisiones arquitectónicas, cómo añadir un componente, sección QA (gate automático, matriz manual, Lighthouse, API real).

✅ **Aceptación:** E2E 100% verde (81/81) · budgets en presupuesto · axe limpio · review aprobada (T10.3 cerrado).

---

### Fase 11 — Modificaciones posteriores (M1–M6) — ✅ CERRADAS

Cambios pedidos por el usuario tras la primera entrega (bloque original retirado del README tras ejecutarse).

- `M1` ✅ **CERRADO** — Sin animaciones de subida ni bordes remarcados fuera de cards: `.tubo-card:hover` (lift+borde+glow) reubicado a `article[data-id]:hover` (solo cards, que conservan lift/zoom/reveal); eliminados `@keyframes estado-entrada` + retrigger en `page-states.js`, `.btn:active translateY(1px)` y `border-color` de `.btn-ghost:hover`.
- `M2` ✅ **CERRADO** — `crearControlPassword(input, { conMedidor })`: medidor de fuerza SOLO en registro (`#password`) y «Nueva contraseña» de Mi cuenta; login y campos de confirmación conservan solo el botón ojo.
- `M3` ✅ **CERRADO** — Cabecera sticky (`.cabecera-fija` en el `<header>` completo) + barra glass (`.barra-vidrio`: `color-mix` del panel + `backdrop-filter: blur(14px)`), ambos temas.
- `M4` ✅ **CERRADO** — Sin hamburguesa (`icon-menu` eliminado del sprite): ≥768px enlaces de texto (estilo original); <768px iconos redondos de 44px (nuevo `icon-grid`, heart, tema, user). Dropdown «Mi cuenta» (`#menu-cuenta`: Mi cuenta + Cerrar sesión) en TODOS los tamaños, con `aria-expanded`/Escape/clic-fuera y logout vía modal. Logo renombrado a «Catálogo de Personajes» (encogible/truncable => sin overflow a 375px).
- `M5` ✅ **CERRADO** — Eliminadas las 7 anotaciones visibles `//` (index, login, register, mi_account, favorites, 404 y el resumen de `account.js`); se conservan `microcopy` funcionales sin `//` (dt del detalle, ficha-id, indicadores).
- `M6` ✅ **CERRADO** — Imagen del detalle completa la card en 2 columnas (`md:aspect-auto` en `character.html` + esqueleto); móvil mantiene el cuadrado.
- **Tests:** ajustados logout (dropdown `#btn-cuenta`/`#btn-salir`) y header responsive (iconos/dropdown/sticky); añadidos test M6 (hueco del detalle) y bloque M2 (3 tests del medidor); **suite 81/81** (66 originales + 3 header M3/M4 + 1 M6 + 3 M2; cada test corre en los 3 viewports).
- **Docs:** README (decisiones 9–12, QA) y este documento actualizados; bloque de instrucciones original retirado del README.

✅ **Aceptación:** `pnpm test:e2e` 81/81 · lint/format/imports/contrast/build/budgets en verde · smoke (10/10 rutas × 200, CSS sin `estado-entrada`/`translateY(1px)`/`.tubo-card:hover` y con `.cabecera-fija`/`.barra-vidrio`/`.menu-cuenta`, cero textos `//`).

---

## 7. Características faltantes evaluadas (UX/UI/tech con temática R&M)

| Categoría | Característica                                                | Fase         |
| --------- | ------------------------------------------------------------- | ------------ |
| UX/UI     | Show/hide password + medidor de fuerza                        | 3            |
| UX/UI     | Filtros por estado/especie + ordenamiento                     | 3            |
| UX/UI     | Toast/notificaciones (éxito/error)                            | 2, 3         |
| UX/UI     | Empty/error states ilustrados                                 | 2            |
| UX/UI     | Página 404 temática                                           | 6            |
| UX/UI     | Confirmación de logout (modal)                                | 2            |
| UX/UI     | Compartir ficha de personaje                                  | 3            |
| UX/UI     | Avatar/identidad de usuario en header                         | 2            |
| UX/UI     | Restaurar scroll al volver del detalle                        | 3            |
| Futurista | Texto glitch en hero/títulos                                  | 1, 3         |
| Futurista | Glow de portal en focus/hover                                 | 1            |
| Futurista | Grid en perspectiva de fondo sutil                            | 1            |
| Futurista | Scanlines CRT opcionales (variante C)                         | 1            |
| Futurista | Microcopy con guiños ("wubba lubba…") sin sacrificar claridad | 3            |
| Futurista | Hover "abrir portal" en cards                                 | 3, 4         |
| Futurista | Easter egg discreto (konami o similar)                        | 3 (opcional) |
| Tech      | `theme-color` por tema                                        | 6            |
| Tech      | Favicon SVG propio                                            | 6            |
| Tech      | Manifest PWA (opcional)                                       | 6 (decidir)  |
| Tech      | Fallback offline "dimensión inestable" cuando la API cae      | 5            |
| Tech      | Captura global de errores (`window.onerror`) con log          | 5            |
| Limpieza  | Links muertos About/Contact                                   | 3            |
| Limpieza  | `favorites.html` sin su CSS (resuelto con build único)        | 0            |
| Limpieza  | `h1` placeholder "En construccion"                            | 3, 6         |

_Regla rectora (`frontend-design-direction`): motion de alta señal — nada decorativo que enmascare lentitud ni añada dependencia sin retorno._

---

## 8. Mejoras de rendimiento (resumen ejecutivo)

1. **Eliminar Tailwind CDN** → build local (mayor impacto: sin compilación en runtime, sin script bloqueante, CSP más estricta).
2. CSS crítico inline + `content-visibility` en el grid.
3. `fetchpriority` en LCP + lazy/async en resto de imágenes.
4. Caché stale-while-revalidate de API + sessionStorage versionada.
5. JS modular sin re-descargas innecesarias; medición con presupuestos (Lighthouse).
6. Tipografías con `font-display: swap` + preconnect.

## 9. Mejoras de seguridad (resumen ejecutivo)

1. **Rate limiting client-side** (`rate-limit.js`: token bucket + cola + backoff 429) — única opción sin backend; documentado como best-effort.
2. CSP estricta: fuera `wasm-unsafe-eval` e `unsafe-inline`.
3. Cookies endurecidas (SameSite, Secure) + autocomplete correcto.
4. Anti-brute-force de login mantenido y endurecido.
5. XSS: `textContent` obligatorio, `innerHTML` con datos externos prohibido.
6. Límites de la auth client-side documentados en README (en producción: bcrypt/argon2 + backend).
7. Especificación (no implementación) de proxy/edge para futuro backend.

---

## 10. Presupuestos, métricas y checklists de aceptación

### 10.1 Presupuestos de rendimiento

| Métrica                | Objetivo                                 |
| ---------------------- | ---------------------------------------- |
| Lighthouse Performance | ≥ 90 (meta 95)                           |
| LCP                    | ≤ 2.5s (4G throttle)                     |
| CLS                    | < 0.1                                    |
| INP                    | < 200ms                                  |
| JS total               | < 65KB gzip                              |
| Requests a CDN externo | 0 (solo `rickandmortyapi.com` + fuentes) |

### 10.2 Matriz de testing responsive

12 viewports × 6 páginas × 2 temas = **144 celdas** con checklist y capturas de evidencia.

### 10.3 Checklist de dirección de diseño (gate final)

1. La primera pantalla comunica de inmediato de qué trata la app.
2. La jerarquía soporta escaneo y uso repetido.
3. La tipografía no se solapa ni desborda.
4. El color tiene contraste y no es monótono.
5. Iconos para acciones familiares.
6. Dimensiones estables en grids/toolbars/controles (sin saltos en hover).
7. Assets con significado, no relleno.
8. El motion orienta, no enmascara lentitud.
9. Convenciones del repo respetadas salvo justificación clara.

---

## 11. Riesgos y mitigaciones

| #   | Riesgo                                                | Mitigación                                                     |
| --- | ----------------------------------------------------- | -------------------------------------------------------------- |
| 1   | API externa caída o limitada                          | Caché SWR + backoff + estados de error amigables ya existentes |
| 2   | La reestilización rompe la lógica JS (depende de IDs) | Refactor por página + E2E antes/después (Fases 2→3→10)         |
| 3   | Scope creep por features temáticas                    | Gate de aprobación al cerrar cada fase; sección 7 priorizada   |
| 4   | Dark mode incompleto en algún componente              | Checklist light+dark por componente en cada fase               |
| 5   | Sin servidor: rate limit solo best-effort             | Documentado como límite en este plan y en README               |
| 6   | Animaciones degradan rendimiento                      | Presupuestos + reduced-motion + verificación con DevTools perf |

---

## 12. Orden de ejecución y dependencias

```
Fase 0 (tooling) ──▶ Fase 1 (tokens + dirección visual) ──▶ Fase 2 (componentes UI)
                                                                  │
                            ┌─────────────────────────────────────┤
                            ▼                                     ▼
                     Fase 3 (páginas) ◀────────────────── Fase 4 (animaciones)
                            │
        ┌──────────┬────────┼──────────┬──────────────┐
        ▼          ▼        ▼          ▼              ▼
    Fase 5     Fase 6   Fase 7    Fase 8        Fase 9
 (rendimiento)  (SEO)  (seguridad) (a11y)     (responsive)
        └──────────┴────────┴──────────┴──────────────┘
                               │
                               ▼
                    Fase 10 (E2E + validación final)
```

- Fases 5–9 son **paralelizables** entre sí tras cerrar Fase 3.
- **Conteo de tareas:** F0: 5 · F1: 5 · F2: 4 · F3: 5 · F4: 4 · F5: 5 · F6: 4 · F7: 5 · F8: 4 · F9: 3 · F10: 4 → **total 48 tareas**.

---

## 13. Estado de ejecución

| Fase                                | Estado        | Notas                                                                          |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| Dirección visual (T1.1)             | ✅ Completada | Elegida variante C "Dimensión CRT"; `.design-previews/` eliminada              |
| Fase 0 — Andamiaje (T0.1–T0.5)      | ✅ Completada | Ver detalle abajo                                                              |
| Fase 1 — Tokens (T1.2–T1.5)         | ✅ Completada | Ver detalle abajo                                                              |
| Fase 2 — Componentes (T2.1–T2.4)    | ✅ Completada | Ver detalle abajo                                                              |
| Fase 3 — Reestilización (T3.1–T3.6) | ✅ Completada | Ver detalle abajo                                                              |
| Fases 4–7                           | ✅ Completada | Ver detalle abajo                                                              |
| Fases 8–9                           | ✅ Completada | Ver detalle abajo                                                              |
| Fase 10 (T10.1–T10.2, T10.4)        | ✅ Completada | README.md creado; tests del enunciado verdes                                   |
| Fase 11 (M1–M6 modificaciones)      | ✅ Completada | Nav sticky/glass + dropdown "Mi cuenta"; suite ahora **81/81**                 |
| T10.3 (review final de checklists)  | ✅ Completada | Las 4 checklists aprobadas sin hallazgos (ver «Detalle T10.3»)                 |
| Verificación final del gate         | ✅ Completada | lint · format · imports · contrast · build · budgets · suite **81/81** · smoke |

### Detalle Fase 0 (cerrada)

- **T0.1 ✓** `package.json` (scripts pnpm: dev/build/watch/lint/format/check:imports), `.gitignore`, `.prettierrc` + `.prettierignore`, `eslint.config.js` (flat, ESLint 10), deps vía `pnpm add -D` (tailwindcss 4.3.3 + CLI, prettier, eslint, @eslint/js, globals). `@parcel/watcher` aprobado en `pnpm-workspace.yaml` (`allowBuilds`) para `tailwind --watch`.
- **T0.2 ✓** `src/styles/app.css`: imports + `@source` explícitos + `@custom-variant dark` por clase + `@theme static` con tokens CRT iniciales (§3.3/3.4) + import de `css/customCss.css` (build único — corrige favorites.html).
- **T0.3 ✓** `scripts/dev.mjs`: watch de Tailwind + servidor estático (4173, sin caché, defensa path-traversal) + livereload por SSE con cliente servido como fichero propio (compatible con CSP `script-src 'self'`). `scripts/check-imports.mjs` (`pnpm check:imports`).
- **T0.4 ✓** 17 módulos JS reubicados en `src/` por capas (config/core/services/domain/ui/controllers) con renombres: `favoritos.js→services/favorites-repository.js`, `api/api.js→services/characters-api.js`, `tema.js→services/theme-boot.js`, `temaUI.js→services/theme-toggle.js`, `index.js→controllers/catalog.js`, `favorites.js→controllers/favorites-page.js`, `detail.js→controllers/character.js`, `mi_account.js→controllers/account.js`, `validaciones.js→domain/validators.js`. 35 imports reescritos. Eliminados `js/` y `api/`. Los 6 HTML: CSP sin `wasm-unsafe-eval`/jsdelivr, `<link dist/app.css>` en lugar de CDN+inline, rutas de scripts actualizadas.
- **T0.5 ✓ Checkpoint verde:** `pnpm check:imports` (35/35) · `node --check` (17/17) · `pnpm lint` (0 problemas) · `pnpm build` (tokens estáticos + dark por clase + utilidades completas) · smoke test HTTP (12 URLs 200 + 8 verificaciones de contenido).

### Detalle Fase 1 (cerrada)

- **T1.2 ✓** `src/styles/tokens.css`: capa semántica (`--app-*`, `--brand`/`--info`/`--danger`, `--on-*`, `--*-soft`, `--fx`, `--glow-*`, `--r-ctl`/`--r-card`/`--trans`/`--ease`) que apunta a la paleta cruda de `@theme static` en `app.css` (fuente única). `:root` = modo día (+ `color-scheme: light`), `.dark` = CRT. Base global: `body` en IBM Plex Mono sobre `--app-bg`, `h1–h4` en VT323, scrollbars finas por tema, `::selection` ámbar, `:focus-visible` con glow y guarda global `prefers-reduced-motion`. `app.css` ganó `@theme inline` semántico (`bg-app`, `bg-panel`, `text-ink`, `text-dim`, `border-line`, `text|bg-brand`, `info`, `danger`, `*-soft`) + safelist `@source inline(...)` para que las utilities existan desde ya.
- **T1.3 ✓** Google Fonts (`VT323` + `IBM Plex Mono:wght@400;600`, `display=swap`, `preconnect` ×2) en los 6 HTML + CSP ampliada en las 6 páginas (`style-src` + `https://fonts.googleapis.com`, `font-src https://fonts.gstatic.com`). Self-host en `public/fonts` queda como upgrade opcional de Fase 5 (§3.4).
- **T1.4 ✓** `src/styles/components.css` en `@layer components`: `.btn` (+ `.btn-primary`/`-info`/`-danger`/`-ghost` con glow hover), `.campo` (base + foco cian), validaciones migradas de `css/customCss.css` con tokens semánticos **y dark mode** (gap corregido: la versión heredada era solo-light), `.badge` (vivo=cian · muerto=magenta · desconocido=ámbar, según preview C), `.tubo-card` (radio 14px + glow ámbar + lift), `.skeleton` shimmer sutil, `.aviso` error/info. `css/customCss.css` **eliminado** (solo quedaban referencias documentales, actualizadas).
- **T1.5 ✓** `theme-boot.js` (script bloqueante `'self'` en `<head>`, sin FOUC): cookie → `prefers-color-scheme` → **fallback CRT oscuro** si el sistema no reporta `light`. `color-scheme` por tema + transiciones globales vía `--trans`/`--ease` (guarda reduced-motion incluida).
- **Ajuste §3.3 por AA (§3.7):** acentos del modo día oscurecidos para pasar 4.5:1 como texto sobre fondo claro: `--color-phos-soft` `#c77f00→#8f5a00`, `--color-cy-soft` `#0e8b99→#0b6b78`, `--color-mg-soft` `#e0246f→#c0155a`.
- **Checkpoint verde:** `pnpm build` · `pnpm lint` (0) · `pnpm check:imports` (35/35) · **`pnpm check:contrast` (28/28 pares AA — nuevo script en `scripts/check-contrast.mjs`)** · smoke test (12 URLs 200 + 6 páginas con CSP/fuentes/boot correctos, sin referencias a `customCss`). `pnpm format` aplicado; `.opencode/` añadido a `.prettierignore`.

### Detalle Fase 2 (cerrada)

- **T2.1 ✓** `src/ui/header.js`: `montarHeader({ sesion, activo })` inyecta UNA cabecera antes del `<main>` (reemplaza las 4 copias: index, favorites, character, mi_account). Nav "Catálogo/Favoritos" con `aria-current="page"` + acento `text-brand`, nombre de usuario (handle `actualizarNombre()` para Mi cuenta), toggle de tema conectado en el mismo acto (`conectarToggleTema`, idempotente) y **logout con `crearModal` de confirmación**. Clases semánticas Fase 1 (`bg-panel`, `border-line`, `btn-*`). `RUTAS.favoritos` añadido a config. Enlaces muertos About/Contact eliminados.
- **T2.2 ✓** `src/ui/components.js` (fábricas puras): `crearBadgeEstado` (mapa OCP `BADGE_POR_ESTADO`, etiqueta traducida a Español: Vivo/Muerto/Desconocido), `crearBotonFavorito`/`pintarBotonFavorito` (sprite `#icon-heart`↔`#icon-heart-fill`, `aria-pressed`, `aria-label`, color `text-danger`/`text-dim`, etiqueta "En favoritos" en el detalle), `crearCardPersonaje` (card JS con `tubo-card`; **mata el `<template id="character-card">` duplicado en 2 HTML**), `crearSkeletonCard` + `crearSkeletonDetalle`, `crearEstadoVacio`, `crearEstadoError` (icono alert + acción opcional), `mostrarToast` (contenedor singleton `role="status" aria-live="polite"`, auto-retiro), `crearModal` (overlay `aria-modal`, Escape, trap de Tab, foco restaurado) y `crearCampo`/FormField (label + `input.campo` + `#error-<id>` con `aria-live` y `aria-describedby`; contrato intacto con `validators.js`).
- **T2.3 ✓** `src/ui/page-states.js`: `crearZonaPersonajes({ alReintentar })` => una instancia por página con sus 4 zonas (cargando con `aria-live`+`aria-busy`, error con `role="alert"`, vacío con `aria-live"`, grid) + `pintarSkeletons`/`setError`/`setVacio`. **Elimina los ids compartidos `#estado-*`/`#characters-grid`** (ahora cada página monta su nodo; favoritos personaliza sus textos de vacío).
- **T2.4 ✓** `src/ui/icons.js`: sprite `<symbol>` propio (heart, heart-fill, sun, moon, user, logout, alert, check, close; feather-like, `currentColor`) + `asegurarSprite()` idempotente + `icono(nombre, clases)`. `theme-toggle.js` ahora pinta sol/luna con el sprite (sin glifos Unicode).
- **Refactors de soporte:** `ui/characters.js` adelgazado (cache + mapeo + `renderizarPersonajes(grid, ...)` + `montarGridDelegacion(grid, ...)` — la grid ya no es un id global sino un parámetro inyectado; se eliminaron `ESTADOS_STYLE`/`mostrarEstado`/`renderizarSkeletons`/`renderizarError`). Controladores actualizados: `catalog.js` y `favorites-page.js` usan zona + header + **toast de feedback al alternar favoritos**; `character.js` usa `crearSkeletonDetalle`/`crearEstadoError`/badge/botón componentes; `account.js` construye sus 5 campos con FormField y actualiza el nombre del header tras guardar.
- **HTML:** los 4 protegidos pierden `<header>` estático (comentario + controlador inyectan); index/favorites pierden estados+template (mount `#zona-catalogo`/`#zona-favoritos`); character deja el esqueleto/error a JS y la fila de acciones con `data-acciones`; mi_account deja los campos a FormField (`#campos-cuenta`). login/register intactos (btn-tema estático vía auto-init).
- **Verificación:** `pnpm lint` (0) · `check:imports` (54/54) · `check:contrast` (28/28) · `pnpm build` (todas las utilities de los componentes presentes en dist) · smoke (17 URLs 200 + 15 checks de contenido: sin headers/templates/estados estáticos donde corresponde, mounts correctos, btn-tema conservado en login/register).

### Detalle Fase 3 (cerrada)

- **T3.1 ✓** Login y register reestilizados como "terminal de portal": microcopy `// interdimensional cable`, h1 `.glitch` (VT323), panel `tubo-card`, campos `.campo`, aviso error `role="alert"` show/hide (`mostrarError`/`ocultarError`). `crearControlPassword(input)` en `components.js` envuelve el input en `.campo-wrap` con botón ojo (`aria-pressed`, alterna sin perder valor) + medidor `.fuerza` de 4 segmentos alimentado por `evaluarFuerza()` en `domain/validators.js` (misma política que el regex: longitud, caja mixta, dígito, especial → etiquetas Muy débil…Excelente; colores danger/brand/info por nivel).
- **T3.2 ✓** `index.html`: hero con texto real ("Catálogo Interdimensional") + microcopy + glitch; barra de herramientas con buscador (`> grep -i nombre...`), spinner inline `#indicador-busqueda` (`animate-spin` + icon-loader) con `aria-busy`, selects Estado/Especie (valores exactos de la API: alive/dead/unknown, Human/Alien/Humanoid/Robot/…) y Orden (API/nombre A-Z/Z-A/estado), indicador `#indicador-lista` "Mostrando N · filtros". `characters-api.js`: `buscarPersonajes({nombre, estado, especie, pagina})` con URLSearchParams (404 "Nothing found" → []). `catalog.js` reescrito: estado `listaCargada` + `cargar({reemplazar})` unificado (sin filtros → `obtenerPersonajes` con caché; con filtros → `buscarPersonajes`), token `secuencia` anti-obsoletos, `pintarGrid()` con `ordenarPersonajes()` (mapa OCP en `ui/characters.js`), "Cargar más" con spinner/bloqueo doble clic y fin de lista silencioso, "Limpiar" resetea toda la barra, empty state ilustrado (TV+lupa).
- **T3.3 ✓** `favorites-page.js`: `mostrarVacio()` con `ilustracion: 'favoritos'` (TV+corazón, `crearIlustracion()` mapa OCP en components.js); al quitar favorito: `retirarCardAnimada(card)` (Web Animations API fade/scale 200ms; `prefers-reduced-motion` → `remove()` directo) y el estado vacío se muestra tras el `onfinish`.
- **T3.4 ✓** `character.html`/`character.js`: ficha jerárquica (microcopy `#007 · expediente interdimensional` + nombre glitch con `data-text` sincronizado), `fetchpriority="high"` en la imagen LCP, chips `EP###` extraídos del último segmento de cada URL de `episode` (tope 12 + "+N más", sin fetch adicional, chips neutros `.badge`), botón `#btn-compartir` (icono share + Web Share API → fallback `clipboard.writeText` + toast; AbortError no dispara fallback), `#btn-volver` con `history.back()` cuando el referrer es del mismo origen.
- **T3.5 ✓** `mi_account.html`/`account.js`: `#resumen-cuenta` (tubo-card con nombre/correo/nº favoritos, `textContent`, re-pintado tras guardar), éxito vía `mostrarToast` (se elimina el span `#mensaje_exito`), ojo/medidor en las dos contraseñas, `#error-general` con `role="alert"` show/hide.
- **T3.6 ✓ (efectos firma globales, §3.5)** `components.css`: overlays `body::before` (scanlines `repeating-linear-gradient`, opacidad `calc(var(--fx)*0.06)`) + `body::after` (viñeta `box-shadow` inset) fijos `z-index:100 pointer-events:none` dentro de `@media (prefers-reduced-motion: no-preference)`; `.glitch` con pseudo-elementos `attr(data-text)` + keyframes `glitch-ciclo` (clip-path cian/magenta ~8% del ciclo); `.microcopy` (VT323 uppercase tracking); `.campo-wrap`/`.campo-toggle`; `.fuerza`/`.fuerza-barra`/`.fuerza-seg`/`.fuerza-texto`; `.campo option` coherente con el panel. Sprite ampliado: eye, eye-off, loader, share.
- **Verificación:** `pnpm lint` (0) · `check:imports` (58/58) · `check:contrast` (28/28) · `pnpm build` OK · smoke dev server: 10 URLs 200 + 21/21 checks de contenido (hero, glitch, filtros, microcopy login/register, fetchpriority/chips/share/volver, resumen cuenta, scanlines/glitch/fuerza/microcopy/campo-toggle en dist).

### Detalle Fases 4–7 (cerradas)

- **T4.1 ✓** Catálogo de motion en `components.css` con `--trans`/`--ease`: `.btn:active` scale 0.97, `.estado-entrada` (fade+slide 200ms con retrigger en `page-states.js`), `.reveal`→`.reveal-listo` one-shot vía `observarReveal()` (IntersectionObserver en `ui/characters.js`), transición de tema con `--trans` en `theme-boot.js`.
- **T4.2 ✓** `portal-entrada` (≤150ms, scale+glow) retriggered al montar el detalle en `mostrarEstadoDetalle('detalle')` — nodo ya pintado, nunca bloquea.
- **T4.3 ✓** Guard global `prefers-reduced-motion` en `tokens.css` (anula keyframes/scanlines/glitch/reveal) + `.skip-link` + `.img-fade` (opacity al cargar, sin salto).
- **T4.4 ✓** `src/ui/view-transitions.js`: `document.startViewTransition` + reduced-motion detectados; `navegar()`/`mejorarEnlaces()` aplicados a nav de cards (catálogo/favoritos) y header.
- **T5.1 ✓** CSS crítico inline en los 6 HTML + `404.html` + `content-visibility:auto`/`contain-intrinsic-size` en `article[data-id]`.
- **T5.2 ✓** `fetchpriority="high"` en LCP del detalle + `.img-fade` (blur-up descartado: decode extra sin retorno medible).
- **T5.3 ✓** SWR en `characters-api.js`: memoria + sessionStorage versionada (`v3`, TTL 5min), revalidación en fondo, backoff 300/600ms solo transitorios, `AbortController` en `pagehide`, 404 sin reintento.
- **T5.4 ✓** `pnpm audit:budgets` (`scripts/audit-budgets.mjs`): CSS < 20KB gzip · JS < 65KB gzip — **actual CSS ~7.5KB · JS ~55KB PASS**.
- **T5.5 ✓** `pnpm audit:lighthouse` documentado en README §QA (requiere `pnpm dev`; navegador externo no instalado en repo).
- **T6.1 ✓** Meta por página (title/description/canonical/OG/Twitter), `theme-color` dinámico por tema (`#meta-theme-color`), `favicon.svg` propio.
- **T6.2 ✓** `robots.txt` + `sitemap.xml` + `404.html` en la **raíz** (el dev server sirve desde ROOT) con status 404 real en `scripts/dev.mjs`.
- **T6.3 ✓** JSON-LD `WebSite` en `index.html` + `Person` inyectado desde `character.js` (`#ld-personaje`, escape `<`→`\u003c`); `h1` único por página; `lang="es"`.
- **T6.4 ✓ (documentada)** Techo de indexación de contenido JS-rendered anotado en README §Decisiones/QA; prerender queda como futuro opcional fuera de alcance.
- **T7.1 ✓** `core/rate-limit.js`: token bucket (6 tok / 400ms) + cola FIFO `esperarTurno` + `esperar()` para backoff; integrado en `characters-api.js`; debounce 400ms en búsqueda; anti-brute-force login (5 intentos → bloqueo 2min) con test E2E.
- **T7.2 ✓** CSP `script-src 'self'` en los 6 HTML + `404.html` (sin `wasm-unsafe-eval`, sin CDN); `style-src 'unsafe-inline'` documentado como única concesión (atributos `style` de la app).
- **T7.3 ✓** `core/cookies.js`: `SameSite=Lax` + `Path=/` + `Secure` condicional en https (crear+borrar); `autocomplete` correctos en formularios; límite `HttpOnly` imposible en cliente documentado.
- **T7.4 ✓ (revisión aplicada)** Veredicto por ítem de la checklist `security-review`:
  - **Secrets:** N/A — API pública sin claves; nada sensible hardcodeado.
  - **Validación de entrada:** `domain/validators.js` (login/register/cuenta/email/password/confirm) + `?id=` sólo dígitos (`/^\d+$/` en `character.js`) + API params vía `URLSearchParams`.
  - **Inyección/BBDD:** N/A (sin backend).
  - **Autenticación:** client-side por diseño (localStorage usuarios con SHA-256+salt, sesión SS 60min) — límite honesto documentado; anti-brute-force 5 intentos con test; mensajes genéricos sin enumerar usuarios.
  - **XSS:** `textContent` obligatorio para datos externos; **22 `innerHTML` auditados = strings estáticos propios** (iconos, plantillas internas); JSON-LD con escape; CSP `script-src 'self'` sin `unsafe-eval`.
  - **CSRF:** N/A backend; cookies `SameSite=Lax` + `Secure` en https.
  - **Rate limiting:** token bucket + cola + backoff (mejor esfuerzo client-side, documentado) + bloqueo de login.
  - **Exposición de datos:** sin credenciales en logs (solo `console.warn/error` de diagnóstico, 7 ocurrencias revisadas); errores genéricos al usuario; cookies solo tema/correo recordado.
  - **Dependencias:** `pnpm-lock.yaml` presente; **1 advisory `braces` ≤3.0.3 (GHSA-vfj7-8cjw-p6xm, HIGH, sin parche upstream)** — cadena **dev-only** `@tailwindcss/cli → @parcel/watcher → micromatch → braces`; no se distribuye en runtime (el build emite CSS compilado) y el vector (globs controlados por nosotros) no aplica. Sin fix disponible → documentado como riesgo aceptado.
- **T7.5 ✓ (especificado, no implementado)** Arquitectura futura con backend/edge: (1) rate-limit y auth al servidor con tokens firmados + cookies `HttpOnly`/`Secure`; (2) `/api/proxy/*` → Rick and Morty con cuota global por IP/usuario, CORS y cache en edge; (3) bcrypt/argon2 + BBDD real con migración de favoritos; (4) headers de seguridad en el edge (CSP con nonces, HSTS). Fuera de alcance del enunciado; solo especificado.

### Detalle Fases 8–9 (cerradas)

- **T8.1 ✓** Skip-link (`#contenido` + `.skip-link` en los 6 HTML), `role="alert"`/`aria-live` (`#error-general`), nav `aria-label`, `:focus-visible` con glow, disclosure accesible del dropdown «Mi cuenta» (`aria-expanded`/`aria-controls`/Escape con foco restaurado — sustituye al antiguo menú hamburguesa en la Fase 11), botón favorito `aria-pressed` + etiqueta visible (sin aria-label redundante — fix de `label-content-name-mismatch`).
- **T8.2 ✓** `pnpm check:contrast` — **28/28 pares AA** en ambos temas (`scripts/check-contrast.mjs`).
- **T8.3 ✓** `crearModal` (logout): overlay `aria-modal`, Escape, trap de Tab, foco restaurado.
- **T8.4 ✓** `pnpm test:a11y` — axe-core vía `@axe-core/playwright`, 6 páginas × 2 temas × 3 viewports = **0 violaciones graves** (test con `bypassCSP: true`, timeout 90s).
- **T9.1 ✓** `tests/responsive.spec.js`: 0 overflow horizontal en 6 páginas (375/768/1280); nav adaptativa (Fase 11: iconos redondos sin hamburguesa + dropdown de «Mi cuenta» con Escape en 375, enlaces de texto en 1280); cabecera sticky verificada tras scroll. Matriz completa (144 celdas: 12 resoluciones × 6 páginas × 2 temas) documentada como checklist manual/CI en README §QA.
- **T9.2 ✓** `pnpm test:responsive` con proyectos Playwright por viewport; reporte HTML en `reportes/playwright`.
- **T9.3 ✓ (documentado)** Verificación manual complementaria (DevTools + dispositivo real) como checklist en README §QA.
- **Infra Playwright:** `playwright.config.js` (3 projects, `webServer` = `node scripts/dev.mjs` con `NO_LIVERELOAD=1`, `reuseExistingServer:false` → matar dev manual antes de cada corrida); API mockeada con `page.route` + `tests/fixtures/personajes.js` (suite hermética, sin rate-limit real); helpers `tests/helpers/sesion.js` y `tests/helpers/mock-api.js`.
- **Bugs reales detectados y corregados por los tests:** `svg.className`→`setAttribute` en `crearEstadoVacio` (rompía todos los estados vacíos); `pintarResumen()` relee sesión fresca; typo `violaciones`→`violations` en el reporte de axe; aria-label del favorito con texto visible; livereload recargaba páginas mid-test → `NO_LIVERELOAD=1` + `IGNORAR_WATCH`.

### Detalle Fase 10 (T10.1–T10.4, cerrados)

- **T10.1 ✓** `tests/e2e.spec.js`: flujo principal completo (registro → login → catálogo → buscar → favorito → detalle → compartir/volver → cuenta → logout), bloqueo tras 5 intentos, persistencia del tema, 404 con status real. Timeouts 60s en describes con 2 ciclos registro+login; wrappers con reintento sobre `iniciarSesion` (espera URL o `#error-general`).
- **T10.2 ✓** Regresión del enunciado: rutas protegidas (redirect JS asertado con `goto().catch`), sesión expira a 60 min (manipula `_loginAt`), migración de favoritos al cambiar correo, logout NO borra favoritos, aislamiento de favoritos por usuario.
- **T10.4 ✓** `README.md`: comandos pnpm (dev/build/lint/format/check:_/audit:_/test:*), estructura por capas, 8 decisiones arquitectónicas, "cómo añadir un componente", sección QA (gate automático, matriz 144 celdas manual/CI, Lighthouse, smoke con API real).
- **Suite completa: 81/81 passed** (2 workers, 3.7min) — `test:e2e` + `test:a11y` + `test:responsive` (66 originales + 3 header M3/M4 + 1 M6 + 3 M2, cada uno en los 3 viewports).
- **T10.3 ✓** Las 4 checklists finales aprobadas (veredicto y detalle en «Detalle T10.3» al final del documento).

### Detalle Fase 11 (M1–M6, cerrada)

- **M1 ✓** Sin subidas/bordes remarcados fuera de cards: hover con lift+glow trasladado de `.tubo-card` a `article[data-id]:hover` (cards conservan TODO); eliminados `estado-entrada` (keyframes + retrigger en `page-states.js`), `.btn:active translateY(1px)` y el `border-color` de `.btn-ghost:hover`. Se conservan press `scale(0.97)`, glows por color en botones y `portal-entrada` del detalle.
- **M2 ✓** `crearControlPassword(input, { conMedidor=false })` — medidor solo en `register.js#password` y `account.js` «Nueva contraseña»; login/confirmar solo ojo.
- **M3 ✓** `.cabecera-fija` (sticky sobre el `<header>` completo — clave: el nav pegado dentro de un header de su misma altura no podría fijarse) + `.barra-vidrio` (`color-mix` panel 72% + blur 14px).
- **M4 ✓** `header.js` reescrito: logo «Catálogo de Personajes» (`shrink min-w-0 truncate` — fix real de overflow de 17px detectado por el test a 375px), enlaces de texto ≥768 e iconos `.btn-icono` 44px <768, dropdown `#menu-cuenta` en todos los tamaños (Mi cuenta + Cerrar sesión → modal → `logOut`), `actualizarNombre()` ahora en `aria-label`/`title`, `querySelectorAll` por `data-nav` duplicado por breakpoint, `icon-menu` eliminado del sprite y `icon-grid` añadido.
- **M5 ✓** 7 anotaciones `//` eliminadas (6 HTML + inline de `account.js`); sin restos (grep verificado).
- **M6 ✓** `character.html` imagen `md:aspect-auto` + paridad en `crearSkeletonDetalle`; hueco inferior resuelto.
- **Verificación:** `pnpm lint` (0) · `format:check` ✓ · `check:imports` (63/63) · `check:contrast` (28/28) · `build` OK · `audit:budgets` OK (CSS 8.5/20 KB · JS 55.7/60 KB) · **`pnpm test:e2e` 81/81** (suite completa, 3.7min) · smoke 10/10 rutas × 200.

### Detalle T10.3 (checklists finales, cerrada)

- **`frontend-design-direction` (9/9 ✓):** 1) primera pantalla comunica el producto (h1 «Catálogo Interdimensional» + bajada); 2) jerarquía de escaneo (grid + badges + toolbar); 3) tipografía sin solapes/desbordes (fix del logo truncable + tests de overflow 375/768/1280); 4) contraste AA en 28/28 pares y paleta multi-hue (ámbar/cian/magenta CRT); 5) iconos para acciones familiares (sprite: heart, user, sun/moon, eye, share, grid); 6) dimensiones estables (`.btn-icono` 44px fijo, `aspect-[4/3]`, skeletons con paridad — hover usa `transform`, sin layout shift); 7) assets con significado (fotos de la API + ilustraciones de estado vacío, sin relleno); 8) motion que orienta (skeletons/spinner inmediatos, reveal/lift mínimos, `prefers-reduced-motion` global); 9) convenciones del repo (layers > utilities, tokens semánticos, sin `!`, JSDoc).
- **`frontend-patterns` a11y/animación (✓):** teclado completo (skip-link, `:focus-visible`, Escape + restauración de foco en dropdown y modal, trap en modal); estados ARIA sincronizados (`aria-expanded`/`aria-controls`/`aria-pressed`/`role="alert"`/`aria-live`); animaciones de señal alta y anidadas bajo `prefers-reduced-motion`; sin patrones React (proyecto sin framework, criterio no aplicable por diseño).
- **`seo` (✓):** 1 `<h1>` por página (7/7); titles 22–40 caracteres con keyword delante; descriptions 87–145 caracteres; `robots.txt`/`sitemap.xml` en raíz; canonical autoconsistente; `noindex` solo en 404 y Mi cuenta (intencional: páginas de error/protegidas); JSON-LD `WebSite` + `Person` coherente con el contenido real; presupuestos de rendimiento para LCP/CLS.
- **Comentarios/JSDoc (✓):** cabecera de fichero en todos los módulos de `src/` y tests; JSDoc en todas las funciones públicas (incluidos los nuevos `pintarNombre`, `crearControlPassword(..., {conMedidor})` y las secciones de CSS con comentarios de sección); cero anotaciones `//` visibles (M5).
- **Hallazgos con cambios durante la revisión:** JSDoc añadido a `pintarNombre` (único hueco detectado); tests nuevos M2 (3) y M6 (1) para cerrar la evidencia de los criterios aceptados.

### Correcciones posteriores — Hallazgos de prioridad alta (2026-10-26)

- **A1 + A2 ✓** `characters-api.js` ahora propaga `error.status` desde `pedirUnaVez()`; `buscarPersonajes()` trata cualquier 404 como resultado vacío y `character.js` usa `status === 404` para el mensaje “Ese personaje no existe en la API.”. Se eliminaron las comparaciones frágiles por texto (`"nothing found"` / `"nothing here"`) también en la paginación de `catalog.js`.
- **A3 ✓** La regex de correo de `validators.js` acepta TLD de 2+ letras: `.es`, `.co`, `.io`, `.ai`, etc. ya son válidos.
- **A4 ✓** Proyecto versionado en un repositorio Git independiente dentro de `Web-Manual`; `dist/app.css` se versiona y `.opencode/` + `reportes/` quedan ignorados.
- **Tests ✓** `tests/regressions.spec.js` cubre búsqueda sin resultados, detalle 404, registro con `.es` y rechazo de correo sin TLD.
- **Verificación en esa iteración:** `pnpm lint` (0) · `format:check` ✓ · `check:imports` (63/63) · `check:contrast` (28/28) · `build` OK · `audit:budgets` OK (CSS 7.3/20 KB · JS 55.8/60 KB) · **`pnpm test:e2e` 93/93** (suite completa, 7.9 min).

### Correcciones posteriores — UX: flash de sesión y toast (2026-10-26)

- **Flash del catálogo ✓** `src/services/session-boot.js` (script clásico y bloqueante en `<head>`) valida `sessionStorage.sesion` y su `_loginAt` contra los 60 min antes de que se parsee el `<body>`; sin sesión válida hace `location.replace('./login.html')` y añade `auth-redirect` (`html.auth-redirect body { visibility: hidden; }` en `tokens.css`). Se declara con `data-auth="protected"` en `index.html`, `favorites.html`, `character.html` y `mi_account.html`; `rutaProtegida()` sigue como defensa en profundidad. Medición Playwright: sin sesión el primer `h1` visible es el del login (269 ms) y el del catálogo nunca llega al DOM; con sesión el catálogo pinta normal.
- **Toast sólido ✓** `mostrarToast()` usa `aviso toast toast-info|toast-error`: fondos opacos `--info`/`--danger` con texto `--on-info`/`--on-danger` (6.10:1 y 5.91:1 en día; 11.20:1 y 6.42:1 en CRT). Contenedor a `z-[110]`, por encima de las scanlines CRT (z-index 100). Los avisos de formulario conservan `.aviso-info`/`.aviso-error` (soft).
- **Tests ✓** `tests/regressions.spec.js` añade la no-pintura del catálogo (MutationObserver + marca en sessionStorage; validado en rojo al quitar el guard) y la opacidad del toast en ambos temas + z-index del contenedor.
- **Verificación actual:** `pnpm lint` (0) · `format:check` ✓ · `check:imports` (63/63) · `check:contrast` (28/28) · `build` OK · `audit:budgets` OK (CSS 7.4/20 KB · JS 57.1/60 KB) · **`pnpm test:e2e` 99/99** (suite completa, 5.1 min).

### Correcciones posteriores - UX de catálogo, auth y traducción (2026-10-27)

Rama `fix/ux-catalogo-auth`. Corrige los rompimientos detectados al auditar los cambios recientes del catálogo (paginación), fondos, registro y traducción de datos.

- **Traducción unificada ✓** — `services/characters-api.js` es el ÚNICO punto de traducción (`traducirPersonaje` exportado; claves `unknown`/`Unknown` ambas a "Desconocido": la API real manda minúscula). `mapearPersonaje` ya NO re-traduce (era la doble traducción que rompía badges). `BADGE_POR_ESTADO`/`PESO_ESTADO` con claves en español + valores legados en inglés (compat con favoritos viejos de localStorage).
- **Fetch crudo eliminado ✓** — el catálogo llamaba `fetch()` directo a la API (sin timeout, rate-limit, reintentos ni caché, y con query sin escapar). Lo reemplaza `obtenerPagina(pagina, filtros)`: devuelve `{info, results}` (lo que exige la paginación), usa `URLSearchParams`, conserva `error.status` (404 de negocio ⇒ lista vacía, no error) y pasa la caché al esquema **v3** (entradas `{info, results}` en vez de lista). `obtenerPersonajes`/`buscarPersonajes` eliminados.
- **Registro con errores en su campo ✓** — `register.js` ya no lanza `Error` hacia `mostrarErrores()` (rompía con TypeError); nuevo `marcarFallo({campo, mensaje})` pinta el mensaje en `#error-<campo>`, el glitch y el HUD; el catch inesperado avisa con `mostrarToast`.
- **Fondo sin `!important` ✓** — el color crítico inline de los 6 HTML pasa a `html { background-color: var(--app-bg) }` (`tokens.css`) + `body.con-lienzo { background-color: transparent }` para las páginas con canvas `z-index:-1` (los 4 `!important` inline se eliminan).
- **Paginación accesible ✓** — botones con `type="button"`, `disabled`, `aria-current="page"`, bloqueo de doble clic (`cargandoPagina`) y `aria-label` que SIEMPRE contiene el texto visible (WCAG 2.5.3: `← Anterior (página N)` / `Siguiente → (página N)`); `scrollIntoView` solo al paginar, no en la primera pintura.
- **Footer del catálogo ✓** — `montarFooter()` importado en `catalog.js` (antes el import faltaba y el footer nunca se montaba); copyright sin `opacity-60` (el contraste caía a 2.37:1 ⇒ axe `color-contrast` serious).
- **Glitch de error centralizado ✓** — `.glitch-error`/keyframes movidos de los `<style>` inline de login/register a `components.css`, dentro de `@media (prefers-reduced-motion: no-preference)`.
- **Infra ✓** — CSP de `index.html` sin `http://localhost:4173` (no es origen de producción); Playwright `reuseExistingServer: false` (un server externo con livereload introducía tests flaky).
- **Limpieza ✓** — borrado `` src/ui/catalog-background.js` `` (archivo fantasma con backtick en el nombre); trackeados `background-init.js`, `catalog-background.js`, `footer.js`, `interactive-mesh.js`; código muerto retirado: `estadoRateLimit`, `reiniciarRateLimit`, `limpiarCachePersonajes`, `agregarAlCache` + rama `acumular`, iconos `#icon-check`/`#icon-close`, vars sin usar.
- **Presupuesto JS 64 → 65 KB ✓** — se intentó bajar el peso real (fetch crudo, funciones/iconos muertos, comentarios redundantes): 65.5 → 64.9 KB gzip, sin alcanzar 64. Umbral fijado en **65 KB** con la justificación en la cabecera de `scripts/audit-budgets.mjs` (decisión del usuario).
- **Verificación actual:** `pnpm lint` (0) · `format:check` ✓ · `check:imports` (67/67) · `check:contrast` (28/28) · `build` OK · `audit:budgets` OK (CSS 7.9/20 KB · JS 64.9/65 KB) · **`pnpm test:e2e` 99/99** (suite completa, 12.1 min).

---

_Documento vivo: cualquier modificación futura se edita aquí, manteniendo la numeración de fases y tareas._
