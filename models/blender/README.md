# Blender source models

`shelf-test.blend` is a small workflow specimen created with Blender 5.2 LTS:
three rows of books, supporting shelf boards, a plain backing, materials, a
preview camera and studio lights. Units are metres. It is an original project
asset under the repository MIT license, not yet an in-game replacement.

Open the `.blend` directly in Blender. `shelf-test.png` is its rendered preview.
The editable objects and bevel modifiers remain in the file.

To rebuild the sample (overwrites the sample scene and preview):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python models/blender/create_test_scene.py
```

The script uses Blender's Python API and CPU Cycles rendering, so automation does
not depend on manually clicking the interface or using the GPU. The saved scene
was reopened in a separate Blender process and in the desktop application; its
81 book objects and preview camera were verified after reopening.

Future game-ready assets can be exported separately after agreeing on geometry,
materials, baked lighting and LOD requirements. These authoring files are outside
`public/` and do not increase the game's deployed download size.
