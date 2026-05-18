#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// inject-pwa-meta.mjs — post-process dist/index.html après `expo export`
//
// Expo Router en mode SPA n'utilise pas le template +html.tsx. On injecte
// donc nous-même les meta-tags PWA + le manifest dans le <head>.
//
// Lancé par vercel.json après `npx expo export --platform web`.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const INDEX = join(DIST, 'index.html');

if (!existsSync(INDEX)) {
  console.error(`[inject-pwa-meta] dist/index.html introuvable (${INDEX})`);
  process.exit(1);
}

// ── 1. Copier les assets PWA dans dist/ ───────────────────────────────────
const PUBLIC = join(ROOT, 'public');
for (const file of ['manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const src = join(PUBLIC, file);
  const dst = join(DIST, file);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`[inject-pwa-meta] copied ${file}`);
  }
}

// ── 2. Injecter les meta tags PWA dans le <head> ──────────────────────────
let html = readFileSync(INDEX, 'utf8');

// Remplace le viewport par défaut par un viewport PWA strict
html = html.replace(
  /<meta\s+name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />',
);

// Injecte les tags PWA juste avant </head>
const PWA_TAGS = `
    <!-- PWA iOS / Android -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Equishow" />
    <meta name="application-name" content="Equishow" />
    <meta name="theme-color" content="#F97316" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="manifest" href="/manifest.json" />
    <style id="pwa-css">
      html, body {
        overscroll-behavior: none;
        -webkit-overflow-scrolling: touch;
        touch-action: manipulation;
        -webkit-text-size-adjust: 100%;
        -webkit-tap-highlight-color: transparent;
      }
      *, *::before, *::after {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text;
        user-select: text;
      }
    </style>
  </head>`;

html = html.replace(/<\/head>/i, PWA_TAGS);

writeFileSync(INDEX, html);
console.log('[inject-pwa-meta] dist/index.html patché ✓');
