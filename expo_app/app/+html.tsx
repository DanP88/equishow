// ─────────────────────────────────────────────────────────────────────────────
// app/+html.tsx — Template HTML personnalisé (Expo Router)
//
// PWA iOS / Android :
//   - viewport-fit=cover : prise en compte du notch / dynamic island
//   - user-scalable=no, maximum-scale=1 : désactive le pinch-zoom
//   - apple-mobile-web-app-capable : mode standalone quand ajouté à l'écran
//   - status-bar-style=default : la barre iOS reste visible, contenu en dessous
//   - theme-color : couleur de la barre URL Chrome Android
//   - overscroll-behavior=none : pas de rubber-band scroll
//   - touch-action=manipulation : pas de double-tap zoom
//   - safe-area-inset via env() pour respecter les bords de l'écran
// ─────────────────────────────────────────────────────────────────────────────

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Viewport mobile : pas de zoom, gestion du notch */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA iOS — mode standalone quand ajouté à l'écran d'accueil */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Equishow" />
        <meta name="application-name" content="Equishow" />

        {/* Theme color (URL bar Chrome Android + status bar PWA) */}
        <meta name="theme-color" content="#F97316" />

        {/* Icônes Apple Touch (utilisées par iOS lors de l'ajout à l'écran) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        <title>Equishow</title>

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: extraCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const extraCss = `
  /* Bloquer pinch-zoom + double-tap-zoom + bounce iOS */
  html, body {
    height: 100%;
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
    touch-action: manipulation;
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
  }
  body {
    margin: 0;
    overflow: hidden;
    background: #F8F7F4;
    /* Safe-area gérée par SafeAreaProvider + useSafeAreaInsets côté React (pas en CSS body)
       pour éviter la double application (body padding + insets dans les barres). */
  }
  #root {
    display: flex;
    flex: 1;
    height: 100%;
  }
  /* Empêcher la sélection de texte accidentelle au scroll/tap */
  *, *::before, *::after {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  /* Sauf dans les inputs / zones éditables */
  input, textarea, [contenteditable="true"] {
    -webkit-user-select: text;
    user-select: text;
  }
`;
