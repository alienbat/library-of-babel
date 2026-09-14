import {siteUrls,seoHead,seoDescription} from './landing-seo.mjs';
import { build } from 'rolldown';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
await mkdir('work', { recursive: true });
await build({
  input: 'static/project-page.tsx',
  external: ['react', 'react/jsx-runtime'],
  platform: 'node',
  output: { file: 'work/landing-ssr.mjs', format: 'esm' },
});
const { default: App } = await import('../work/landing-ssr.mjs');
const file = 'dist/github/index.html',
  html = await readFile(file, 'utf8');
await writeFile(
  file,
  html.replace(
    '<div id="root"></div>',
    `<div id="root">${renderToString(createElement(App, { base: process.env.STATIC_BASE_PATH ?? '/library-of-babel/' }))}</div>`,
  ),
);

const urls = siteUrls(process.env.STATIC_BASE_PATH, process.env.STATIC_SITE_ORIGIN);
for (const [entry, play] of [['index.html', false], ['play/index.html', true]]) {
  const path = `dist/github/${entry}`;
  const source = await readFile(path, 'utf8');
  const {title, tags} = seoHead(urls, play);
  await writeFile(path, source.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${seoDescription}" />`)
    .replace('</head>', `${tags}\n  </head>`));
}
await writeFile('dist/github/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${urls.home}</loc></url>
  <url><loc>${urls.play}</loc></url>
</urlset>
`);
