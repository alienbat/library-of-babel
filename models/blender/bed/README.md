# Scandinavian-style bed

An original, clean, stylized furniture design inspired by simple Scandinavian
flat-pack furniture. It does not reproduce a particular IKEA product or use its
branding or assets.

- `bed.blend`: editable source with 30 separate bed objects, packed textures and
  a separate preview studio collection.
- `bed-preview.png`: CPU Cycles preview.
- `bed.glb`: portable export, combined into six material batches; studio lights,
  ground and camera excluded. Approximately 586 KiB and 10,524 triangles.
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
the GLB to check its six mesh batches and exclusion of studio objects.

This is the **authoring model**, not yet a replacement in the running game.
The studio preview lighting is not baked into the export. Runtime integration
should use the game's static room lighting, shared geometry/instancing, and
simpler distant LODs rather than repeating the full model on every visible floor.
All model geometry, textures and scripting are original project work under MIT.
