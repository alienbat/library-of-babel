# Ray-traced lighting: developer handoff

This guide describes the production bake pipeline, its approximations, and how to
change and ship it. Read it together with [Cycles lighting](CYCLES_LIGHTING.md),
[development](DEVELOPMENT.md), and [GitHub Pages deployment](GITHUB_PAGES.md).
Commands below run from the repository root of the worktree being edited.

## What is baked

Blender Cycles computes direct illumination and diffuse interreflection offline.
The background is black: fixtures supply the energy. The game does not run ray
tracing, dynamic lights, shadow maps, or a second ambient-occlusion pass.

The output is **a directional luminance field**, not a conventional RGB texture
lightmap attached to every mesh. Each spatial sample has six measurements, facing
+X, +Y, +Z, -X, -Y and -Z. The runtime interpolates those measurements and weights
them by the surface normal. Existing material colors and a warm lighting tint
remain in the shader. This makes one compact bake usable by instanced geometry,
book color changes, and multiple LODs throughout the library.

Consequences worth preserving:

- Path tracing already includes occlusion along direct and bounced paths. Adding
  the historical room AO multiplier would darken those regions a second time.
- Scalar luminance does not preserve full RGB color bleeding. Fine contacts are
  also limited by probe spacing and the simplified transport geometry.
- A finite neighborhood supplies bounce context. This is not an exact solution
  for an infinite building. To assess convergence, increase that neighborhood and
  compare the central field with all other settings unchanged.
- Increasing samples reduces estimator noise, not geometry errors, light leaks,
  or detail lost to the field representation.

## File map

| File | Responsibility |
| --- | --- |
| `scripts/bake-lighting.mjs` | Runs export, Blender, then sealing in order |
| `scripts/lighting/export.ts` | Extracts transport geometry and fixtures from the game |
| `scripts/lighting/bake.py` | Builds Cycles scenes, samples, filters and encodes fields |
| `scripts/lighting/seal.py` | Shares periodic/interface planes and reuses enclosed room fields |
| `scripts/lighting/generated/*.json` | Temporary exported scenes; ignored by Git |
| `lib/game/baked/*.json` | Committed lighting deliverables |
| `lib/game/baked-light-field.ts` | Decodes fields and creates GPU textures |
| `lib/game/lighting.ts` | Samples lighting in the material shader |
| `lib/game/room-lighting.ts` | Room fixture layout and terminal variant selection |
| `lib/game/gallery-fixtures.ts` | Shared corridor fixture count, length and spacing |
| `lib/game/boundary-lighting.ts` | Packs terminal surface lighting for runtime sampling |
| `lib/game/horizon-average.ts` | Derives distant radiance from the gallery field |
| `lib/game/world.ts` | Architecture, fixture instances and LOD geometry |
| `tests/cycles-bake.test.ts` | Asset/interface and regression checks |

Do not treat `room-ao.ts` as an additional production lighting stage. Historical
code/tests can remain without applying that multiplier to the Cycles result.

## Prerequisites and normal rebuild

Use the Node version required by `package.json` (currently >=22.13), install
project dependencies, and have Blender and Python 3 available. Blender supplies
its own Python, `bpy`, and NumPy; do not run `bake.py` in ordinary Python.

```sh
npm ci
npm run bake:lighting
```

The wrapper detects `/Applications/Blender.app/Contents/MacOS/Blender` on macOS,
otherwise uses `blender` from PATH. `BLENDER` and `PYTHON` override executable
paths. `BAKE_SAMPLES` overrides the sample count:

```sh
BAKE_SAMPLES=2048 npm run bake:lighting
```

The current pipeline was exercised with Blender 5.2 LTS. It attempts Metal on
macOS and falls back to CPU. Inspect output/device availability if an apparently
identical bake takes unexpectedly long. Low CPU utilization can be normal while
the GPU is busy. Do not benchmark game performance concurrently with a bake.

The wrapper is synchronous and stops on a failed stage. For a long run, redirect
output to a log and retain the process/session identifier. Completion means a
successful exit, all expected field outputs, and successful sealing—not merely a
Blender message saying an internal image was saved.

## Explicit stages and selective rebakes

The equivalent manual pipeline is:

```sh
node --experimental-strip-types scripts/lighting/export.ts
BAKE_SAMPLES=2048 /Applications/Blender.app/Contents/MacOS/Blender \
  --background --python-exit-code 1 --python scripts/lighting/bake.py
python3 scripts/lighting/seal.py
```

For iteration, append selected field names after `--`:

```sh
BAKE_SAMPLES=2048 /Applications/Blender.app/Contents/MacOS/Blender \
  --background --python-exit-code 1 --python scripts/lighting/bake.py -- gallery
```

Export before baking. Keep geometry and bake-source edits stable during a run;
otherwise different fields can describe different source revisions. Selective
bakes require the other assets already to exist and remain compatible. Sealing
expects the complete asset set. If uncertain which fields a change affects,
rebuild all fields rather than publish a mixture.

