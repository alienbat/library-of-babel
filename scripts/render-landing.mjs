import {build} from 'rolldown';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
await mkdir('work',{recursive:true});
await build({input:'static/project-page.tsx',external:['react','react/jsx-runtime'],platform:'node',output:{file:'work/landing-ssr.mjs',format:'esm'}});
const {default:App}=await import('../work/landing-ssr.mjs');
const file='dist/github/index.html',html=await readFile(file,'utf8');
await writeFile(file,html.replace('<div id="root"></div>',`<div id="root">${renderToString(createElement(App,{base:process.env.STATIC_BASE_PATH??'/library-of-babel/'}))}</div>`));
