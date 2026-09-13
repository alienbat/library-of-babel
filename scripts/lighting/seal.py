"""Share identical periodic/terminal sample planes after independent Monte Carlo bakes.
This removes estimator noise seams; it does not add light or ambient occlusion.
"""
import json,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'lib/game/baked'
fields={name:json.loads((ROOT/f'{name}.json').read_text()) for name in ['gallery','rooms','top','final','bottom']}
buffers={name:{k:bytearray(base64.b64decode(f[k])) for k in ['positive','negative']} for name,f in fields.items()}
for name in ['gallery','rooms']:
 nx,ny,nz=fields[name]['grid']
 for data in buffers[name].values():
  for z in range(nz):
   for i in range(ny if name=='gallery' else nx):
    a=((z*ny+i)*nx)*4 if name=='gallery' else ((z*ny)*nx+i)*4
    b=a+(nx-1)*4 if name=='gallery' else a+(ny-1)*nx*4
    for c in range(3):data[a+c]=data[b+c]=round((data[a+c]+data[b+c])/2)
nx,ny,nz=fields['rooms']['grid']
for name in ['top','final','bottom']:
 for key,data in buffers[name].items():
  # Enclosed bedroom and bathroom cells retain one shared bake on every floor.
  for z in range(nz):
   for y in range(ny):
    for x in range(nx):
     if x/(nx-1)*32>=15.5:
      i=((z*ny+y)*nx+x)*4;data[i:i+4]=buffers['rooms'][key][i:i+4]
for key,data in buffers['final'].items():
 for z in range(nz):
  for x in range(nx):
   a=((z*ny+ny-1)*nx+x)*4;b=(z*ny*nx+x)*4
   data[a:a+4]=buffers['top'][key][b:b+4]
for name,field in fields.items():
 for key,data in buffers[name].items():field[key]=base64.b64encode(data).decode()
 (ROOT/f'{name}.json').write_text(json.dumps(field,separators=(',',':')))
# Record the exact transport-scene input alongside every committed bake.
import hashlib
for path in ROOT.glob('*.json'):
 field=json.loads(path.read_text())
 variant='top' if path.stem in ['top','final','boundaryCeiling'] else 'bottom' if path.stem in ['bottom','boundaryFloor'] else 'normal'
 source=ROOT.parents[2]/'scripts/lighting/generated'/f'{variant}.json'
 field['sceneSHA256']=hashlib.sha256(source.read_bytes()).hexdigest()
 path.write_text(json.dumps(field,separators=(',',':')))
