"""Share identical periodic/terminal sample planes after independent Monte Carlo bakes.
This removes estimator noise seams; it does not add light or ambient occlusion.
"""
import json,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'lib/game/baked'
fields={name:json.loads((ROOT/f'{name}.json').read_text()) for name in ['rooms','top','final','bottom']}
buffers={name:{k:bytearray(base64.b64decode(f[k])) for k in ['positive','negative']} for name,f in fields.items()}
nx,ny,nz=fields['rooms']['grid']
for data in buffers['rooms'].values():
 for z in range(nz):
  for x in range(nx):
   a=((z*ny)*nx+x)*4;b=a+(ny-1)*nx*4
   for c in range(3):data[a+c]=data[b+c]=round((data[a+c]+data[b+c])/2)
# Gallery probes are periodic cell centers, not duplicate endpoint planes.
# Their Gaussian filter wraps in bake.py; averaging endpoints shifts shadows.
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
# Provenance is recorded by bake.py only when that field is actually baked.
