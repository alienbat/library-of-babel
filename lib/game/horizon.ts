import * as T from 'three';
import {HEIGHT,OUTER,BAY,type WorldLimits} from './physics.ts';
import {LIGHT_PERIOD} from './lighting.ts';
export const HORIZON_BLEND_START=3500,HORIZON_BLEND_END=6500;
/** One background triangle analytically projects infinitely repeating galleries. */
export function createInfiniteHorizon(scene:T.Scene,spines:T.Texture,negative:T.Data3DTexture){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const material=new T.ShaderMaterial({depthTest:true,depthWrite:false,toneMapped:true,
    uniforms:{corner:{value:new T.Vector4()},inverseProjection:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},spines:{value:spines},bakedNegative:{value:negative},shelfMean:{value:new T.Color('#806849')},slabColor:{value:new T.Color('#aaa99c')}},
    vertexShader:`varying vec2 screenPoint;void main(){screenPoint=position.xy;gl_Position=vec4(position.xy,1.0,1.0);}`,
    fragmentShader:`
      uniform mat4 inverseProjection,cameraWorld;
      uniform vec4 corner;
      uniform sampler2D spines;
      uniform highp sampler3D bakedNegative;
      uniform vec3 shelfMean,slabColor;
      varying vec2 screenPoint;
      // Pixel coverage of a repeated band, with a stable mean below pixel size.
      float band(float phase,float start,float width,float footprint){
        float p=fract(phase-start);
        float w=max(footprint,.00001);
        float a=p-w*.5,b=p+w*.5;
        float integralA=floor(a)*width+min(fract(a),width);
        float integralB=floor(b)*width+min(fract(b),width);
        return mix(clamp((integralB-integralA)/w,0.0,1.0),width,smoothstep(.4,1.0,w));
      }
      void main(){
        vec3 view=normalize((inverseProjection*vec4(screenPoint,1.0,1.0)).xyz);
        vec3 ray=mat3(cameraWorld)*view;
        vec3 eye=cameraWorld[3].xyz;
        float side=ray.z<0.0?-1.0:1.0;
        // Saturate only numerical coordinates; never leave a background hole at parallel rays.
        float travel=min(1.e7,abs(side*${OUTER}-eye.z)/max(abs(ray.z),1.e-8));
        vec3 hit=eye+ray*travel;
        vec2 phase=vec2(hit.x/${BAY},hit.y/${HEIGHT});
        vec2 footprint=fwidth(phase);
        float unresolved=smoothstep(.2,1.0,max(footprint.x*8.0,footprint.y));
        float shelf=band(phase.y,.03/${HEIGHT},3.18/${HEIGHT},footprint.y);
        float deck=band(phase.y,1.0-.34/${HEIGHT},.34/${HEIGHT},footprint.y);
        vec2 uv=vec2(-side*phase.x,(fract(phase.y)*${HEIGHT}-.03)/3.18);
        vec3 grain=texture2D(spines,uv).rgb;
        grain=mix(grain,shelfMean,unresolved);
        vec3 lookup=vec3(hit.x/${LIGHT_PERIOD},(fract(phase.y)*31.0+.5)/32.0,15.5/16.0);
        float light=texture(bakedNegative,lookup).b*4.0;
        light=mix(light,.85,unresolved);
        vec3 color=vec3(.07,.073,.064);
        color=mix(color,grain*light*vec3(1.0,.97,.89),shelf);
        color=mix(color,slabColor*.58*vec3(1.0,.97,.89),deck);
        // Ceiling strips occupy only their true fraction of a pixel at infinity.
        float lamp=band(phase.y,(${HEIGHT}-.40)/${HEIGHT},.04/${HEIGHT},footprint.y)
          *band(hit.x/${LIGHT_PERIOD},(3.81-.8)/${LIGHT_PERIOD},1.6/${LIGHT_PERIOD},fwidth(hit.x/${LIGHT_PERIOD}));
        color=mix(color,vec3(2.0,1.8,1.35),lamp);
        float capDistance=1.e20;
        if(corner.z!=0.0&&abs(ray.x)>1.e-8){float t=(corner.x-eye.x)/ray.x;if(t>0.0)capDistance=min(capDistance,t);}
        if(corner.w!=0.0&&abs(ray.y)>1.e-8){float t=(corner.y-eye.y)/ray.y;if(t>0.0)capDistance=min(capDistance,t);}
        if(capDistance<travel)color=slabColor*.7;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(geometry,material);mesh.name='infinite-gallery-horizon';mesh.frustumCulled=false;mesh.renderOrder=10000;scene.add(mesh);
  return {setLimits(limits:WorldLimits){material.uniforms.corner.value.set(limits.minX??limits.maxX??0,limits.minY??limits.maxY??0,limits.minX!==undefined?1:limits.maxX!==undefined?-1:0,limits.minY!==undefined?1:limits.maxY!==undefined?-1:0);},update(camera:T.Camera){material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);material.uniforms.cameraWorld.value.copy(camera.matrixWorld);},dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
/** Screen-door coverage preserves opaque depth ordering while handing off to the backdrop. */
export function withHorizonFade(source:T.MeshBasicMaterial){
  const material=source.clone(),shade=source.onBeforeCompile.bind(source);
  material.onBeforeCompile=(shader,renderer)=>{
    shade(shader,renderer);
    shader.vertexShader='varying vec3 horizonWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 horizonPoint=vec4(position,1.0);
      #ifdef USE_INSTANCING
        horizonPoint=instanceMatrix*horizonPoint;
      #endif
      horizonWorld=(modelMatrix*horizonPoint).xyz;
    `);
    shader.fragmentShader='varying vec3 horizonWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float horizonFade=smoothstep(${HORIZON_BLEND_START}.0,${HORIZON_BLEND_END}.0,length(horizonWorld-cameraPosition));
      vec2 pixel=mod(floor(gl_FragCoord.xy),4.0);
      float low=mod(pixel.x,2.0)*2.0+mod(pixel.x+pixel.y,2.0);
      float high=floor(pixel.x/2.0)*2.0+mod(floor(pixel.x/2.0)+floor(pixel.y/2.0),2.0);
      if(horizonFade>(low*4.0+high+.5)/16.0)discard;
    `);
  };
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-infinite-handoff-v1';return material;
}
