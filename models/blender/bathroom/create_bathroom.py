"""Author and export the complete stylized bathroom fixture kit, including the toilet."""
from pathlib import Path
import bpy,math
import numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
asset=bpy.data.collections.new('BATHROOM — export');scene.collection.children.link(asset)
studio=bpy.data.collections.new('STUDIO — preview only');scene.collection.children.link(studio)
def move(o,c):
    for col in list(o.users_collection):col.objects.unlink(o)
    c.objects.link(o);return o

def mat(name,color,rough=.65,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1)
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
ceramic=mat('Warm white ceramic',(.82,.84,.79),.32)
metal=mat('Satin metal',(.47,.53,.51),.35,.5)
panel=mat('Warm grey partitions',(.62,.66,.62),.7)
dark=mat('Recess and drain',(.10,.15,.13),.8)
linen=mat('Paper and ivory fittings',(.88,.88,.82),.65)
mirror=mat('Static mirror glass',(.47,.62,.62),.2)

def box(name,pos,dim,m,r=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=move(bpy.context.object,asset);o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if r:
        b=o.modifiers.new('Rounded edges','BEVEL');b.width=r;b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        for p in o.data.polygons:p.use_smooth=True
    return o

def mesh(name,verts,faces,m,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);asset.objects.link(o);data.materials.append(m)
    for p in data.polygons:p.use_smooth=smooth
    return o

def pipe(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c);asset.objects.link(o);c.materials.append(m);return o

def cylinder(name,pos,r,depth,m,axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=pos);o=move(bpy.context.object,asset);o.name=name;o.data.materials.append(m)
    if axis=='X':o.rotation_euler.y=math.pi/2
    if axis=='Y':o.rotation_euler.x=math.pi/2
    b=o.modifiers.new('Soft rim','BEVEL');b.width=.002;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o

# Kit origin: bathroom centre, floor height. Blender +Y points away from gallery.
with bpy.data.libraries.load(str(HERE.parent/'toilet/toilet.blend'),link=False) as (src,dst):
    dst.collections=['TOILET — export meshes']
toilet=dst.collections[0]
for o in list(toilet.objects):
    move(o,asset);o.location+=Vector((-2,1.75,0))
    # Reuse a small shared material palette across all bathroom fittings.
    for i,m in enumerate(o.data.materials):
        o.data.materials[i]=metal if 'Satin' in m.name else dark if 'joint' in m.name else linen if 'seat' in m.name else ceramic
bpy.data.collections.remove(toilet)

# Rounded partition panels with durable metal foot shoes and soft top caps.
box('Toilet privacy partition',(-1.25,1.6,1.085),(.10,1.70,2.13),panel,.022)
box('Toilet partition cap',(-1.25,1.6,2.156),(.114,1.71,.035),ceramic,.012)
for y in [.9,2.3]:box('Partition foot',(-1.25,y,.06),(.14,.16,.12),metal,.014)
box('Between showers partition',(2,0,1.125),(2, .10,2.21),panel,.024)
box('Shower partition cap',(2,0,2.24),(2.01,.115,.035),ceramic,.012)
for x in [1.1,2.7]:box('Shower screen foot',(x,0,.06),(.18,.14,.12),metal,.014)

# Compact tissue dispenser on the toilet side of the privacy panel.
box('Tissue dispenser shell',(-1.39,1.8,.95),(.17,.29,.23),panel,.035)
box('Tissue dispenser front',(-1.48,1.8,.95),(.028,.262,.20),linen,.013)
box('Tissue dispensing slot',(-1.496,1.8,.927),(.005,.16,.025),dark,.002)
# One restrained folded sheet: hangs visibly from the slot, not a rigid paper brick.
mesh('Hanging tissue sheet',[(-1.503,1.735,.934),(-1.503,1.865,.934),(-1.53,1.865,.90),(-1.53,1.735,.90),(-1.525,1.855,.78),(-1.525,1.745,.78)],[(0,1,2,3),(3,2,4,5)],linen)
# Paper is visible from either side without alpha blending.
o=asset.objects['Hanging tissue sheet'];o.modifiers.new('Paper thickness','SOLIDIFY').thickness=.001

# Basin ring loft: exterior shell, broad lip and a genuinely concave interior.
n=48;rings=[(.72,.46,.21),(.79,.54,.28),(.86,.55,.29),(.873,.53,.275),(.873,.465,.205),(.83,.43,.185),(.755,.30,.13),(.724,.10,.07)]
v=[];f=[]
for z,rx,ry in rings:
    for i in range(n):
        a=2*math.pi*i/n;c=math.cos(a);s=math.sin(a)
        v.append((-.4+rx*math.copysign(abs(c)**.55,c),-1.73+ry*math.copysign(abs(s)**.55,s),z))
for j in range(len(rings)-1):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
f.append(tuple(reversed(range(n))));f.append(tuple((len(rings)-1)*n+i for i in range(n)))
mesh('Sculpted wash basin',v,f,ceramic,True)
box('Basin wall mounting',(-.4,-1.93,.63),(.28,.14,.30),ceramic,.035)
cylinder('Basin drain rim',(-.4,-1.73,.728),.031,.006,metal)
cylinder('Basin drain opening',(-.4,-1.73,.732),.019,.003,dark)
pipe('Curved basin tap',[(-.4,-1.94,.87),(-.4,-1.94,1.015),(-.4,-1.932,1.04),(-.4,-1.91,1.06),(-.4,-1.79,1.06),(-.4,-1.77,1.045)],.022,metal)
box('Tap lever',(-.4,-1.94,1.078),(.038,.085,.015),metal,.006)
box('Soap dispenser',(.02,-1.9,.963),(.11,.10,.18),linen,.026)
pipe('Soap pump',[(.02,-1.9,1.05),(.02,-1.9,1.09),(.02,-1.84,1.09)],.009,metal)
# Mirror now sits over the wash basin on the same wall, facing the room.
box('Rounded mirror frame',(-.4,-1.958,1.87),(1.06,.065,1.37),metal,.04)
box('Mirror above wash basin',(-.4,-1.921,1.87),(.986,.010,1.296),mirror,.025)

# A little nozzle pattern in one small original texture, rather than many holes.
size=128;yy,xx=np.mgrid[0:size,0:size];rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=(.55,.60,.57)
for dx in [-.65,-.325,0,.325,.65]:
    for dy in [-.65,-.325,0,.325,.65]:
        if dx*dx+dy*dy>.7:continue
        mask=(xx-(dx+1)*size/2)**2+(yy-(dy+1)*size/2)**2<2.2**2;rgba[mask,:3]=(.08,.12,.10)
im=bpy.data.images.new('Original shower nozzle pattern',width=size,height=size);im.pixels.foreach_set(rgba.ravel());im.pack()
nozzle=mat('Shower spray face',(.55,.60,.57),.6)
t=nozzle.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;nozzle.node_tree.links.new(t.outputs['Color'],nozzle.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
for y in [-1.25,1.25]:
    pipe('Shower riser',[(2.78,y,1.10),(2.78,y,2.31),(2.765,y,2.36),(2.72,y,2.39),(2.42,y,2.39)],.018,metal)
    cylinder('Rain shower head',(2.42,y,2.37),.145,.035,metal)
    points=[(2.42,y,2.350)]+[(2.42+.128*math.cos(a*2*math.pi/32),y+.128*math.sin(a*2*math.pi/32),2.350) for a in range(32)]
    face=mesh('Textured spray plate',points,[(0,1+(i+1)%32,1+i) for i in range(32)],nozzle)
    uv=face.data.uv_layers.new()
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            p=face.data.vertices[face.data.loops[li].vertex_index].co;uv.data[li].uv=((p.x-2.42)/.256+.5,(p.y-y)/.256+.5)
    for z in [1.2,2.1]:cylinder('Pipe wall collar',(2.866,y,z),.035,.065,metal,'X')
    cylinder('Thermostatic mixer bar',(2.73,y,1.10),.037,.25,metal,'Y')
    for dy in [-.15,.15]:
        cylinder('Shower control knob',(2.73,y+dy,1.10),.044,.055,metal,'Y')
        box('Control index mark',(2.691,y+dy,1.11),(.004,.025,.006),dark,.001)
    # Raised perimeter transitions to a shallow sloped dish, then a recessed grate.
    verts=[];faces=[]
    rings=[(.825,.875,.055),(.785,.835,.052),(.18,.18,.044),(.085,.085,.008)]
    for rx,ry,z in rings:
        for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]:verts.append((2+rx*dx,y+ry*dy,z))
    for j in range(3):
        for i in range(4):a=j*4+i;b=j*4+(i+1)%4;faces.append((a,b,b+4,a+4))
    # Rim skirt closes the tray down to the existing tiled deck.
    for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]:verts.append((2+.825*dx,y+.875*dy,.001))
    for i in range(4):faces.append((i,16+i,16+(i+1)%4,(i+1)%4))
    mesh('Shower floor sloping to recessed drain',verts,faces,ceramic)
    box('Drain well',(2,y,.004),(.17,.17,.006),dark,.002)
    for dx in [-.06,-.03,0,.03,.06]:box('Drain grate slat',(2+dx,y,.009),(.014,.145,.009),metal,.002)

# Save editable kit and a studio render; previews are not deployed.
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-7,-8,7));camera=move(bpy.context.object,studio);aim(camera,(0,0,1));camera.data.type='ORTHO';camera.data.ortho_scale=7.7;scene.camera=camera
floor=box('Studio floor',(0,0,-.02),(200,200,.035),mat('Studio floor',(.17,.20,.18)),0);move(floor,studio)
for pos,e in [((-2,-3,6),650),((4,-1,5),500),((0,4,5),600)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=move(bpy.context.object,studio);o.data.energy=e;o.data.size=5;aim(o,(0,0,.8))
scene.world=bpy.data.worlds.new('Preview ambient');scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(HERE/'bathroom-preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=asset.objects[0]
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bathroom.blend'));bpy.ops.render.render(write_still=True)
bpy.ops.object.convert(target='MESH')
for m in [ceramic,metal,panel,dark,linen,mirror,nozzle]:
    bpy.ops.object.select_all(action='DESELECT');parts=[o for o in asset.objects if o.data.materials[0]==m]
    for o in parts:o.select_set(True)
    if parts:
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name=m.name+' — shared batch'
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'bathroom.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False)
print('BATHROOM KIT SAVED AND EXPORTED')
