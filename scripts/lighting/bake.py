"""Offline Cycles irradiance field. Run after export.ts; no runtime tracing or AO.
Receivers are UV-isolated white diffuse patches invisible to transport rays.
The exported runtime architecture is the occluder, including terminal stair shells.
"""
import bpy,json,math,time,base64,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'lib/game/baked';OUT.mkdir(exist_ok=True)
SAMPLES=int(__import__('os').environ.get('BAKE_SAMPLES','1024'))
H=3.96;INNER=15.24;OUTER=18.8976
configs={'gallery':('normal',(64,32,16)), 'rooms':('normal',(160,32,32)), 'top':('top',(160,32,32)), 'final':('top',(160,32,32)), 'bottom':('bottom',(160,32,32)), 'boundaryFloor':('bottom',(32,1,32)), 'boundaryCeiling':('top',(32,1,32)), 'boundaryWall':('normal',(32,1,32))}
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else configs
for name in selected:
 variant,grid=configs[name];start=time.time()
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=SAMPLES
 scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=6;scene.cycles.glossy_bounces=0
 scene.world=bpy.data.worlds.new('Black world');scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL';prefs.get_devices()
  for d in prefs.devices:d.use=d.type=='METAL'
  scene.cycles.device='GPU'
 except Exception:scene.cycles.device='CPU'
 source=json.loads((ROOT/f'scripts/lighting/generated/{variant}.json').read_text())
 verts=[];faces=[];mat_indices=[];materials=[]
 def convert(p):return (p[0],-p[2],p[1])
 # Mirror Three Y-up to Blender Z-up with a proper rotation.
 for batch in source['meshes']:
  mi=len(materials)
  for m in batch['materials']:
   mat=bpy.data.materials.new(m['name'] or 'Surface');bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*m['color'],1);bsdf.inputs['Roughness'].default_value=1;materials.append(mat)
  coords=[Vector(batch['positions'][i:i+3]) for i in range(0,len(batch['positions']),3)]
  for transform in batch['transforms']:
   if name=='boundaryWall' and transform[12]<0:continue
   matrix=Matrix([transform[i:i+4] for i in range(0,16,4)]).transposed();offset=len(verts)
   verts.extend(convert(matrix@p) for p in coords)
   for i in range(0,len(batch['indices']),3):
    faces.append(tuple(offset+j for j in batch['indices'][i:i+3]))
    group=next((g for g in batch['groups'] if g['start']<=i<g['start']+g['count']),{'materialIndex':0});mat_indices.append(mi+group['materialIndex'])
 mesh=bpy.data.meshes.new('Runtime transport geometry');mesh.from_pydata(verts,[],faces);mesh.update()
 geometry=bpy.data.objects.new('Actual library architecture',mesh);scene.collection.objects.link(geometry)
 for m in materials:mesh.materials.append(m)
 for p,i in zip(mesh.polygons,mat_indices):p.material_index=i
 bvh=BVHTree.FromPolygons([Vector(v) for v in verts],faces,all_triangles=True)
 for x,y,z,w,d in source['lights']:
  bpy.ops.object.light_add(type='AREA',location=convert((x,y-.023,z)))
  lamp=bpy.context.object;lamp.data.energy=150;lamp.data.shape='RECTANGLE';lamp.data.size=w;lamp.data.size_y=d
 if name.startswith('boundary'):
  wall_mode=name=='boundaryWall';top_mode=name=='boundaryCeiling';height=3.62 if top_mode else 0
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-0,0) if wall_mode else (10,0,height+(.17 if top_mode else -.17)))
  plane=bpy.context.object;plane.name='Terminal boundary';plane.dimensions=(.34,30.48,40) if wall_mode else (140,30.48,.34)
  if wall_mode:plane.location.x=-.17
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  plane.data.materials.append(materials[0])
  for i in range(-3,5):
   for z in [-7.62,7.62]:
    position=(.04,i*15.84+7.92,z) if wall_mode else (i*15.24+7.62,height+(-.04 if top_mode else .04),z)
    bpy.ops.object.light_add(type='AREA',location=convert(position));lamp=bpy.context.object
    lamp.data.energy=150;lamp.data.shape='RECTANGLE';lamp.data.size=1.6;lamp.data.size_y=.2
    if wall_mode:lamp.rotation_euler[1]=-math.pi/2
    elif not top_mode:lamp.rotation_euler[0]=math.pi
 # Sample the free space on each side of surfaces instead of the inside of a slab.
 # This prevents trilinear interpolation from blending solid-space black texels.
 def relocate(p):
  p=Vector(convert(p))
  for _ in range(5):
   hit=bvh.find_nearest(p)
   if not hit[0]:break
   q,n,_,dist=hit
   if (p-q).dot(n)>=.025:break
   p=q+n*.025
  return p
 nx,ny,nz=grid;count=nx*ny*nz;tile=2;cols=math.ceil(math.sqrt(count*6));size=cols*tile
 rv=[];rf=[];uvs=[]
 # Axis directions in Three space, transformed into Blender.
 normals=[Vector(convert(v)) for v in [(1,0,0),(0,1,0),(0,0,1),(-1,0,0),(0,-1,0),(0,0,-1)]]
 for z in range(nz):
  for y in range(ny):
   for x in range(nx):
    if name.startswith('boundary'):
     p=(.025,(x+.5)/nx*15.84,(z+.5)/nz*15.24) if name=='boundaryWall' else ((x+.5)/nx*15.24,3.595 if name=='boundaryCeiling' else .025,(z+.5)/nz*15.24)
    elif name=='gallery':p=((x+.5)/nx*7.62+45.72,min(3.60,max(.025,y/(ny-1)*H)),INNER+z/(nz-1)*(OUTER-INNER))
    else:p=(x/(nx-1)*32,y/(ny-1)*H-(H if name=='final' else 0),OUTER+z/(nz-1)*6.5)
    p=relocate(p)
    for n in normals:
     u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized();v=n.cross(u)
     k=len(rf);off=len(rv)
     rv.extend(tuple(p+(a*u+b*v)*.001) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)])
     rf.append((off,off+1,off+2,off+3));tx=k%cols*tile;ty=k//cols*tile
     uvs.extend([(tx/size,ty/size),((tx+tile)/size,ty/size),((tx+tile)/size,(ty+tile)/size),(tx/size,(ty+tile)/size)])
 mesh=bpy.data.meshes.new('Directional receiver patches');mesh.from_pydata(rv,[],rf);mesh.update();uv=mesh.uv_layers.new(name='ProbeUV')
 for loop,value in zip(uv.data,uvs):loop.uv=value
 receiver=bpy.data.objects.new('Irradiance receivers',mesh);scene.collection.objects.link(receiver)
 receiver.visible_shadow=False;receiver.visible_diffuse=False;receiver.visible_glossy=False;receiver.visible_transmission=False
 mat=bpy.data.materials.new('Unit diffuse reflectance');mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(1,1,1,1)
 image=bpy.data.images.new('Linear irradiance',width=size,height=size,float_buffer=True);node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node;mesh.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
 scene.render.bake.margin=0;scene.render.bake.use_pass_color=False;scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True
 print('BAKING',name,grid,size,SAMPLES,flush=True);bpy.ops.object.bake(type='DIFFUSE')
 pixels=list(image.pixels);positive=bytearray(count*4);negative=bytearray(count*4)
 for probe in range(count):
  for axis in range(6):
   k=probe*6+axis;tx=k%cols*tile;ty=k//cols*tile
   values=[sum(pixels[((ty+dy)*size+tx+dx)*4+c]*weight for c,weight in enumerate((.2126,.7152,.0722))) for dy in range(tile) for dx in range(tile)]
   value=sum(values)/len(values)
   (positive if axis<3 else negative)[probe*4+axis%3]=round(min(4,max(0,value))/4*255)
  positive[probe*4+3]=negative[probe*4+3]=255
 result={'grid':grid,'range':4,'positive':base64.b64encode(positive).decode(),'negative':base64.b64encode(negative).decode(),'samples':SAMPLES,'diffuseBounces':6,'seconds':round(time.time()-start,2),'engine':'Blender Cycles','extraAO':False}
 (OUT/f'{name}.json').write_text(json.dumps(result,separators=(',',':')))
 print('DONE',name,result['seconds'],max(positive),flush=True)
