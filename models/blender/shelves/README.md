# Modular shelf kit

Original minimal timber shelving, authored in Blender. `shelves.blend` contains the
export prototypes and an assembled two-bay example with linked book objects.

- Repeat pitch: 22.86 m. Eight rows of 570 books; positions and identifiers unchanged.
- `ShelfModule.glb`: eight continuous boards and eight shared uprights. Adjacent
  modules meet at the board ends without bevel grooves; only one upright occupies
  each module seam.
- `ShelfModuleStart.glb`: omits the first upright, supplied by the permanent end cap.
- `ShelfUpright.glb`: symmetric end cap, usable at either exposed run end.
- `ShelfBoard.glb`: longitudinally chamfered board prototype; mating ends stay flat.
- `ShelfBook.glb`: 20-triangle binding with softened spine corners and inset-looking
  page edges supplied by texture. This is shared by all nearby book instances.

The runtime uses the rounded book within 24 m, box books out to Low/32 or High/100 m,
then a texture face with filtered board relief to 500 m and the existing analytic
horizon beyond. The shelf face retains the same binding/wood palette, row spacing,
contact shading and board silhouette; rounded corners are subpixel at the handoff.
No new runtime lights. Static lighting, 24 m opened-book tint, analytical picking,
and collision bounds remain in use. Books stay on the shelves while being read.

The runtime loads reusable prototypes, not thousands of Blender scene objects.
Frame instances are shared per bay; no whole-room or repeated book-model downloads.
The old fixture kit is retained as the source for the return slot and BBQ.

Rebuild:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python models/blender/shelves/create_shelves.py
```