| Field | Transport variant | Grid (X × Y × Z) |
| --- | --- | --- |
| `gallery` | normal | 64 × 32 × 16 |
| `rooms` | normal | 160 × 32 × 32 |
| `top` | top | 160 × 32 × 32 |
| `final` | top; final ascending flight below the top | 160 × 32 × 32 |
| `bottom` | bottom | 160 × 32 × 32 |
| `boundaryFloor` | bottom | 32 × 1 × 128 |
| `boundaryCeiling` | top | 32 × 1 × 128 |
| `boundaryWall` | normal | 32 × 1 × 128 |

Changes to fixtures, architecture, transport reflectance, sample placement, or
filtering invalidate affected fields. Corridor changes can influence nearby room
transport too. Top/final fields form a coupled interface. Closed bedrooms and
bathrooms are shared across terminal variants, so regenerate ordinary rooms
before sealing those variants when their lighting changes.

## Export and coordinate conventions

The exporter constructs normal, top and bottom worlds using the game's world
builder, then extracts instanced architecture, fixtures and coarse furniture.
It currently restricts instance centers to X=-46..69 m, Y=-12..16 m and
abs(Z)<=26 m. That is bounce context, not a runtime visibility limit.

Three.js coordinates transform to Blender as **(x, y, z) → (x, -z, y)**. Apply
this consistently to positions, normals and lights. Check transform orientation
and material groups when importing a new model. A reversed surface normal can
produce an apparently mysterious dark bake.

Transport uses approximate mean reflectances for textures and simplified shelf
masses/furniture. It does not asynchronously load every detailed GLB or resolve
every individual binding. A visible model change therefore does not automatically
mean the bake represents its new shape: inspect the exporter/proxy as well.

Corridor fixtures are currently 0.8 m long, one per 2.8575 m shelf subdivision
(eight per 22.86 m bay). Room fixtures remain 1.6 m long. The bake currently uses
150 W area lights per fixture. Shortening a light while preserving power changes
its brightness per unit area; increasing count changes total emitted power.
Do not assume geometry alone preserves luminous output.

Keep runtime fixture instances, gallery sampling period, distant fixture texture
repeats and horizon luminous-area averages consistent. Some sampling coordinates
are Python literals; changing the TypeScript constants alone is insufficient.

## How Cycles measurements become assets

The scene has a zero-strength world, rectangular area emitters, eight maximum
bounces and six diffuse bounces. The default is 2048 samples. Each probe has six
small white diffuse receiver patches. Receivers are excluded from shadow/diffuse/
glossy/transmission visibility so they do not become additional transport surfaces.

The DIFFUSE bake includes direct and indirect contributions, with material color
excluded. Multiplying by the game material later therefore does not apply albedo
twice. Each direction receives its own 2 × 2 UV texel tile, with zero bake margin.
The four float texels are averaged. Never dilate adjacent tiles: they may belong
to unrelated directions or positions.

Samples must be in usable free space. Gallery samples are clamped in front of the
shelf transport mass, and bedroom/bathroom samples stay inside their compartments.
Nearest-surface relocation handles residual intersections. Inspect these bounds
when architecture moves; sampling inside a solid mass can create black bands that
no increase in sample count can fix.

A separable three-tap Gaussian (weights 1:2:1) filters the field in **linear light**
before quantization. Room compartments are filtered separately so their values
are not mixed across dividing walls. This trades some fine spatial contrast for
lower noise without supplying extra ambient energy. A render-denoising checkbox
alone is not a guarantee that a texture bake was denoised.

Each field stores two base64 RGBA byte arrays. Positive RGB holds +X/+Y/+Z;
negative RGB holds -X/-Y/-Z. Alpha is 255. Values encode linear luminance over
[0,4]. Runtime decoding creates two linearly filtered `Data3DTexture`s. Boundary
surfaces are subsequently packed into channels of a 2D texture. Assets are bundled
with the application; no Blender or server-side bake is required for normal builds.

## Sealing is mandatory

After all selected bakes complete, run:

```sh
python3 scripts/lighting/seal.py
```

This stage averages gallery X endpoint planes and ordinary-room Y endpoint planes,
shares the top/final-flight interface, and copies enclosed bedroom/bathroom data
from ordinary rooms into terminal variants. Terminal bakes deliberately omit
non-stair receivers to save time; their empty cells are not valid for deployment
until this copy has happened.

Metadata records samples, bounce count, elapsed bake time, filtering and the
SHA-256 of the exported transport scene. The scene hash **does not hash the bake
script or prove all assets are fresh**. Sealing can stamp the current export hash
onto an older asset. Review source changes, logs and regenerated outputs together;
do not use the hash as the sole freshness test.

## Diagnosing artifacts

