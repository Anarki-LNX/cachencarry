// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// A static site: every page is built ahead of time and served as plain files.
// It never talks to a Cache & Carry server, GitHub or YouTube while building.
export default defineConfig({
  site: 'https://cachencarry.loopout.tech',
  output: 'static',
  trailingSlash: 'always',
  // The CSP allows no inline script or style: everything goes to external files.
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'de',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [
    // hreflang alternates live in each page's <head>; the sitemap only lists the pages.
    sitemap({ filter: (page) => !page.endsWith('/404/') }),
  ],
  prefetch: false,
  devToolbar: { enabled: false },
});
