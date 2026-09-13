import * as T from 'three';
import { BabylonBridge } from './babylon-bridge.ts';
import { createWorld } from '../lib/game/world.ts';
import {
  HEIGHT,
  OUTER,
  PERIOD,
  type WorldLimits,
} from '../lib/game/physics.ts';
const root = document.body;
root.innerHTML = `<header><strong>Babel · Babylon prototype</strong><span>Isolated renderer comparison · WebGL2</span><button id="engine">Switch to Three.js</button><button id="compare">Check visual parity</button><button id="bench">Benchmark both</button></header><nav id="views"></nav><main><canvas id="three"></canvas><canvas id="babylon"></canvas><aside>Click view to look around · WASD move · Space rise · C descend · Shift faster · Esc releases cursor</aside></main><footer id="status">Building shared scene…</footer><pre id="results"></pre>`;
const tc = document.querySelector<HTMLCanvasElement>('#three')!,
  bc = document.querySelector<HTMLCanvasElement>('#babylon')!;
const renderer = new T.WebGLRenderer({
  canvas: tc,
  antialias: true,
  logarithmicDepthBuffer: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
let threeErrors = 0;
renderer.debug.onShaderError = () => threeErrors++;
const scene = new T.Scene();
scene.background = new T.Color('#202825');
const camera = new T.PerspectiveCamera(65, 1100 / 720, 0.1, 16000);
const world = createWorld(scene);
const bridge = new BabylonBridge(bc, renderer);
type View = { p: number[]; at: number[]; limits?: WorldLimits };
const views: Record<string, View> = {
  'Fresh arrival': { p: [30, 5.64, 0], at: [130, 5.64, 0] },
  'Shelf detail': { p: [31, 1.68, OUTER - 1.4], at: [30, 1.5, OUTER] },
  'Adjacent floor': { p: [35, 4.1, OUTER - 1.5], at: [38, 5.4, OUTER] },
  'Shelf transition': {
    p: [84, 1.68, OUTER - 1.6],
    at: [100, 1.68, OUTER - 0.23],
  },
  'Chasm up': { p: [30, 1.68, 0], at: [30, 100, 0] },
  'Chasm down': { p: [30, 1.68, 0], at: [30, -100, 0] },
  'Bottom left': {
    p: [25, 1.68, 0],
    at: [20, 100, 0],
    limits: { minX: 0, minY: 0 },
  },
  'Bottom right': {
    p: [-25, 1.68, 0],
    at: [-20, 100, 0],
    limits: { maxX: 0, minY: 0 },
  },
  'Top left': {
    p: [25, 1.68, 0],
    at: [20, -100, 0],
    limits: { minX: 0, maxY: HEIGHT - 0.34 },
  },
  'Top right': {
    p: [-25, 1.68, 0],
    at: [-20, -100, 0],
    limits: { maxX: 0, maxY: HEIGHT - 0.34 },
  },
  'Stair up': { p: [2.5, 1.68, OUTER + 0.6], at: [2.5, 12, OUTER + 0.8] },
  'Rebased arrival': {
    p: [PERIOD * 10 + 30, HEIGHT * 300 + 5.64, 0],
    at: [PERIOD * 10 + 130, HEIGHT * 300 + 5.64, 0],
  },
  'Bottom stair': {
    p: [2.5, 1.68, OUTER + 0.6],
    at: [2.5, 12, OUTER + 0.8],
    limits: { minY: 0 },
  },
  'Top stair': {
    p: [13.5, 1.68, OUTER + 0.6],
    at: [13.5, 12, OUTER + 0.8],
    limits: { maxY: HEIGHT - 0.34 },
  },
  Bedroom: { p: [19, 1.68, OUTER + 2.6], at: [20.5, 1.2, OUTER + 4.5] },
  Bathroom: { p: [23, 1.68, OUTER + 2.7], at: [27, 1.6, OUTER + 3.4] },
};
let engine: 'Babylon' | 'Three' = 'Babylon',
  viewName = '',
  busy = false;
let originPeriods = 0n,
  originLevels = 0n;
function rebase() {
  const sx =
      Math.abs(camera.position.x) > PERIOD * 8
        ? Math.trunc(camera.position.x / PERIOD) * PERIOD
        : 0,
    sy =
      Math.abs(camera.position.y) > HEIGHT * 256
        ? Math.trunc(camera.position.y / HEIGHT) * HEIGHT
        : 0;
  if (!sx && !sy) return;
  camera.position.x -= sx;
  camera.position.y -= sy;
  originPeriods += BigInt(Math.round(sx / PERIOD));
  originLevels += BigInt(Math.round(sy / HEIGHT));
  const l = { ...bridge.limits };
  if (l.minX !== undefined) l.minX -= sx;
  if (l.maxX !== undefined) l.maxX -= sx;
  if (l.minY !== undefined) l.minY -= sy;
  if (l.maxY !== undefined) l.maxY -= sy;
  bridge.limits = l;
  world.setLimits(l);
  for (const plane of renderer.clippingPlanes)
    plane.constant += plane.normal.x * sx + plane.normal.y * sy;
  camera.updateMatrixWorld(true);
}
const status = document.querySelector('#status')!,
  results = document.querySelector('#results')!;
function switchEngine(next: typeof engine) {
  engine = next;
  tc.hidden = engine !== 'Three';
  bc.hidden = engine !== 'Babylon';
  document.querySelector('#engine')!.textContent =
    `Switch to ${engine === 'Three' ? 'Babylon' : 'Three.js'}`;
}
document.querySelector('#engine')!.addEventListener('click', () => {
  if (!busy) switchEngine(engine === 'Three' ? 'Babylon' : 'Three');
});
function view(name: string) {
  originPeriods = 0n;
  originLevels = 0n;
  viewName = name;
  const v = views[name];
  camera.position.fromArray(v.p);
  camera.lookAt(new T.Vector3().fromArray(v.at));
  camera.updateMatrixWorld(true);
  const limits = v.limits ?? {};
  world.setLimits(limits);
  bridge.limits = limits;
  renderer.clippingPlanes = [];
  if (limits.minX !== undefined)
    renderer.clippingPlanes.push(
      new T.Plane(new T.Vector3(1, 0, 0), -limits.minX),
    );
  if (limits.maxX !== undefined)
    renderer.clippingPlanes.push(
      new T.Plane(new T.Vector3(-1, 0, 0), limits.maxX),
    );
  if (limits.minY !== undefined)
    renderer.clippingPlanes.push(
      new T.Plane(new T.Vector3(0, 1, 0), -limits.minY + 0.36),
    );
  if (limits.maxY !== undefined)
    renderer.clippingPlanes.push(
      new T.Plane(new T.Vector3(0, -1, 0), limits.maxY + 0.36),
    );
}
for (const name of Object.keys(views)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => {
    if (!busy) view(name);
  };
  document.querySelector('#views')!.appendChild(b);
}
function resize() {
  const width = Math.min(1440, innerWidth - 32),
    height = Math.min(850, Math.max(400, innerHeight - 200));
  renderer.setSize(width, height, false);
  bridge.engine.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
view('Fresh arrival');
switchEngine('Babylon');
const keys = new Set<string>();
addEventListener('keydown', (e) => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC'].includes(e.code))
    e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
for (const canvas of [tc, bc])
  canvas.onclick = () => canvas.requestPointerLock();
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement || busy) return;
  const angle = new T.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  angle.y -= e.movementX * 0.002;
  angle.x = T.MathUtils.clamp(
    angle.x - e.movementY * 0.002,
    -Math.PI / 2 + 0.001,
    Math.PI / 2 - 0.001,
  );
  camera.quaternion.setFromEuler(angle);
});
let previous = performance.now(),
  frame = 0;
function draw() {
  rebase();
  world.update(camera.position.x, camera.position.y, camera);
  if (engine === 'Babylon') bridge.render(scene, camera);
  else renderer.render(scene, camera);
}
function tick(now: number) {
  requestAnimationFrame(tick);
  if (busy) return;
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (document.pointerLockElement) {
    const v = new T.Vector3(
      Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
      0,
      Number(keys.has('KeyS')) - Number(keys.has('KeyW')),
    ).applyQuaternion(camera.quaternion);
    v.y += Number(keys.has('Space')) - Number(keys.has('KeyC'));
    camera.position.addScaledVector(v, (keys.has('ShiftLeft') ? 35 : 4.8) * dt);
    camera.updateMatrixWorld(true);
  }
  const start = performance.now();
  draw();
  if (frame++ % 20 === 0)
    status.textContent = `${engine} · ${viewName} · ${tc.width} × ${tc.height} · submit ${(performance.now() - start).toFixed(1)} ms · ${engine === 'Babylon' ? bridge.draws : renderer.info.render.calls} draws · ${(engine === 'Babylon' ? bridge.triangles : renderer.info.render.triangles).toLocaleString()} triangles · shader errors ${bridge.errors.length + threeErrors} · origin ${originPeriods} periods / ${originLevels} floors`;
}
requestAnimationFrame(tick);
const raf = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function benchmark() {
  if (busy) return;
  busy = true;
  const report = [];
  const saved = engine;
  try {
    for (const name of [
      'Fresh arrival',
      'Shelf detail',
      'Stair up',
      'Top right',
    ]) {
      view(name);
      for (const next of ['Three', 'Babylon'] as const) {
        switchEngine(next);
        status.textContent = `Benchmarking ${name} · ${next}…`;
        for (let i = 0; i < 15; i++) {
          draw();
          await raf();
        }
        const gl = (
          next === 'Three' ? renderer.getContext() : bridge.engine._gl
        ) as WebGL2RenderingContext;
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        const cpu: number[] = [],
          gpu: number[] = [];
        for (let i = 0; i < 30; i++) {
          const query = ext
            ? (gl as WebGL2RenderingContext).createQuery()
            : null;
          if (query)
            (gl as WebGL2RenderingContext).beginQuery(
              ext.TIME_ELAPSED_EXT,
              query,
            );
          const t = performance.now();
          draw();
          cpu.push(performance.now() - t);
          if (query) {
            (gl as WebGL2RenderingContext).endQuery(ext.TIME_ELAPSED_EXT);
            let waited = 0;
            while (
              !(gl as WebGL2RenderingContext).getQueryParameter(
                query,
                gl.QUERY_RESULT_AVAILABLE,
              ) &&
              waited++ < 120
            )
              await raf();
            if (
              !gl.getParameter(ext.GPU_DISJOINT_EXT) &&
              (gl as WebGL2RenderingContext).getQueryParameter(
                query,
                gl.QUERY_RESULT_AVAILABLE,
              )
            )
              gpu.push(
                (gl as WebGL2RenderingContext).getQueryParameter(
                  query,
                  gl.QUERY_RESULT,
                ) / 1e6,
              );
            (gl as WebGL2RenderingContext).deleteQuery(query);
          }
          await raf();
        }
        const median = (a: number[]) =>
          a.length
            ? a.sort((a, b) => a - b)[Math.floor(a.length / 2)].toFixed(2)
            : 'unavailable';
        report.push(
          `${name} | ${next} | CPU submit ${median(cpu)} ms | GPU ${median(gpu)} ms`,
        );
        results.textContent = report.join('\n');
      }
    }
  } finally {
    switchEngine(saved);
    busy = false;
    previous = performance.now();
  }
}
document.querySelector('#bench')!.addEventListener('click', benchmark);

async function compare() {
  if (busy) return;
  busy = true;
  const saved = engine,
    report: string[] = [];
  try {
    for (const name of Object.keys(views)) {
      view(name);
      const images: Uint8Array[] = [];
      for (const next of ['Three', 'Babylon'] as const) {
        switchEngine(next);
        status.textContent = `Comparing ${name} · ${next}…`;
        for (let i = 0; i < 5; i++) {
          draw();
          await raf();
        }
        const gl = (
          next === 'Three' ? renderer.getContext() : bridge.engine._gl
        ) as WebGL2RenderingContext;
        const pixels = new Uint8Array(tc.width * tc.height * 4);
        gl.readPixels(
          0,
          0,
          tc.width,
          tc.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        images.push(pixels);
      }
      let total = 0,
        different = 0,
        maximum = 0;
      for (let i = 0; i < images[0].length; i += 4) {
        let max = 0;
        for (let c = 0; c < 3; c++) {
          const delta = Math.abs(images[0][i + c] - images[1][i + c]);
          total += delta;
          max = Math.max(max, delta);
          maximum = Math.max(maximum, delta);
        }
        if (max > 8) different++;
      }
      report.push(
        `${name}: mean channel difference ${(total / (tc.width * tc.height * 3)).toFixed(3)}/255; maximum ${maximum}; pixels differing >8: ${((different / (tc.width * tc.height)) * 100).toFixed(2)}%`,
      );
      results.textContent = report.join('\n');
    }
    report.push(
      `Shader errors: Three ${threeErrors}; Babylon ${bridge.errors.length}`,
    );
    results.textContent = report.join('\n');
  } finally {
    switchEngine(saved);
    busy = false;
    previous = performance.now();
  }
}
document.querySelector('#compare')!.addEventListener('click', compare);
