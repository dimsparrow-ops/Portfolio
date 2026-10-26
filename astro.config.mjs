import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // the CSS minifier merges backdrop-filter with its -webkit- twin and drops one; keep CSS unminified (it's tiny)
  vite: { build: { cssMinify: false } },
});
