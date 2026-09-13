# Bathroom fixture kit

Original clean, stylized Blender models, integrated into the game:

- Closed-lid toilet, loaded from the editable toilet source.
- Rounded shower and toilet privacy partitions with caps and foot shoes.
- Tissue dispenser with a small folded hanging sheet.
- Curved shower risers, rain heads, textured spray plates and mixer controls.
- Shallow shower trays sloping into a more pronounced recess around each grate.
- Sculpted concave wash basin, tap, soap dispenser and mirror above the basin.

`bathroom.blend` contains 71 editable objects and a separate studio collection.
`bathroom.glb` has seven shared material batches, 16,284 triangles and one embedded
128-pixel nozzle texture; approximately 533 KiB. `bathroom-preview.png` is a studio
render. Geometry, materials, texture and scripts are original MIT-licensed work.

The origin is the bathroom centre at floor height. In Blender, X runs along the
gallery, +Y points away from the gallery and Z is up. The game places this origin
at amenity X=27, depth=2.5 m. glTF converts to Y up; the renderer prepares a mirrored
geometry variant with reversed triangle winding for the opposite gallery, without
negative instance scales.

## Update the model and game together

Run from the repository root with Blender 5.2 LTS installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/bathroom/create_bathroom.py
npm run build
npm run build:github
```

If updating the toilet, regenerate `toilet/toilet.blend` first: this script imports
that source into the kit. The game imports this kit's GLB directly through Vite.
Run the static build last because the Vinext build clears `dist/`, including the
local static preview. Refresh the browser to load the newly hashed model.

Runtime materials use the existing static room lighting. Contact bounds are in
`lib/game/bathroom-fixtures.ts`; walking/falling support follows the tray rings in
`lib/game/room-layout.ts`. Update those when changing footprints or floor shape.
The kit uses shared instanced geometry within 14 m and coarse batches outside it,
including a fallback if loading fails. No runtime lights, reflection cameras or
shadow maps are added. The mirror is a static shaded panel.

Validated by Blender source reopen and GLB reimport, game views of the basin,
toilet, drain and opposite gallery, and tests for reflected winding, fixture
batch disposal, shower walking/falling support, routes and embedded asset data.
