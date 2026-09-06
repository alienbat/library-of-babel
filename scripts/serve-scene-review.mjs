// Browser GPU regression fixture: open the printed URL and check each scene.
// Unlike Node geometry tests, this compiles the real Three.js material shaders.
import {build} from 'rolldown';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
await mkdir('work/scene-check',{recursive:true});
await build({input:'scripts/scene-review.ts',output:{file:'work/scene-check/review.js',format:'esm'}});
const html='<!doctype html><html><body style="margin:0;background:#222;color:white;font:16px sans-serif"><div id="buttons"></div><div id="status"></div><script type="module" src="review.js"></script></body></html>';
createServer(async(req,res)=>{
  if(req.url==='/review.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('work/scene-check/review.js'));}
  else{res.setHeader('Content-Type','text/html');res.end(html);}
}).listen(8765,'127.0.0.1',()=>console.log('Scene GPU check: http://127.0.0.1:8765/ — every view must report zero shader errors.'));
