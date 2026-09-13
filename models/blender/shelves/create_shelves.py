"""Seamless, original shelf kit. Fixed book/address contract; Blender Z is up."""
from pathlib import Path
import bpy, math
from mathutils import Vector
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def material(name,h):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;return m
wood=material('Timber','544b3d');binding=material('Binding','987953');paper=material('Pages','b59b59')
def mesh(name,vertices,faces,mats):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    for m in mats:data.materials.append(m)
    return o
# Extrusion along X: chamfer only the long edges, never the mating end faces.
def board(name,width):
    d=.25;h=.02;r=.0015;cross=[(-d,-h+r),(-d+r,-h),(d-r,-h),(d,-h+r),(d,h-r),(d-r,h),(-d+r,h),(-d,h-r)]
    v=[(x,y,z) for x in [-width/2,width/2] for y,z in cross];f=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    return mesh(name,v,f,[wood])
def upright(name):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.dimensions=(.055,.5,3.25);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(wood)
    b=o.modifiers.new('Small softened edges','BEVEL');b.width=.0015;b.segments=1;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
# Rounded front spine corners: six-sided extrusion, just 20 triangles per book.
x=.037/2;d=.15;r=.0015
cross=[(-x,-d),(x,-d),(x,d-r),(x-r,d),(-x+r,d),(-x,d-r)]
v=[(a,b,z) for z in [-.17,.17] for a,b in cross];f=[tuple(reversed(range(6))),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
book=mesh('ShelfBook',v,f,[binding,paper]);book.data.polygons[0].material_index=1;book.data.polygons[1].material_index=1
# UVs map the same binding and fine rules used by the runtime and distant atlas.
uv=book.data.uv_layers.new(name='Binding UV')
for poly in book.data.polygons:
    for li in poly.loop_indices:
        co=book.data.vertices[book.data.loops[li].vertex_index].co
        uv.data[li].uv=((co.x+x)/.037,(co.y+d)/.3 if poly.index<2 else (co.z+.17)/.34)
import numpy as np
img=bpy.data.images.new('Inset page edges',width=64,height=256)
a=np.zeros((256,64,4),dtype=np.float32);a[:]=binding.diffuse_color;a[3:245,3:61]=paper.diffuse_color
for row in range(5,245,4):a[row,3:61,:3]*=.86
img.pixels.foreach_set(a.ravel());img.pack()
tex=paper.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;paper.node_tree.links.new(tex.outputs['Color'],paper.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
prototypes=[book,board('ShelfBoard',22.86),upright('ShelfUpright')]
# One bay is the repeat unit; the start variant omits the first shared upright,
# supplied instead by the permanent end cap. No doubled seam columns.
for name,start in [('ShelfModule',0),('ShelfModuleStart',1)]:
    parts=[]
    for row in range(8):
        o=board(name+'_board_'+str(row),22.86);o.location.z=.11+row*.39-1.63;parts.append(o)
    for j in range(start,8):
        o=upright(name+'_support_'+str(j));o.location.x=j*22.86/8-22.86/2;parts.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();o=bpy.context.object;o.name=name
    # Bake the board's origin translation into its vertices; root stays centred.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);prototypes.append(o)
# Export prototypes, no studio objects, embedded materials only.
for o in prototypes:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.export_scene.gltf(filepath=str(HERE/(o.name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False)
    o.hide_render=True
# Editable full bay showcase, books share one mesh datablock.
for i in range(2):
    src=next(o for o in prototypes if o.name=='ShelfModuleStart' if i==0) if i==0 else next(o for o in prototypes if o.name=='ShelfModule')
    o=src.copy();scene.collection.objects.link(o);o.hide_render=False;o.location=(i*22.86,0,1.63)
for end in [-22.86/2,22.86*1.5]:
    o=prototypes[2].copy();scene.collection.objects.link(o);o.hide_render=False;o.location=(end,0,1.63)
for row in range(8):
    for n in range(570):
        o=book.copy();scene.collection.objects.link(o);o.hide_render=False;o.location=(-22.86/2+(n+.5)*22.86/570,.04,.30+row*.39)
# Top and bottom continuous rails match the runtime trim.
for z,h in [(3.28,.10),(.045,.09)]:
    o=board('Continuous trim',22.86);o.scale.z=h/.04;o.location.z=z
bpy.ops.object.camera_add(location=(-7,7,3.2));cam=bpy.context.object;cam.rotation_euler=(Vector((-9,0,1.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.8;scene.camera=cam
for pos in [(-9,3,5),(-5,0,4)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=250;o.data.size=5;o.rotation_euler=(Vector((-9,0,1.6))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Studio');scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.3,.3,.3,1)
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.device='CPU';scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.filepath=str(HERE/'shelf-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'shelves.blend'))
bpy.ops.render.render(write_still=True)
