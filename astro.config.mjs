// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Lightning CSS targets (major << 16 | minor << 8).
 * Without explicit targets the minifier folds `animation-timeline` into the
 * `animation` shorthand, which browsers reject – breaking every scroll-driven
 * animation in production. Listing Firefox/Safari keeps the longhand.
 */
const cssTargets = {
  chrome: 111 << 16,
  edge: 111 << 16,
  firefox: 128 << 16,
  safari: (16 << 16) | (4 << 8),
  ios_saf: (16 << 16) | (4 << 8),
};

// https://astro.build/config
export default defineConfig({
  i18n: {
    locales: ['pl', 'en'],
    defaultLocale: 'pl',
    routing: { prefixDefaultLocale: false },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  vite: {
    css: {
      transformer: 'lightningcss',
      lightningcss: { targets: cssTargets },
    },
    build: {
      cssMinify: 'lightningcss',
      // The minifier derives its Lightning CSS targets from this, not from css.lightningcss.targets.
      cssTarget: ['chrome111', 'edge111', 'firefox128', 'safari16.4', 'ios16.4'],
    },
  },
});
