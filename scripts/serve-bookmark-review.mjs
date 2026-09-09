import {build} from 'rolldown';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
await mkdir('work/bookmark-check',{recursive:true});
await build({input:{review:'scripts/bookmark-review.tsx','book-worker':'lib/game/book-worker.ts'},transform:{define:{'process.env.NODE_ENV':'"production"'}},output:{dir:'work/bookmark-check',format:'esm',entryFileNames:'[name].js'}});
const html='<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#202b24;color:#eeeadd;padding:20px"><div id="root"></div><script type="module" src="/review.js"></script></body></html>';
createServer(async(req,res)=>{
 try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
 else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('app/globals.css'));}
 else if(/^\/[\w.-]+\.js$/.test(req.url)){res.setHeader('Content-Type','text/javascript');res.end(await readFile('work/bookmark-check'+req.url));}
 else{res.statusCode=404;res.end();}}
 catch{res.statusCode=404;res.end();}
}).listen(8766,'127.0.0.1',()=>console.log('Bookmark integration review: http://127.0.0.1:8766/'));
