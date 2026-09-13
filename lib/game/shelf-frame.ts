import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/** Bevelled Blender boards normalised to the existing instance dimensions.
 * No changes to board bounds, support heights, book transforms or capacity. */
export function createShelfFrame(urls?: { board: string; upright: string }) {
  const board = new T.BoxGeometry(),
    upright = new T.BoxGeometry();
  let disposed = false;
  const ready = Promise.all(
    (urls
      ? [
          [urls.board, board, [22.86, 0.04, 0.5]],
          [urls.upright, upright, [0.055, 3.25, 0.46]],
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
  return {
    board,
    upright,
    ready,
    dispose() {
      disposed = true;
      board.dispose();
      upright.dispose();
    },
  };
}