| Symptom | Inspect before increasing samples |
| --- | --- |
| Long black shelf top/base bands | Probe positions inside the shelf proxy; interpolation near solid surfaces |
| Black wall/ceiling seams | Compartment bounds, probe relocation, normals, actual gaps/overlap |
| Speckling across otherwise smooth surfaces | Sample count, linear filtering, source energy and variance |
| Missing books or crown geometry | Actual mesh/LOD/export; samples cannot create missing geometry |
| Black tiny faces in a surface-lightmap experiment | UV area, padding and texel coverage; production avoids per-book UV islands |
| Brightness jump at a repeat | Sampling period and shared endpoint planes; run sealing |
| Top stairwell seam/floating light | Correct terminal geometry, fixture height and top/final variant mapping |
| Brightness jump at LOD transition | Same field/tint, material mean colors, distant fixture coverage |
| Flat clipped highlights | Values above the encoding range; inspect before raising emitter power |
| Unexpected light through walls | Coarse field interpolation, compartment filtering, transport proxy gaps |

More samples generally improve Monte Carlo error proportional to the square root
of sample count: four times the work roughly halves that component of noise.
More probes improve spatial resolution but cost bake time, asset size and GPU
memory. Neither substitutes for correct sample placement. Do not hide a faulty
bake by reintroducing uniform ambient light or multiplying another AO layer.

## Validation and preview

```sh
npm test
npx tsc --noEmit
npm run lint
git diff --check
npm run build
npm run build:github
```

Run the static build **last** because the normal build also writes `dist`.
If repository-wide lint has unrelated baseline failures, identify them explicitly
and check changed files separately; do not describe a failing run as passing.

For the complete static game:

```sh
npx vite preview --config vite.static.config.ts \
  --host 127.0.0.1 --port 8774 --strictPort
```

Open `http://127.0.0.1:8774/library-of-babel/`. An existing preview process can serve
an old build; rebuild assets and reload the browser before comparing.

For fixed diagnostic viewpoints:

```sh
SCENE_PORT=8803 npm run test:scene
```

Open `http://127.0.0.1:8803/`. This harness bundles its review entry when started.
Restart it after code/asset changes, or rebuild its bundle explicitly:

```sh
node -e "import('rolldown').then(r=>r.build({input:'scripts/scene-review.ts',output:{file:'work/scene-check/review.js',format:'esm'}}))"
```

Inspect nearby shelf ends and crown, the high/mid transition, both galleries,
bedroom, bathroom, ordinary stairs, top stairs/final flight, bottom stairs and
terminal boundaries. Check fresh-load chasm horizons as well as teleporting away
and back. Compare Low and High detail. Zero shader errors is necessary but does
not establish visual correctness. Save comparable screenshots at fixed viewpoints.

On the development machine, 2048-sample gallery and ordinary-room bakes took about
116 s and 731 s respectively in one run. These are observations, not time budgets;
GPU load, device, geometry and sample count affect them substantially.

## Commit and deploy

Follow `AGENTS.md`: feature branch, verified changes, PR targeting main, then user
approval before squash merge. Commit the source changes, regenerated
`lib/game/baked/*.json`, tests and documentation together. Temporary exported scene
JSON, logs, `work/`, `dist/`, dependencies and Python caches are not deliverables.
Do not merge a prototype or publish unfinished bakes merely to get a preview.

GitHub Pages serves a static build at:
https://alienbat.github.io/library-of-babel/

After the approved change reaches main, the Pages workflow builds/deploys it.
For manual deployment, the repository provides:

```sh
npm run deploy:github -- --check
npm run deploy:github
```

This requires authenticated `gh` with suitable repository/Actions permissions
(and Pages administration permission for initial setup). The script deploys the
**committed remote main branch, not the current local checkout**, identifies its
workflow run, and waits for success. Use local preview for unmerged changes.

Before handing work to another agent, report the exact worktree/branch, whether
bakes are still running (PID/session/log), fields completed, whether sealing ran,
which preview was rebuilt, validation results and PR status. A running bake and a
stale preview are especially easy to mistake for a completed deployment.

## Unlit boundary surfaces

The inter-gallery floor, ceiling and end walls have no fixtures, including no
procedural emissive lenses in the horizon shader. Their fields contain corridor
illumination and bounce only. Floor/ceiling X repeats every 2.8575 m; end-wall Y
repeats every 3.96 m, with several neighboring storeys present in the transport
scene. The wall exporter excludes geometry and lights behind the end wall.

Boundary sampling uses cell centers on the periodic axis, with wrapped Gaussian
filtering there. Across the half-width, floor/ceiling samples include center and gallery edge;
wall samples extend to the gallery back wall (with 6 cm clearance). There are
128 transverse samples so corridor lighting is resolved independently.
the runtime mirrors with abs(Z) and clamps this texture axis. It must not repeat
across the chasm or interpolate the gallery edge with the center. Endpoint planes
on the periodic axis are different cell centers, not duplicate endpoints: do not
force them equal in seal.py.

This remains a repeated interior end-wall approximation: the wall field does not
resolve the loss of neighboring floors immediately beside a terminal ceiling or
floor. Floor and ceiling fields themselves use the corresponding terminal scene.
Exact corner interreflection would require additional terminal wall fields.
