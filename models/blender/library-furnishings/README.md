# Library furnishings

Original clean, stylized furniture authored in Blender, under the project MIT license.
`furnishings.blend` retains editable objects and bevel modifiers. The preview shows
the hooded after-hours book return and public-park-style electric BBQ food dispenser.
The two shelf prototypes are hidden in the studio render; enable their render
visibility to inspect them. They are centred at the origin for runtime instancing.

## Fixed shelf contract

- Horizontal board: **22.86 × 0.04 × 0.50 m** (width, height, depth).
- Upright: **0.055 × 3.25 × 0.46 m**.
- Edge bevels: 1.5 mm on boards, 2 mm on uprights, cut inward within those bounds.
- The game retains eight rows, 570 books per row, 0.39 m row spacing, all original
  book transforms, picking and identifiers. Books rest at the same support height.
- Plain wall backing, shelf façade textures, 500 m façade relief and horizon remain
  unchanged. Real-book detail extends to 32 m, and exposed timber end panels
  persist independently of the book LOD. The Blender exports replace only nearby frame geometry.

`Return.glb` is a 0.50 m wide cabinet with a hood, inset slot, flap, service panel
and book-return lettering. It stands centred beneath the biography/exit sign beside the rest-area exit. `BBQ.glb` replaces
the old kiosk with the same 0.90 × 1.10 m footprint, now against the wall beneath
the rest-area/food label, with a flat hotplate,
grease channel, satin surround and simple controls. These remain scenery.

The game shares instanced geometry and baked lighting materials, with simplified
models beyond 14 m and while loading. No runtime lights or reflective cameras are
exported. Fixture contact volumes and the return collision envelope are included.

Rebuild from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/library-furnishings/create_furnishings.py
```

Only the four GLBs ship with the game. Blender sources and the CPU-rendered studio
preview stay in the repository.
