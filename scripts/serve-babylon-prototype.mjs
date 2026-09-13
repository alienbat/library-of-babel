import { build } from 'rolldown';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
await mkdir('work/babylon-prototype', { recursive: true });
await build({
  input: 'prototype/review.ts',
  output: {
    file: 'work/babylon-prototype/review.js',
    format: 'esm',
    codeSplitting: false,
  },
});
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Babel · Babylon prototype</title><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#151b19;color:#dedbc9;font:14px system-ui}header{display:flex;gap:20px;align-items:center}header span{flex:1;color:#aaa}button{background:#29332e;border:1px solid #596353;color:inherit;padding:9px 14px;cursor:pointer;border-radius:4px}button:hover{background:#455044}nav{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}main{position:relative}canvas{display:block;width:100%;max-width:1440px}canvas[hidden]{display:none}aside{position:absolute;bottom:12px;left:12px;padding:8px;background:#111a;color:#ddd;pointer-events:none}footer{padding:12px 0}pre{white-space:pre-wrap}</style></head><body><script type="module" src="/review.js"></script></body></html>`;
createServer(async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/review.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(await readFile('work/babylon-prototype/review.js'));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    }
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
}).listen(8770, '127.0.0.1', () =>
  console.log(
    'Babylon prototype: http://127.0.0.1:8770/ (local only; live game unchanged)',
  ),
);
