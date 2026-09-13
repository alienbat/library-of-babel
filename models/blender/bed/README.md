# Scandinavian-style bed

An original, clean, stylized furniture design inspired by simple Scandinavian
flat-pack furniture. It does not reproduce a particular IKEA product or use its
branding or assets.

- `bed.blend`: editable source with 28 separate bed objects, packed textures and
  a separate preview studio collection.
- `bed-preview.png`: CPU Cycles preview.
- `bed.glb`: portable export, combined into five material batches; studio lights,
  ground and camera excluded. Approximately 568 KiB and 9,852 triangles.
- `create_bed.py`: reproducible geometry, textures, render and export.

The frame keeps the current game's **1.00 × 1.80 m** footprint. Overall height is
0.985 m, including the new headboard. Blender uses metres, Z up, with the head
at +Y; the glTF export uses Y up with the head at -Z. The origin is at floor
height in the middle of the footprint.

The light wood frame has rounded edges, a slatted headboard and mattress supports.
Bedding has a rounded mattress with piping, a domed pillow with a sewn perimeter,
and a sage duvet with broad folds, hanging sides and a turned-back top edge.
Original 256 × 256 procedural albedo images provide restrained wood grain and
fabric weave. All images are packed into the source and embedded in the export.
There are no external texture dependencies.

Regenerate from the repository root (overwrites these outputs):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/bed/create_bed.py
```

Validated by rendering and inspecting the preview, reopening the source in a
fresh Blender process, checking footprint and packed textures, and reimporting
the GLB to check its five mesh batches and exclusion of studio objects.

The game loads this GLB through Vite's asset pipeline. `lib/game/beds.ts` shares
its five mesh/material batches across beds within 14 m of the camera, including
adjacent floors. Three coarse instanced batches provide the distant version and
a fallback during loading or asset failure. World-window translation and boundary
rebuilds update both versions. Textures and geometry are disposed with the world.

Studio preview lighting is not baked into the export: runtime materials use the
existing static room irradiance/AO. Mattress and headboard bounds contribute to
the room contact bake. No live lights or shadow maps are added.
All model geometry, textures and scripting are original project work under MIT.
