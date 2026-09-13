# Cycles lighting prototype

A separate first-person scene tests offline path-traced lighting on the existing
seven-bed bedroom and adjoining gallery. It does not replace the whole library.

## Run

```sh
npm run preview:raytrace
```

Open `http://127.0.0.1:8773/raytrace-prototype/`. Choose Bedroom, Doorway, Gallery or
Beds; click the scene to look around, WASD to move, Space/C to rise/descend.
This inspection camera has no collision or game progression.

## Rebuild the bake

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/raytrace-prototype/bake.py
npm run build:raytrace
```

`raytrace-prototype.blend` contains the editable physical scene and atlas UVs.
`public/raytrace-prototype/room.glb` contains the browser-ready baked model.
`room.png`, `beds.png` and `shelves.png` contain diffuse color + direct + indirect illumination. The bake uses
Cycles, 96 samples, six diffuse bounces, black world illumination and rectangular
area lights. The bed meshes/textures come from the existing original bed asset.
The shelf uses 8 rows and 570 stationary books per row with simplified binding
geometry for this illumination test.

The runtime uses unlit materials: no real-time light, baked-volume multiplier,
AO map, approximate bounce or extra tone mapping is applied to the atlas.
Geometric occlusion comes from Cycles transport itself. The atlas is an LDR
sRGB image; this prototype therefore cannot preserve lighting values above its
range or support later exposure changes without rebaking/exporting HDR.

## Scope and limitations

- Single finite gallery strip and bedroom, rather than a converged periodic
  neighbourhood. The bathroom doorway is closed for this first trial.
- Actual bed geometry and book bodies cast shadows, but individual book binding
  decoration, wall signs and other amenities are outside this trial.
- Separate 2048-square architecture and 4096-square bed/shelf atlases, denoised
  offline. Fine islands can still lose detail; a production version should
  improve UV allocation and use directional lightmaps where appropriate.
- Camera-dependent reflections and moving-object lighting are not baked here.
- Reusing this in the full library requires repeatable atlas layouts, terminal
  variants, neighbouring-cell convergence checks and matching distant LODs.

The prototype is intentionally isolated from the existing playable lighting
preview, which remains on its separate worktree/branch.
