/**
 * Configuración de ESLint 10 (flat config) — Web-Manual.
 * Objetivo: reglas de calidad para JS vanilla de navegador con módulos ES.
 * Se ejecuta con `pnpm lint`.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  // Artefactos generados y dependencias fuera del análisis
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'reports/**',
      'reportes/**',
      'playwright-report/**',
      'test-results/**',
      'public/**', // artefacto de despliegue (copia de src/ — lo genera prepare-deploy.mjs)
    ],
  },

  // Reglas recomendadas de ESLint como base
  js.configs.recommended,

  {
    // Aplicado a todos los módulos JS del proyecto (HTML usa JS externo, no inline)
    files: ['**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Variables sin usar: error (evita restos de refactorizaciones), prefijo _ para ignorar
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Comentarios duplicados / código muerto
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      // Equivalencia defensiva con null/undefined
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Preferir const salvo reasignación (no forzar: el código legado usa let con propósito)
      'prefer-const': 'warn',
      // console: permitido solo en scripts/ (dev server), avisado en navegador
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Scripts de Node (dev server, checks): console libre para salida de terminal
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
