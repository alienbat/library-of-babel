"""Cycles multi-bounce prototype. Blender Z up; runtime glTF uses Y up.
Run: Blender --background --python-exit-code 1 --python this-file.
"""
from pathlib import Path
import bpy, math, json, time
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=ROOT/'public/raytrace-prototype';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=6;scene.cycles.glossy_bounces=0
scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.world=bpy.data.worlds.new('Black world - no ambient illumination')
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None';scene.view_settings.exposure=0
scene.unit_settings.system='METRIC'
receivers=[];lenses=[]
def material(name,rgb):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=1
    return m
wall=material('Pale plaster',(.56,.55,.50));ceiling=material('Ceiling',(.4,.4,.35));carpet=material('Dark carpet',(.12,.14,.12));wood=material('Shelf wood',(.10,.075,.045));bookmat=material('Book bindings',(.32,.23,.105));rail=material('Red rails',(.28,.055,.026))
def box(name,pos,size,mat,target=True):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if target:receivers.append(o)
    return o
# Bedroom: same 8 x 6.3 m footprint and 3.33 m door head as the game.
box('Bedroom floor',(20,3.15,-.09),(8,6.3,.18),carpet)
box('Bedroom ceiling',(20,3.15,3.71),(8,6.3,.18),ceiling)
for pos,size in [((16,3.15,1.81),(.2,6.3,3.62)),((24,3.15,1.81),(.2,6.3,3.62)),((20,6.3,1.81),(8,.2,3.62)),((17,.25,1.81),(2,.5,3.62)),((22,.25,1.81),(4,.5,3.62)),((19,.25,3.475),(2,.5,.29))]:box('Bedroom wall',pos,size,wall)
# Bathroom is outside this first prototype: closed boundary on the side wall.
# Gallery around the doorway, with neighbour buffers to avoid an isolated-box bake.
box('Gallery floor',(24,-1.8288,-.17),(48,3.6576,.34),carpet)
box('Gallery ceiling',(24,-1.8288,3.79),(48,3.6576,.34),ceiling)
box('Left gallery backing',(8,.15,1.81),(16,.3,3.62),wall)
box('Right gallery backing',(36,.15,1.81),(24,.3,3.62),wall)
for height in [.55,1.2192]:box('Rail',(24,-3.6076,height),(48,.072,.072),rail)
for x in range(0,49,4):box('Rail post',(x,-3.6076,.61),(.072,.072,1.22),rail)
# One full shelf bay; same eight rows and 570 book slots. Merge repeated cuboids
# into a mesh directly to keep authoring overhead down. Geometry is occlusion real,
# while individual binding embellishments are omitted from this lighting trial.
verts=[];faces=[]
def cube_into(pos,size):
    start=len(verts);x,y,z=pos;w,d,h=size
    verts.extend([(x+a*w/2,y+b*d/2,z+c*h/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
    faces.extend([tuple(start+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]])
# Narrow representative shelf run from x=24 onward, 8 full shelf rows.
for row in range(8):
    box('Shelf board',(35.43,-.04,.11+row*.39),(22.86,.5,.04),wood)
    for b in range(570):cube_into((24+(b+.5)*22.86/570,-.08,.30+row*.39),(.037,.30,.34))
for j in range(9):box('Shelf upright',(24+j*22.86/8,-.04,1.63),(.055,.5,3.25),wood)
mesh=bpy.data.meshes.new('4560 stationary book geometry');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Books - fixed positions',mesh);scene.collection.objects.link(o);o.data.materials.append(bookmat);receivers.append(o)
# Import the actual in-game bed model once, then make linked instances.
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/blender/bed/bed.glb'))
parts=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
for o in parts:
    o.matrix_world=o.matrix_world.copy()
    if o.parent:o.parent=None
placements=[(x,5.299,0) for x in [17.2,19,20.8,22.6]]+[(x,1.401,math.pi) for x in [17.2,21,22.8]]
for x,y,angle in placements:
    for src in parts:
        o=src.copy();o.data=src.data.copy();o.name='Bed '+src.name;scene.collection.objects.link(o)
        # Imported asset uses local +Y for its head in Blender.
        from mathutils import Matrix
        o.matrix_world=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')@src.matrix_world
        receivers.append(o)
for o in parts:bpy.data.objects.remove(o,do_unlink=True)
# Light fixtures are the only source of energy. No AO shader nodes.
def fixture(x,y,power):
    o=box('Ceiling lens',(x,y,3.59),(1.6,.28,.035),wall,False);lenses.append(o)
    em=bpy.data.materials.new('Luminous diffuser');nodes=em.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');e=nodes.new('ShaderNodeEmission');e.inputs['Color'].default_value=(1,.96,.87,1);e.inputs['Strength'].default_value=1
    em.node_tree.links.new(e.outputs[0],out.inputs[0]);o.data.materials.clear();o.data.materials.append(em)
    bpy.ops.object.light_add(type='AREA',location=(x,y,3.565));light=bpy.context.object;light.name='Physical rectangular area light';light.data.energy=power;light.data.shape='RECTANGLE';light.data.size=1.6;light.data.size_y=.28
for x in [18,22]:fixture(x,3.15,150)
for j in range(7):fixture(3.81+j*7.62,-1.8288,150)
# Convert receivers to evaluated meshes, and bind albedo textures to their
# original UVs before introducing a separate non-overlapping bake atlas.
bpy.ops.object.select_all(action='DESELECT')
for o in receivers:o.select_set(True)
bpy.context.view_layer.objects.active=receivers[0];bpy.ops.object.convert(target='MESH')
receivers=list(bpy.context.selected_objects)
for o in receivers:
    if not o.data.uv_layers:o.data.uv_layers.new(name='SurfaceUV')
    o.data.uv_layers[0].name='SurfaceUV'
    for mat in o.data.materials:
        if not mat:continue
        for node in list(mat.node_tree.nodes):
            if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:
                uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='SurfaceUV';mat.node_tree.links.new(uv.outputs['UV'],node.inputs['Vector'])
# Keep roomy atlases for architecture and fabric rather than letting book islands
# consume all available texels. All physical materials remain until every bake ends.
groups=[('room',2048,[o for o in receivers if not o.name.startswith(('Bed ','Shelf','Books'))]),('beds',4096,[o for o in receivers if o.name.startswith('Bed ')]),('shelves',4096,[o for o in receivers if o.name.startswith(('Shelf','Books'))])]
targets=[]
for name,size,objects in groups:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();target=bpy.context.object;target.name='Cycles baked '+name
    target.data.uv_layers.new(name='Lightmap');target.data.uv_layers.active_index=len(target.data.uv_layers)-1
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.001,area_weight=1,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new('Cycles '+name,width=size,height=size,float_buffer=True)
    image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG'
    for mat in target.data.materials:
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
    targets.append((target,image))
scene.render.bake.margin=12;scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True
scene.render.bake.use_selected_to_active=False
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'raytrace-prototype.blend'))
start=time.time()
for target,image in targets:
    bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
    print('BAKING',target.name,flush=True);bpy.ops.object.bake(type='DIFFUSE');image.save()
print('BAKE_SECONDS',round(time.time()-start,2),flush=True)
# Cycles texture baking does not run the render denoiser. Denoise the baked atlas
# offline through Blender's compositor, before exporting it to the browser.
for o in scene.objects:o.hide_render=True
bpy.ops.object.camera_add(location=(0,0,20));scene.camera=bpy.context.object
scene.cycles.samples=1
for target,image in targets:
    tree=bpy.data.node_groups.new('Denoise '+image.name,'CompositorNodeTree')
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    source=tree.nodes.new('CompositorNodeImage');source.image=image
    denoise=tree.nodes.new('CompositorNodeDenoise');out=tree.nodes.new('NodeGroupOutput')
    tree.links.new(source.outputs['Image'],denoise.inputs['Image']);tree.links.new(denoise.outputs['Image'],out.inputs['Image'])
    scene.compositing_node_group=tree
    scene.render.resolution_x=image.size[0];scene.render.resolution_y=image.size[1];scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=image.filepath_raw
    bpy.ops.render.render(write_still=True)
    baked=bpy.data.images.load(image.filepath_raw,check_existing=False)
    m=bpy.data.materials.new('Baked '+target.name+' - no runtime AO');n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=baked
    m.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']);m.node_tree.links.new(em.outputs[0],out.inputs[0])
    target.data.materials.clear();target.data.materials.append(m)
    for poly in target.data.polygons:poly.material_index=0
    for uv in list(target.data.uv_layers):
        if uv.name!='Lightmap':target.data.uv_layers.remove(uv)
    target.data.uv_layers.active_index=0
bpy.ops.object.select_all(action='DESELECT')
for target,image in targets:target.hide_render=False;target.select_set(True)
for o in lenses:o.hide_render=False;o.select_set(True)
bpy.context.view_layer.objects.active=targets[0][0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'room.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
(OUT/'bake-info.json').write_text(json.dumps({'samples':96,'diffuseBounces':6,'worldStrength':0,'ao':False,'atlases':[2048,4096,4096],'denoised':True,'bakeSeconds':round(time.time()-start,2),'triangles':sum(len(p.vertices)-2 for target,image in targets for p in target.data.polygons)},indent=2))
print('PROTOTYPE_READY',flush=True)
