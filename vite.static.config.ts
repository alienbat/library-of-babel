import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const base = process.env.STATIC_BASE_PATH ?? '/library-of-babel/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw new Error(
    'STATIC_BASE_PATH must be / or a slash-delimited path such as /library-of-babel/',
  );

export default defineConfig({
  root: fileURLToPath(new URL('./static', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  base,
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: fileURLToPath(new URL('./dist/github', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
  },
  worker: { format: 'es' },
});
