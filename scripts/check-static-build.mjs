import assert from 'node:assert/strict';
import { readFile, readdir, access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('dist/github'),
  base = process.env.STATIC_BASE_PATH ?? '/library-of-babel/';
const html = await readFile(`${directory}/index.html`, 'utf8');
assert.ok(html.includes('The Library of Babel'), 'Missing page title');
assert.ok(!html.includes('/main.tsx'), 'Unbuilt source entry');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith(base), `Asset is outside deployment base: ${url}`);
  await access(resolve(directory, url.slice(base.length)));
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
