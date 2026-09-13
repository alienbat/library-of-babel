> Historical implementation: production Cycles fields replace this AO pass. See [Cycles lighting](CYCLES_LIGHTING.md).

# Static room AO port from the Babylon prototype

The original Three.js renderer now includes short-range baked room contact shading.
The isolated Babylon experiment is backed up at `origin/prototype/babylon-renderer`
(commit `b4a3345`); its branch was not merged. No Babylon dependency was introduced.

The bake casts 32 deterministic directions per voxel in a 60 × 24 × 16 visibility
field, using a 0.75 m radius and conservative bounds of room walls, stairs and box
furnishings. It gently modulates the existing positive/negative irradiance textures
in place. There are no extra GPU textures, shader samples, draw calls, moving lights
or per-frame AO work. Temporary CPU visibility data is discarded after the bake.
This is an approximate local occlusion bake, not full global illumination.

Normal and top-floor geometry have independent cached bakes. Capture uses authoring
coordinates before conversion to float32 instance transforms, normalized relative
to an amenity cell near the player. Sub-micrometre arithmetic roundoff is removed
before containment tests. A bottom start samples an ordinary interior floor for the
shared normal bake. Rebuilds cannot repeatedly darken the textures. Existing lighting
texture disposal handles the result without additional lifecycle resources.

The prototype's stationary-camera GPU queries remain experimental on its branch.
Their measured gains were small (about 6% in stairs, 3% in the bathroom on Babylon),
and they invalidate during movement. The existing Three.js analytic stair culling
remains in use; those Babylon figures are not claimed as Three.js speedups.

Validation:

- 67 automated tests pass, including shifted-start/top/bottom invariance and no
  repeated darkening on scene rebuilds.
- Main TypeScript check, scoped lint and production build pass, including book-worker
  URL verification. The unrelated baseline full-lint finding remains unchanged.
- Bathroom and top descending stair views inspected in the Three.js browser fixture.
- 12 existing stair/gallery/chasm GPU regression views: zero shader errors and zero
  changed pixel channels between analytic stair culling enabled and disabled.
- Main scene geometry, shelf LOD and horizon shaders are unchanged.

Run `npm run test:scene` for the local rendering fixture. No production deployment
was performed as part of this port.
