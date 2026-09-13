import {readFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const directory='dist/client/_next/static/chunks';
const engineFiles=readdirSync(directory).filter(name=>/^engine-.*\.js$/.test(name));
assert.equal(engineFiles.length,1,'Expected one production game entry point');
const source=readFileSync(`${directory}/${engineFiles[0]}`,'utf8');
// Vinext can rewrite import.meta.url to a build-machine file URL. A worker URL
// import must instead emit the served asset path, without a file-based URL base.
assert.ok(!source.includes('file:///'),'Production game must not contain build-machine file URLs');
const asset=source.match(/\/_next\/static\/book-worker-[\w-]+\.js/)?.[0];
assert.ok(asset,'Missing public book worker URL');
assert.ok(existsSync(`dist/client${asset}`),'Book worker must be included in published assets');
const bed=source.match(/\/_next\/static\/media\/bed\.[\w-]+\.glb/)?.[0];
assert.ok(bed&&existsSync(`dist/client${bed}`),'Bed model must use a published asset URL');
const bathroom=source.match(/\/_next\/static\/media\/bathroom\.[\w-]+\.glb/)?.[0];
assert.ok(bathroom&&existsSync(`dist/client${bathroom}`),'Bathroom kit must use a published asset URL');
console.log('Production worker, bed and bathroom asset URLs verified');
