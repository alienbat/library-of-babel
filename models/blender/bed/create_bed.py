"""Original Scandinavian-style bed. Run with Blender --background --python this-file."""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
asset = bpy.data.collections.new('BED — export meshes')
scene.collection.children.link(asset)
studio = bpy.data.collections.new('STUDIO — preview only')
scene.collection.children.link(studio)

def move_to(obj, collection):
    for col in list(obj.users_collection): col.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def texture(name, wood=False):
    size = 256
    y, x = np.mgrid[0:size, 0:size].astype(float)
    rng = np.random.default_rng(41)
    if wood:
        v = .94 + .035*np.sin(x*.21 + .7*np.sin(y*.025)) + .018*np.sin(x*.74 + np.sin(y*.04)) + rng.uniform(-.012,.012,(size,size))
    else:
        v = .95 + .025*np.cos(x*math.pi) + .025*np.cos(y*math.pi) + rng.uniform(-.015,.015,(size,size))
    pixels = np.ones((size,size,4), dtype=np.float32)
    pixels[:,:,:3] = v[:,:,None]
    im = bpy.data.images.new(name,width=size,height=size)
    im.pixels.foreach_set(pixels.ravel())
    im.pack()
    return im

wood_tex = texture('Subtle ash grain • original procedural image', True)
cloth_tex = texture('Fine linen weave • original procedural image')
def mat(name, color, tex=None, repeats=(1,1,1)):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    nodes=m.node_tree.nodes
    p=nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.8
    if tex:
        # Multiply color into image for glTF portability: no custom shaders needed.
        image=tex.copy(); image.name=name+' albedo'
        values=np.array(tex.pixels[:],dtype=np.float32).reshape(-1,4)
        values[:,:3]*=np.array(color)
        image.pixels.foreach_set(values.ravel());image.pack()
        t=nodes.new('ShaderNodeTexImage'); t.image=image
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m
wood=mat('Light ash wood',(.66,.48,.29),wood_tex)
linen=mat('Warm ivory linen',(.84,.81,.71),cloth_tex)
duvet=mat('Sage woven duvet',(.32,.40,.35),cloth_tex)
foldmat=mat('Duvet turnback',(.43,.50,.43),cloth_tex)
stitch=mat('Linen piping',(.71,.68,.59))
thread=mat('Sage edge binding',(.27,.34,.29))

def finish(obj,name,m):
    obj.name=name;move_to(obj,asset);obj.data.materials.append(m)
    return obj

