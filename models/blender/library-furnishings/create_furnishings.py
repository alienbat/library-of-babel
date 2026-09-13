"""Original library fixtures. Metres; shelf dimensions are a fixed capacity contract."""
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
asset=bpy.data.collections.new('Editable furnishings');scene.collection.children.link(asset)
def mat(name,hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*rgb,1);return m
wood=mat('Shelf timber','544b3d');steel=mat('Satin stainless steel','adb3ac');green=mat('Enamel sage','63766a');black=mat('Dark recess','29312d');stone=mat('Warm aggregate plinth','85877e');button=mat('Green push button','71966d')
def box(name,pos,dim,m,r=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object
    for c in list(o.users_collection):c.objects.unlink(o)
    asset.objects.link(o);o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if r:
        b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=r;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
# Full-length board and upright, centred for runtime instancing. Blender Y becomes glTF -Z.
box('ShelfBoard',(0,0,0),(22.86,.5,.04),wood,.0015)
box('ShelfUpright',(0,0,0),(.055,.46,3.25),wood,.002)
# Return unit faces Blender -Y (toward gallery in the positive-side installation).
# Dark inset is surrounded by a real lip and hood, not a painted rectangular box.
box('Return_Cabinet',(0,0,.62),(.50,.44,1.24),green,.028)
box('Return_Base',(0,0,.035),(.50,.44,.07),black,.012)
box('Return_Inset',(0,-.227,.97),(.414,.016,.155),black,.009)
box('Return_Lip',(0,-.255,.896),(.44,.072,.025),steel,.008)
box('Return_Hood',(0,-.252,1.067),(.47,.094,.045),steel,.013)
box('Return_Flap',(0,-.244,1.007),(.388,.012,.057),steel,.005)
box('Return_ServiceDoor',(0,-.225,.43),(.414,.018,.63),green,.016)
box('Return_Lock',(.165,-.239,.69),(.025,.01,.025),steel,.007)
# Small raised lettering, readable without another texture or transparent surface.
bpy.ops.object.text_add(location=(-.193,-.224,1.145),rotation=(1.57079632679,0,0));o=bpy.context.object;o.name='Return_Label';o.data.body='BOOK RETURN';o.data.size=.044;o.data.extrude=.0005;o.data.materials.append(steel)
for c in list(o.users_collection):c.objects.unlink(o)
asset.objects.link(o)
# Park-style electric BBQ food dispenser, entirely inside the existing .9 x 1.1 footprint.
box('BBQ_Platform',(0,0,.045),(.85,1.04,.09),stone,.022)
box('BBQ_Pedestal',(0,0,.46),(.74,.87,.85),stone,.035)
box('BBQ_Cabinet',(0,-.448,.49),(.61,.025,.64),green,.022)
box('BBQ_Top',(0,0,.94),(.9,1.1,.08),steel,.026)
box('BBQ_Hotplate',(0,0,.984),(.68,.78,.014),black,.018)
# A flat hotplate is characteristic of public park BBQs; a recessed grease channel and drain.
box('BBQ_Channel',(0,.423,.984),(.68,.065,.014),black,.009)
for x in [-.26,-.13,0,.13,.26]:box('BBQ_DrainBridge',(x,.423,.99),(.02,.063,.008),steel,.002)
box('BBQ_ControlPanel',(0,-.473,.81),(.28,.023,.095),steel,.012)
box('BBQ_PushButton',(.075,-.49,.81),(.047,.018,.045),button,.015)
box('BBQ_Indicator',(-.07,-.489,.81),(.065,.009,.018),black,.004)
for x in [-.20,-.10,0,.10,.20]:box('BBQ_Vent',(x,-.466,.24),(.055,.008,.012),black,.003)
# Move fixtures apart only in the saved editable presentation; export removes presentation offsets.
for o in asset.objects:
    if o.name.startswith('Return_'):o.location.x+=2
    if o.name.startswith('BBQ_'):o.location.x+=4
# Hide shelf prototypes in the studio view (their dimensions differ radically).
for o in asset.objects:
    if o.name.startswith('Shelf'):o.hide_render=True
bpy.ops.object.camera_add(location=(7,-6,4));cam=bpy.context.object;cam.rotation_euler=(Vector((3,0,.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.5;scene.camera=cam
for pos in [(3,-3,5),(5,2,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=350;o.data.shape='DISK';o.data.size=4;o.rotation_euler=(Vector((3,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Studio');scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.25,.25,1)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.device='CPU';scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.filepath=str(HERE/'furnishings-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'furnishings.blend'))
bpy.ops.render.render(write_still=True)
for prefix,offset in [('ShelfBoard',0),('ShelfUpright',0),('Return_',2),('BBQ_',4)]:
    bpy.ops.object.select_all(action='DESELECT');parts=[o for o in asset.objects if o.name.startswith(prefix)]
    for o in parts:o.hide_render=False;o.location.x-=offset;o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH')
    # Export one mesh per material, keeping the editable Blender source unmerged.
    batches=[[o for o in parts if o.data.materials[0]==m] for m in {o.data.materials[0] for o in parts}]
    for subset in batches:
        bpy.ops.object.select_all(action='DESELECT')
        for o in subset:o.select_set(True)
        bpy.context.view_layer.objects.active=subset[0]
        if len(subset)>1:bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects:
        if o.name.startswith(prefix):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(HERE/(prefix.rstrip('_')+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False)
