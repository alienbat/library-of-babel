# Babylon renderer prototype

An isolated, local rendering experiment on branch `prototype/babylon-renderer`.
The production game is unchanged. Nothing in this prototype reads or writes browser saves,
bookmarks, uploaded books, or hosting configuration.

## Run

```sh
cd /Users/alienbat/works/babel_library_babylon
npm ci
npm run prototype:babylon
```

Open http://127.0.0.1:8770/. The server listens only on loopback. Restart it after editing sources.

- Click the canvas for mouse look. WASD moves relative to the view, Space rises, C descends,
  Shift increases speed, and Escape releases the cursor.
- Switch between Babylon and Three.js without changing the camera.
- Presets cover shelf detail, adjacent floors, shelf transitions, both vertical horizons,
  all four corners, stair occlusion, top/bottom stair models, rooms, and origin rebasing.
- **Check visual parity** renders each preset with both engines and compares framebuffer pixels.
- **Benchmark both** measures median CPU submission and GPU timer-query duration after warmup.
  GPU timings are reported as unavailable if the browser cannot supply valid timer queries.

This is a free-flight rendering harness, not the full gameplay port: collision, falling,
book interaction, menus, audio and persistence remain in the original game. Do not use it
as a replacement for the production entry point.

## What is actually ported

Babylon.js 9.26.0 owns its WebGL2 context, shader programs, textures, vertex/instance buffers,
materials and draw calls. Three.js does not render the Babylon canvas.

For controlled comparison, the adapter consumes the existing Three.js scene builders as a
CPU-side description. This intentionally retains the Three.js dependency for this first
prototype. Its CPU adapter cost is included in the Babylon submission measurement.

The following rendering techniques are shared and translated, rather than approximated:

- Moving near-detail window; true 3D shelf distance tests and 500 m shelf relief.
- Detailed books, textured shelf impostors, batched distant gallery strips and thin instances.
- Six directional baked irradiance channels in 3D textures, including room/top-floor variants.
- Analytic, pixel-footprint-filtered infinite horizon; half-float radiance profile; no fog.
- Screen-door distance/subpixel handoff, logarithmic depth, ACES tone mapping and sRGB output.
- Boundary walls/floors/ceilings, baked boundary lighting and clipping at all four corners.
- Conservative landing/stair occlusion.
- Local origin rebasing while flying, with BigInt counters for accumulated periods/floors.
  The main game's enormous global book-coordinate system remains untouched, not duplicated here.

Babylon thin-instance attributes belong to geometry: each batch gets independent GPU geometry
so one batch cannot overwrite another's instance transforms. CPU vertex data is cached;
replaced batches, textures and materials are disposed. Both engines use matching opaque and
transparent draw ordering, identical camera matrices and framebuffer dimensions.

The standalone TypeScript project prevents Babylon's global WebGL type augmentations from
changing the original game's compilation environment.

## Measurements — 13 September 2026

Codex in-app browser on this Mac, WebGL2, 1248 × 520 framebuffer, antialiasing enabled,
identical scene/camera, 15 warmup frames and 30 measured samples per view/engine.
CPU is world update + submission, not total frame latency. GPU uses
`EXT_disjoint_timer_query_webgl2`; invalid/disjoint samples are excluded.

| View          | Three CPU ms | Babylon CPU ms | Three GPU ms | Babylon GPU ms |
| ------------- | -----------: | -------------: | -----------: | -------------: |
| Fresh arrival |         0.30 |           1.00 |        15.23 |          20.44 |
| Shelf detail  |         0.40 |           1.20 |         9.63 |          12.94 |
| Stair up      |         0.30 |           1.00 |         3.43 |           4.17 |
| Top right     |         0.30 |           0.90 |        10.07 |          10.43 |

These are one local sample, not an engine-wide ranking. They show **no performance advantage
for this adapter prototype**. Engine-native scheduling/buffer management may improve it,
but must be measured against the same parity fixture. No WebGPU or Safari validation has
been performed. Both contexts coexist for comparison, so memory usage is higher than a
single-renderer game; startup and memory are not benchmarked here.

## Validation

- `npm run check:babylon`: prototype TypeScript + scoped lint.
- `npx tsc --noEmit`: original application's separate typecheck.
- `npm test`: all 65 existing tests pass.
- `npm run build`: application build and production book-worker URL check pass.
- Browser image comparisons and shader-error counters: see `validation.md`.
- Full repository lint retains the pre-existing `unbound-method` finding in
  `tests/location-store.test.ts:13`; it also occurs on unchanged main.

Before any production migration: repeat parity checks at higher pixel densities and in
Safari/Chrome, test movement/rebuild memory over time, migrate gameplay integration, and
profile a native Babylon update path. WebGPU should be a separate comparison so backend
changes are not confused with engine changes.

## Static AO and section-occlusion experiment

The two new buttons are independent:

- **Baked room AO** defaults on. A short-range visibility volume is baked once for
  normal rooms and once for the top-floor variant. The bake uses 32 deterministic
  directions, a 0.75 m radius, and conservative bounds of the actual nearby walls,
  stair geometry and furnishings. Two 60 × 24 × 16 CPU visibility grids (about 45 KiB) are resampled
  into alternate copies of the existing irradiance textures. The comparison keeps
  about 1.4 MiB of additional RGBA texture data. AO adds no shader operations or
  texture lookups during rendering. Gentle contact darkening augments the existing
  baked irradiance. Distant-gallery shaders and the analytic horizon are untouched.
  This is approximate local ambient occlusion, not a full light-transport bake.
  No lights move, and no visibility rays or screen-space AO are evaluated per frame.
- **Occlusion** defaults off for comparison. The near geometry is grouped spatially
  by four bays, four floors and gallery side. Babylon's asynchronous query APIs test
  section bounds against the rendered depth buffer. A custom query material matches
  logarithmic depth; Babylon's stock linear-depth bounding-box material cannot be
  used unmodified. Hidden instances are compacted within the existing material
  batches, rather than multiplying draw calls for every section.

Visibility results are cached only while the camera, projection and source geometry
remain unchanged. Movement, teleport, rebasing and geometry rebuilds invalidate them;
geometry is made visible immediately while fresh results are pending. Near-camera
boxes are never culled. At most 24 section candidates are visited per frame, and
queries stop once static visibility is known. This deliberately conservative prototype
optimizes stationary views; it does not claim continuous-motion occlusion performance.
The existing analytic stair culling remains enabled throughout.

The benchmark now includes Three, Babylon, and Babylon with occlusion, with 80 warmup
frames and 30 measured samples per mode, in two passes with reversed mode order.
GPU query overhead is included in rendering measurements.
Both engines receive the same AO setting. The visual-parity test also warms each view
for 80 frames, allowing asynchronous section results to settle.

The clean two-pass rerun is recorded in [validation.md](validation.md#repeat-after-other-gpu-workloads-were-stopped).
It supersedes earlier performance numbers that may have been affected by concurrent
GPU work. Occlusion saved roughly 6% GPU time in the stationary stair view and 3%
in the bathroom; other sampled views showed little gain. Babylon still trailed
the reference renderer, so this experiment does not establish a migration speedup.