def box(name,pos,dim,m,r=.012,segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=finish(bpy.context.object,name,m);o.dimensions=dim
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if r:
        b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=r;b.segments=segments
        n=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
        for poly in o.data.polygons:poly.use_smooth=True
    return o

# Blender Z-up, head toward +Y. The entire frame fits 1.00 x 1.80 m.
for x in [-.435,.435]:
    for y in [-.785,.785]:
        box('Solid ash leg',(x,y,.185),(.065,.065,.37),wood,.008)
for x in [-.473,.473]:box('Long side rail',(x,0,.335),(.054,1.70,.16),wood,.012)
for y in [-.868,.868]:box('End rail',(0,y,.335),(.946,.064,.16),wood,.012)
# Visible slat support beneath mattress, not a solid block.
for y in np.linspace(-.76,.76,9):box('Support slat',(0,float(y),.395),(.9,.065,.025),wood,.004,2)
for x in [-.438,.438]:box('Headboard upright',(x,.86,.60),(.064,.06,.77),wood,.01)
for z in [.70,.88]:box('Headboard slat',(0,.855,z),(.94,.055,.14),wood,.018)
box('Rounded upholstered mattress',(0,0,.515),(.922,1.688,.215),linen,.075,5)

# Curved seam paths stay just proud of the fabric, avoiding coincident surfaces.
def line(name,points,material,r=.003):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1
    curve.bevel_depth=r;curve.bevel_resolution=1
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for p,v in zip(sp.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,curve);asset.objects.link(o);o.data.materials.append(material)
    return o

def rounded_loop(w,d,z,r=.08):
    pts=[]
    for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for a in np.linspace(start,start+90,9):
            t=math.radians(a);pts.append((cx+r*math.cos(t),cy+r*math.sin(t),z))
    pts.append(pts[0]);return pts
line('Mattress sewn upper edge',rounded_loop(.922,1.688,.565,.085),stitch,.0025)
line('Mattress sewn lower edge',rounded_loop(.922,1.688,.46,.085),stitch,.0025)

# Pillow: layered rounded-rectangle rings with pinched perimeter and soft dome.
verts=[];faces=[];rings=[(1,.654),(.99,.665),(.88,.715),(.60,.742),(.28,.750)]
N=48
for scale,z in rings:
    for i in range(N):
        a=2*math.pi*i/N;c=math.cos(a);s=math.sin(a)
        xx=.34*math.copysign(abs(c)**.55,c)*scale
        yy=.192*math.copysign(abs(s)**.55,s)*scale
        crease=.004*math.cos(6*a)*scale**5
        verts.append((xx,.57+yy,z+crease))
for j in range(len(rings)-1):
    for i in range(N):
        k=j*N+i;n=j*N+(i+1)%N;faces.append((k,n,n+N,k+N))
verts.append((0,.57,.752));center=len(verts)-1
for i in range(N):faces.append(((len(rings)-1)*N+i,(len(rings)-1)*N+(i+1)%N,center))
# Closed underside: shallow cushion belly, not an open surface.
verts.append((0,.57,.628));bottom=len(verts)-1
for i in range(N):faces.append(((i+1)%N,i,bottom))
mesh=bpy.data.meshes.new('Pillow cushion topology');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Soft linen pillow',mesh);asset.objects.link(o);mesh.materials.append(linen)
for p in mesh.polygons:p.use_smooth=True
line('Pillow stitched perimeter',[verts[i] for i in range(N)]+[verts[0]],stitch,.002)

# A thin draped quilt: broad surface ripples, softly hanging sides/foot.
def quilt_point(u,v):
    x=.488*u;y=-.875+1.235*v
    side=max(0,(abs(x)-.413)/.075)
    foot=max(0,(.075-v)/.075)
    z=.654-.125*side**1.7-.13*foot**1.7
    z+=.007*math.sin(v*math.pi*5+u*1.7)*(1-side)*math.sin(v*math.pi)
    z+=.004*math.cos(u*math.pi*3)*math.sin(v*math.pi)
    return (x,y,z)
verts=[];faces=[];nx=20;ny=28
for j in range(ny+1):
    for i in range(nx+1):verts.append(quilt_point(-1+2*i/nx,j/ny))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Draped duvet surface');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Sage duvet • broad soft folds',mesh);asset.objects.link(o);mesh.materials.append(duvet)
for p in mesh.polygons:p.use_smooth=True
solid=o.modifiers.new('Quilt thickness','SOLIDIFY');solid.thickness=.013
bevel=o.modifiers.new('Soft bound edge','BEVEL');bevel.width=.005;bevel.segments=2
for u in [-.97,.97]:line('Duvet side stitched hem',[tuple(Vector(quilt_point(u,j/ny))+Vector((0,0,.003))) for j in range(ny+1)],thread,.002)
# Turned-down lip is a rounded band rather than a sharp rectangular strip.
box('Soft duvet turnback',(0,.29,.669),(.854,.16,.036),foldmat,.017,4)

# Planar UVs keep original procedural albedo portable to glTF.
bpy.ops.object.select_all(action='DESELECT')
for o in list(asset.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=.02)
        bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)

# Studio is separate and excluded from the export.
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.3,-3.2,2.25));camera=move_to(bpy.context.object,studio)
camera.name='Bed preview camera';aim(camera,(0,0,.40));camera.data.type='ORTHO';camera.data.ortho_scale=2.65;scene.camera=camera
floor=box('Studio floor',(0,0,-.035),(200,200,.06),mat('Studio neutral',(.17,.19,.18)),0);move_to(floor,studio)
for pos,power,size in [((1,-1,3),160,3),((-2,-.5,1.8),90,2),((0,2,2.5),120,2)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=move_to(bpy.context.object,studio);o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,.3))
scene.world=bpy.data.worlds.new('Studio');scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.25,.25,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(HERE/'bed-preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in asset.objects if o.type=='MESH')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bed.blend'))
bpy.ops.render.render(write_still=True)
# Curves must become meshes for portable piping; convert only after saving editable source.
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in asset.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
# Merge by material in the export copy; retain separate editable objects in .blend.
for material in [wood,linen,duvet,foldmat,stitch,thread]:
    bpy.ops.object.select_all(action='DESELECT')
    parts=[o for o in asset.objects if o.type=='MESH' and o.data.materials[0]==material]
    for o in parts:o.select_set(True)
    if parts:
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name=material.name+' • merged export'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'bed.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False)
print('BED SAVED / RENDERED / EXPORTED',len(asset.objects),'asset objects')
