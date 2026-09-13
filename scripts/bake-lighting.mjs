import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const mac='/Applications/Blender.app/Contents/MacOS/Blender';
const blender=process.env.BLENDER??(existsSync(mac)?mac:'blender');
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
run(process.execPath,['--experimental-strip-types','scripts/lighting/export.ts']);
run(blender,['--background','--python-exit-code','1','--python','scripts/lighting/bake.py']);
run(process.env.PYTHON??'python3',['scripts/lighting/seal.py']);
