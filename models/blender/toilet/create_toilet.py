"""Original closed-lid toilet: Blender 5.2, metre units, portable GLB export."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
asset=bpy.data.collections.new('TOILET — export meshes');scene.collection.children.link(asset)
studio=bpy.data.collections.new('STUDIO — preview only');scene.collection.children.link(studio)
def move(obj,col):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    col.objects.link(obj)
    return obj

def material(name,color,roughness,metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1)
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    return m
ceramic=material('Warm white ceramic',(.82,.84,.79),.32)
seat=material('Ivory closed seat',(.88,.88,.82),.46)
chrome=material('Satin flush fittings',(.47,.53,.51),.3,.65)
shadow=material('Recessed joint',(.23,.27,.25),.7)

def box(name,loc,dim,mat,r=.02,segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=move(bpy.context.object,asset);o.name=name;o.dimensions=dim
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if r:
        b=o.modifiers.new('Soft ceramic edges','BEVEL');b.width=r;b.segments=segments
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        for p in o.data.polygons:p.use_smooth=True
    return o

# Elliptical ring lofts create a continuous curved body instead of stacked bricks.
def loft(name,rings,mat,n=48):
    verts=[];faces=[]
    for z,rx,ry,cy in rings:
        for i in range(n):
            a=2*math.pi*i/n
            verts.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);asset.objects.link(o);mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=len(p.vertices)==4
    return o

# Floor origin at the centre of the bowl; rear (+Y) faces the wall.
loft('Sculpted ceramic bowl and pedestal',[
 (.001,.165,.225,.035),(.018,.181,.244,.035),(.045,.179,.243,.035),
 (.10,.158,.222,.04),(.19,.133,.195,.055),(.26,.144,.213,.025),
 (.31,.183,.264,-.025),(.36,.221,.307,-.06),(.41,.245,.331,-.075),
 (.445,.254,.337,-.075),(.463,.251,.334,-.075),(.468,.242,.324,-.075),
],ceramic)
# Slim rear connection and softened tank make the fixture read as one assembly.
box('Rear ceramic bridge',(0,.245,.40),(.29,.24,.23),ceramic,.045)
box('Rounded cistern',(0,.278,.643),(.43,.23,.435),ceramic,.045,5)
box('Cistern cap joint',(0,.278,.857),(.407,.211,.006),shadow,.003,2)
box('Lift-off cistern cap',(0,.278,.876),(.438,.242,.035),ceramic,.016,4)
# Seat/lid separation is a shallow recessed shadow, with no open bowl to render.
loft('Seat underside shadow',[(.468,.239,.319,-.075),(.474,.239,.319,-.075)],shadow)
loft('Rounded seat ring below closed lid',[
 (.474,.239,.319,-.075),(.480,.250,.330,-.075),(.493,.250,.330,-.075),(.499,.240,.320,-.075)
],seat)
loft('Closed gently crowned lid',[
 (.500,.240,.320,-.075),(.505,.255,.336,-.075),(.517,.257,.338,-.075),
 (.531,.247,.329,-.075),(.540,.220,.298,-.075),(.544,.170,.232,-.075),(.546,.08,.11,-.075)
],seat)
for x in [-.115,.115]:box('Concealed lid hinge',(x,.23,.49),(.047,.055,.036),chrome,.012,3)
# Recessed dual flush button: small discs and a restrained dividing groove.
def cylinder(name,radius,depth,loc,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=loc)
    o=move(bpy.context.object,asset);o.name=name;o.data.materials.append(mat)
    b=o.modifiers.new('Button edge','BEVEL');b.width=.0015;b.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
cylinder('Flush button recessed bezel',.027,.003,(0,.278,.894),shadow)
cylinder('Satin dual flush button',.024,.004,(0,.278,.896),chrome)
box('Flush button division',(0,.278,.8983),(.0012,.041,.0006),shadow,.00025,2)
# Small low-profile ceramic fastener caps at the floor, no exposed plumbing detail.
for x in [-.16,.16]:
    box('Pedestal fixing cap',(x,.065,.045),(.021,.042,.025),ceramic,.01,3)

# Studio setup is excluded from exports and never becomes a runtime light.
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1.45,-2,1.5));camera=move(bpy.context.object,studio)
camera.name='Toilet preview camera';aim(camera,(0,0,.44));camera.data.type='ORTHO';camera.data.ortho_scale=1.28;scene.camera=camera
floor=box('Studio floor',(0,0,-.018),(200,200,.035),material('Studio sage grey',(.18,.21,.20),.9),0);move(floor,studio)
for pos,energy,size in [((1,-1.5,2.4),100,2),((-1.5,-.2,1.5),65,1.5),((0,1.8,2),90,1.5)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=move(bpy.context.object,studio);o.data.energy=energy;o.data.size=size;aim(o,(0,0,.4))
scene.world=bpy.data.worlds.new('Preview ambient');scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(HERE/'toilet-preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=asset.objects[0]
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'toilet.blend'))
bpy.ops.render.render(write_still=True)
# Editable parts stay separate in the source; export only four shared materials.
bpy.ops.object.convert(target='MESH')
for mat in [ceramic,seat,chrome,shadow]:
    bpy.ops.object.select_all(action='DESELECT');parts=[o for o in asset.objects if o.data.materials[0]==mat]
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    parts[0].name=mat.name+' — export'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'toilet.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False)
print('TOILET: source saved, preview rendered, four-material GLB exported')
