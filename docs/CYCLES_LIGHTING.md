# Offline Cycles lighting

For the complete operating procedure and troubleshooting notes, see the
[ray-traced baking developer guide](RAYTRACE_BAKING_GUIDE.md).

The game uses light-source-driven diffuse illumination baked offline by Blender
Cycles. The world has zero background illumination. Six diffuse bounces include
visibility and reflected light; the previous room AO multiplier and hand-tuned
bounce model are not applied over these results.

## Representation and scope

The runtime samples six directional **luminance** lobes from two filtered 3D
textures per cell, retaining the game's warm output tint. This is a compact
irradiance-field approximation to path-traced lighting, not a per-surface Cycles
lightmap or full RGB color bleeding. It keeps existing materials, exact book slots,
selection, opened-book colors, meshes and LODs. The horizon derives its average
radiance from the same gallery field, so changing LOD does not switch lighting
models. No runtime rays, shadow maps, light updates or room AO bake are needed.

The bake exporter reads the actual game's instanced architecture, fixture
positions and coarse furniture geometry. Textured materials use approximate mean
diffuse reflectances for transport. Shelf facades act as occluding shelf masses;
individual bindings and fine model embellishments remain in the rendered game,
but are not individually resolved by the transport field. Fine contact shadows
are therefore softer than in a dedicated surface lightmap.

Separate fields cover the repeating gallery, ordinary rooms, top stairwell, final
ascending flight and bottom stairwell. Closed bedrooms/bathrooms reuse the ordinary
room bake. Terminal floor, ceiling and end-wall irradiance are separately baked
and packed into one RGB texture (one scalar lighting field per channel). Finite
neighboring galleries and floors provide bounce context; the bake does not trace
the astronomical full library. Increasing neighbor coverage and comparing the
result is the route to validating convergence, rather than claiming exact infinity.

## Avoiding prototype artifacts

- Existing shelf modules retain all books, end panels and crown boards. No
  per-book lightmap UV islands are exported, avoiding undersampled black faces.
- Probe patches have separate UV tiles; four texels are averaged per direction.
- Gallery probes stay at least 6 cm in front of the shelf mass; room probes stay inside their compartment. Probes are moved out of solid geometry before baking to reduce black interpolation
  at joints. Room samples cover the full storey, including stair passages.
- Identical periodic sample planes share values after baking. The top room and
  final flight share their interface samples, avoiding Monte Carlo noise seams.
- A three-tap Gaussian filters the linear irradiance before quantization, separately within each room compartment. It reduces noise without adding ambient energy or blurring through walls.
- No additional AO multiplier is applied. Visibility comes from the path tracing.

## Rebuild

Install Blender (tested with 5.2 LTS) and Python 3, then run:

```sh
npm run bake:lighting
npm test
npm run build:github
```

`BLENDER` and `PYTHON` may override executable paths. On macOS, the script detects
`/Applications/Blender.app/Contents/MacOS/Blender`. Cycles uses Metal when available
and falls back to CPU otherwise. `BAKE_SAMPLES` defaults to 2048. The exported scene
JSON under `scripts/lighting/generated/` is temporary and ignored; committed
`lib/game/baked/*.json` assets let normal builds work without Blender.

Gallery resolution is 64 × 32 × 16. Room fields are 160 × 32 × 32. Irradiance is
linear, quantized to 8 bits over [0, 4]. More samples reduce Monte Carlo noise;
more probes improve spatial detail. Neither fixes an incorrect model or can recover
features smaller than the field spacing. A future RGB field or surface lightmap
can improve color transfer and fine contacts at additional memory/shader cost.

Changes to room geometry, fixtures or transport reflectances require a fresh bake.
The checked-in metadata records Cycles samples, bounce depth, bake duration and the SHA-256 of the exported transport scene.

Gallery fixtures are 0.8 m long, centred on each of the eight 2.8575 m shelf units per bay. Room fixtures retain their 1.6 m length. Distant fixture textures and horizon luminous-area averages use the same layout constants.
