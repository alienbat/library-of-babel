# Closed-lid toilet

Original clean, semi-cartoonish bathroom fixture, with rounded ceramic body and
cistern, a gently crowned closed lid, concealed hinges and a satin dual-flush
button. Ceramic uses simple solid-color materials rather than noisy surface wear.
All geometry and materials are original project work under the MIT license.

- `toilet.blend`: 15 editable parts and a separate studio collection.
- `toilet-preview.png`: CPU Cycles studio render.
- `toilet.glb`: four material/mesh batches, 5,140 triangles, about 141 KiB;
  no camera, lights, external textures or studio floor.
- `create_toilet.py`: reproducible modeling, rendering and export script.

Dimensions are approximately **0.514 m wide × 0.812 m deep × 0.898 m high**.
Blender uses metres and Z up; rear +Y faces the wall. The exported glTF uses Y up
and rear -Z. The origin is on the floor under the bowl centre, not the geometric
centre of the complete fixture.

Regenerate from the repository root (overwrites these outputs):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/toilet/create_toilet.py
```

Verified by rendering, inspecting the preview, reopening the source and
reimporting the four-batch GLB in a separate Blender process.

This is the authoring model, awaiting in-game integration. The preview studio
lighting is not exported. Runtime integration should reuse static bathroom
lighting and shared mesh instances, with reduced detail at distance.
