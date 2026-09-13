import {build} from 'rolldown';
await build({input:'scripts/raytrace-preview.ts',output:{file:'public/raytrace-prototype/preview.js',format:'esm',minify:true}});
