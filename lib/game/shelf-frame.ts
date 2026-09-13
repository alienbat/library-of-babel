import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/** Bevelled Blender boards normalised to the existing instance dimensions.
 * No changes to board bounds, support heights, book transforms or capacity. */
export function createShelfFrame(urls?: { board: string; upright: string; module?:string; start?:string; book?:string },book?:T.BufferGeometry) {
  const board = new T.BoxGeometry(),
    upright = new T.BoxGeometry();
  function fallback(start:number){
    const parts:T.BufferGeometry[]=[];
    for(let row=0;row<8;row++)parts.push(new T.BoxGeometry(22.86,.04,.5).translate(0,.11+row*.39-1.63,0));
    for(let j=start;j<8;j++)parts.push(new T.BoxGeometry(.055,3.25,.5).translate(j*22.86/8-22.86/2,0,0));
    const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());g.scale(1/22.86,1/3.25,1/.5);return g;
  }
  const moduleGeometry=fallback(0),start=fallback(1);
  let disposed = false;
  const ready = Promise.all(
    (urls
      ? [
          [urls.board, board, [22.86, 0.04, 0.5]],
          [urls.upright, upright, [0.055, 3.25, 0.5]],
          ...(urls.module?[[urls.module,moduleGeometry,[22.86,3.25,.5]]]:[]),
          ...(urls.start?[[urls.start,start,[22.86,3.25,.5]]]:[]),
        ]
      : []
    ).map(async ([url, target, size]) => {
      const gltf = await new GLTFLoader().loadAsync(url as string);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        if (!disposed) {
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld),
            [w, h, d] = size as number[];
          g.scale(1 / w, 1 / h, 1 / d);
          (target as T.BufferGeometry).dispose();
          (target as T.BufferGeometry).copy(g);
          g.dispose();
        }
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      });
    }),
  ).catch((error) => {
    if (!disposed)
      console.warn(
        'Shelf frame asset unavailable; keeping the original boards.',
        error,
      );
  });
  const bookReady=urls?.book&&book?new GLTFLoader().loadAsync(urls.book).then(gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const pieces:{g:T.BufferGeometry;pages:boolean}[]=[];
    gltf.scene.traverse(o=>{if(o instanceof T.Mesh){
      const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.scale(1/.037,1/.34,1/.3);
      pieces.push({g,pages:(o.material as T.Material).name==='Pages'});
      o.geometry.dispose();const source=o.material as T.MeshStandardMaterial;source.map?.dispose();source.dispose();
    }});
    pieces.sort((a,b)=>Number(a.pages)-Number(b.pages));
    const g=mergeGeometries(pieces.map(p=>p.g),true)!;
    if(!disposed){book.dispose();book.copy(g);}g.dispose();pieces.forEach(p=>p.g.dispose());
  }).catch(error=>console.warn('Book mesh unavailable; retaining box fallback.',error)):Promise.resolve();
  return {
    module:moduleGeometry,start,
    board,
    upright,
    ready:Promise.all([ready,bookReady]),
    dispose() {
      disposed = true;
      board.dispose();
      upright.dispose();moduleGeometry.dispose();start.dispose();
    },
  };
}
