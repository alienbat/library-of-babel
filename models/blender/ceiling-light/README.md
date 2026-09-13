# Minimal ceiling light

Original Blender-authored warm diffuser, with lightly rounded corners and a
1.60 × 0.035 × 0.28 m envelope (game width, height, depth). Editable bevels are
retained in `ceiling-light.blend`; `ceiling-light.glb` is the detailed export.
`ceiling-light-low.glb` is the matching 12-triangle box. The runtime generates
that same box directly, avoiding another asset request.

All gallery, bedroom, bathroom and staircase fixtures share this geometry and
the existing baked emissive material. Source positions, emitter footprint and
baked illumination are preserved. No Blender studio lights are exported.

Settings → Detail controls both real books and rounded fixtures:

- Low (default): 32 m.
- High: 100 m.

Farther fixtures use the box; the extreme-distance gallery keeps its existing
lightweight ceiling representation. Instanced membership changes only when
needed. Source files and the studio preview are not deployed.

Regenerate from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/ceiling-light/create_light.py
```
