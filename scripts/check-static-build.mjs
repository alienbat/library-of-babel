import assert from 'node:assert/strict';
import { readFile, readdir, access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('dist/github'),
  base = process.env.STATIC_BASE_PATH ?? '/library-of-babel/';
for(const entry of ['index.html','play/index.html']){
const html = await readFile(`${directory}/${entry}`, 'utf8');
assert.ok(html.includes('The Library of Babel'), 'Missing page title');
assert.ok(!html.includes('/main.tsx'), 'Unbuilt source entry');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(url.startsWith('https://')||url.startsWith('#'))continue;
  assert.ok(url.startsWith(base), `Asset is outside deployment base: ${url}`);
  await access(resolve(directory, url.slice(base.length)));
}
}
const files = await readdir(`${directory}/assets`);
const worker = files.find((name) => /^book-worker-.*\.js$/.test(name));
assert.ok(worker, 'Book worker must be emitted as a static asset');
const bed = files.find((name) => /^bed-.*\.glb$/.test(name));
assert.ok(bed, 'Blender bed must be emitted as a static asset');
const bathroom=files.find(name=>/^bathroom-.*\.glb$/.test(name));
assert.ok(bathroom,'Bathroom kit must be emitted');
let bathroomReferenced=false;
let bedReferenced = false;
let workerReferenced = false;
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const source = await readFile(`${directory}/assets/${file}`, 'utf8');
  assert.ok(
    !source.includes('file:///'),
    'Build contains a local filesystem URL',
  );
  assert.ok(
    !source.includes('/_next/'),
    'Static build depends on server framework assets',
  );
  if (source.includes(`${base}assets/${worker}`)) workerReferenced = true;
  if (source.includes(`${base}assets/${bed}`)) bedReferenced = true;
  if (source.includes(`${base}assets/${bathroom}`)) bathroomReferenced = true;
}
assert.ok(workerReferenced, 'Worker URL must include the deployment base');
assert.ok(bedReferenced, 'Bed URL must include the deployment base');
assert.ok(bathroomReferenced,'Bathroom URL must include deployment base');
for (const file of ['LICENSE.txt', 'NOTICE.txt', 'source.tar.gz'])
  await access(`${directory}/third-party/gmp-wasm/${file}`);
await writeFile(`${directory}/.nojekyll`, '');
console.log(
  `Static entry, asset paths, module worker and third-party notices verified at ${base}`,
);

const scripts=await Promise.all(files.filter(f=>f.endsWith('.js')).map(f=>readFile(`${directory}/assets/${f}`,'utf8')));
for(const name of ['ShelfBoard','ShelfUpright','ShelfModule','ShelfModuleStart','ShelfBook','Return','BBQ','ceiling-light']){
  const file=files.find(f=>f.startsWith(name+'-')&&f.endsWith('.glb'));
  assert.ok(file&&scripts.some(s=>s.includes(`${base}assets/${file}`)),`${name} must be emitted and use the deployment base`);
}

// Landing must remain independently loadable, without the game's large bundle.
const manifest=JSON.parse(await readFile(`${directory}/.vite/manifest.json`,'utf8'));
const landing=Object.values(manifest).find(entry=>entry.isEntry&&entry.src==='index.html');
assert.ok(landing,'Landing entry missing');
const visited=new Set();let landingBytes=0;
async function checkLanding(entry){
 if(visited.has(entry.file))return;visited.add(entry.file);
 const content=await readFile(`${directory}/${entry.file}`,'utf8');landingBytes+=Buffer.byteLength(content);
 assert.ok(!content.includes('WebGLRenderer')&&!content.includes('.glb'),'Landing imports game code/assets');
 for(const key of entry.imports??[])await checkLanding(manifest[key]);
}
await checkLanding(landing);
assert.ok(landingBytes<500000,'Landing JavaScript exceeds its lightweight budget');
assert.ok((await readFile(`${directory}/index.html`,'utf8')).includes('Every possibility.'),'Landing content must be prerendered');

// SEO is present in static HTML, before JavaScript executes.
const {siteUrls,seoTitle,seoDescription}=await import('./landing-seo.mjs');
const urls=siteUrls(base,process.env.STATIC_SITE_ORIGIN);
for(const [entry,url] of [['index.html',urls.home],['play/index.html',urls.play]]){
 const html=await readFile(`${directory}/${entry}`,'utf8');
 assert.equal([...html.matchAll(/rel="canonical"/g)].length,1,'Exactly one canonical per page');
 assert.ok(html.includes(`rel="canonical" href="${url}"`),'Canonical must match published location');
 assert.ok(html.includes(`property="og:url" content="${url}"`),'Social URL must match canonical');
 assert.ok(html.includes(`property="og:image" content="${urls.image}"`),'Social image must be absolute');
 assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
 assert.ok(html.includes(`name="description" content="${seoDescription}"`));
}
const html=await readFile(`${directory}/index.html`,'utf8');
assert.ok(html.includes(`<title>${seoTitle}</title>`));
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
assert.equal(schema['@graph'][0].url,urls.home);
assert.equal(schema['@graph'][1].url,urls.play);
assert.ok(schema['@graph'][1].isAccessibleForFree);
const sitemap=await readFile(`${directory}/sitemap.xml`,'utf8');
assert.ok(sitemap.includes(`<loc>${urls.home}</loc>`)&&sitemap.includes(`<loc>${urls.play}</loc>`));
await access(`${directory}/social-preview.jpg`);
console.log('Canonical URLs, social metadata, structured data and sitemap verified');
