"""Run with Blender --background --python create_test_scene.py."""
from pathlib import Path
import bpy
from mathutils import Vector

folder = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .7
    return mat

wood = material('Shelf wood', (.16, .08, .035))
wall = material('Plain backing', (.43, .42, .36))
book = material('Book cloth', (.38, .22, .08))
ground = material('Ground', (.13, .15, .14))

def box(name, location, dimensions, mat, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Small edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return obj

# A deliberately small workflow specimen, not a replacement game asset.
box('Plain shelf backing', (0, .19, .64), (1.3, .035, 1.28), wall)
for x in [-.635, .635]:
    box('Side board', (x, 0, .64), (.03, .4, 1.28), wood)
for row in range(4):
    z = .03 + row * .39
    box('Horizontal shelf board', (0, 0, z), (1.24, .4, .03), wood)
    if row < 3:
        for index in range(27):
            box(f'Book {row+1}-{index+1:02}', (-.55+index*.041, -.015, z+.015+.17), (.037, .30, .34), book, .001)
box('Display ground', (0, 0, -.015), (200, 200, .03), ground, 0)

bpy.ops.object.camera_add(location=(2.2, -3.1, 2.0))
camera = bpy.context.object
camera.name = 'Preview camera'
camera.rotation_euler = (Vector((0, 0, .65))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.3
scene.camera = camera
for name, pos, energy, size in [('Key', (1, -2, 3), 220, 3), ('Fill', (-2, -1, 2), 90, 2)]:
    bpy.ops.object.light_add(type='AREA', location=pos)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (Vector((0,0,.65))-light.location).to_track_quat('-Z','Y').to_euler()
scene.world = bpy.data.worlds.new('Studio world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.15,.15,.15,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(folder / 'shelf-test.png')
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'shelf-test.blend'))
bpy.ops.render.render(write_still=True)
print('CREATED:', folder / 'shelf-test.blend')
