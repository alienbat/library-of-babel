import * as T from 'three';
import {BOUNDARY_GLSL} from './boundary-lighting.ts';
import {galleryAverages,galleryProfile} from './horizon-average.ts';
import {HEIGHT,INNER,OUTER,BAY,type WorldLimits} from './physics.ts';
import {LIGHT_PERIOD} from './lighting.ts';
export const HORIZON_BLEND_START=3500,HORIZON_BLEND_END=6500;
/** One background triangle analytically projects infinitely repeating galleries. */
export function createInfiniteHorizon(scene:T.Scene,spines:T.Texture,negative:T.Data3DTexture,boundaryUniforms?:Record<string,T.IUniform>,positive?:T.Data3DTexture,carpet?:T.Texture){
  const average=galleryAverages(spines,negative,positive,carpet);
  const profile=galleryProfile(spines,negative,positive,carpet);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  // Vector4 defaults w to 1, which would enable a phantom bottom boundary on fresh load.
  const material=new T.ShaderMaterial({depthTest:true,depthWrite:false,toneMapped:true,
    uniforms:{boundaryLightMean:{value:0},galleryProfile:{value:profile},boundaryCarpet:{value:spines},boundaryLight:{value:spines},boundaryFloorColor:{value:new T.Color('#b1b1a7')},boundaryCeilingColor:{value:new T.Color('#aaa99c')},boundaryWallColor:{value:new T.Color('#a8a69a')},...boundaryUniforms,corner:{value:new T.Vector4(0,0,0,0)},inverseProjection:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},spines:{value:spines},bakedNegative:{value:negative},shelfMean:{value:average.shelf},faceMean:{value:average.face},edgeMean:{value:average.edge},ceilingMean:{value:average.ceiling},floorMean:{value:average.floor},railFront:{value:average.railFront},railUp:{value:average.railUp},railDown:{value:average.railDown},slabColor:{value:new T.Color('#aaa99c')}},
    vertexShader:`varying vec2 screenPoint;void main(){screenPoint=position.xy;gl_Position=vec4(position.xy,1.0,1.0);}`,
    fragmentShader:`
      ${BOUNDARY_GLSL}
      uniform mat4 inverseProjection,cameraWorld;
      uniform vec4 corner;
      uniform sampler2D spines,galleryProfile;
      uniform highp sampler3D bakedNegative;
      uniform vec3 shelfMean,slabColor,faceMean,edgeMean,ceilingMean,floorMean,railFront,railUp,railDown;
      varying vec2 screenPoint;
      // Pixel coverage of a repeated band, with a stable mean below pixel size.
      float band(float phase,float start,float width,float footprint){
        float p=fract(phase-start);
        float w=clamp(footprint,.00001,1.0);
        float a=p-w*.5,b=p+w*.5;
        float integralA=floor(a)*width+min(fract(a),width);
        float integralB=floor(b)*width+min(fract(b),width);
        return mix(clamp((integralB-integralA)/w,0.0,1.0),width,smoothstep(.4,1.0,w));
      }
      // First-hit radiance of the actual periodic cross-section, prefiltered in linear light.
      vec3 distantMean(vec3 r){
        float slope=r.y/max(abs(r.z),1.e-20);
        float u=.5+.5*sign(slope)*min(1.0,log2(1.0+abs(slope))/16.0);
        return texture2D(galleryProfile,vec2((u*512.0+.5)/513.0,.5)).rgb;
      }
      void main(){
        vec3 view=normalize((inverseProjection*vec4(screenPoint,1.0,1.0)).xyz);
        vec3 ray=mat3(cameraWorld)*view;
        vec3 eye=cameraWorld[3].xyz;
        float side=ray.z<0.0?-1.0:1.0;
        vec3 rx=dFdx(ray),ry=dFdy(ray);
        float angularZ=abs(rx.z)+abs(ry.z),az=abs(ray.z);
        float wallDistance=abs(side*${OUTER}-eye.z);
        // Quotient-rule derivatives do not cancel across the two vanishing galleries.
        float denominator=max(az*az,1.e-20);
        vec2 footprint=wallDistance*(abs(ray.z*rx.xy-ray.xy*rx.z)+abs(ray.z*ry.xy-ray.xy*ry.z))/denominator/vec2(${BAY},${HEIGHT});
        float farBlend=max(smoothstep(.35,1.5,footprint.y),1.0-smoothstep(.25,.75,az/max(angularZ,1.e-20)));
        // Bound only the unused detailed sample by its angular pixel footprint.
        // There is no finite-distance end plane or distance-based darkening.
        float travel=wallDistance/max(az,max(angularZ*.25,1.e-8));
        vec3 hit=eye+ray*travel;
        vec2 phase=vec2(hit.x/${BAY},hit.y/${HEIGHT});
        float unresolved=smoothstep(.2,1.0,max(footprint.x*8.0,footprint.y));
        float shelf=band(phase.y,.03/${HEIGHT},3.18/${HEIGHT},footprint.y);
        float deck=band(phase.y,1.0-.34/${HEIGHT},.34/${HEIGHT},footprint.y);
        vec2 uv=vec2(-side*phase.x,(fract(phase.y)*${HEIGHT}-.03)/3.18);
        vec3 grain=texture2D(spines,uv).rgb;
        grain=mix(grain,shelfMean,unresolved);
        vec3 lookup=vec3(hit.x/${LIGHT_PERIOD},(fract(phase.y)*31.0+.5)/32.0,15.5/16.0);
        float light=texture(bakedNegative,lookup).b*4.0;
        light=mix(light,.85,unresolved);
        vec3 color=vec3(${new T.Color('#a8a69a').toArray().join(',')})*light*vec3(1.0,.97,.89);
        color=mix(color,grain*light*vec3(1.0,.97,.89),shelf);
        color=mix(color,slabColor*.58*vec3(1.0,.97,.89),deck);
        // Ceiling luminaires belong to deck surfaces, never the opaque wall header.
        // Four cheap quadrature samples integrate the pixel straddling ray.z == 0.
        // The exactly empty parallel ray has zero area, so it creates no black stripe.
        vec3 pixelMean=(distantMean(ray+.288675*(rx+ry))+distantMean(ray+.288675*(rx-ry))
          +distantMean(ray+.288675*(-rx+ry))+distantMean(ray-.288675*(rx+ry)))*.25;
        color=mix(color,pixelMean,farBlend);
        float capDistance=1.e20,capKind=2.0;
        if(corner.z!=0.0&&abs(ray.x)>1.e-8){float t=(corner.x-eye.x)/ray.x;if(t>0.0)capDistance=min(capDistance,t);}
        if(corner.w!=0.0&&abs(ray.y)>1.e-8){float t=(corner.y-eye.y)/ray.y;if(t>0.0&&t<capDistance){capDistance=t;capKind=corner.w>0.0?0.0:1.0;}}
        if(capDistance<1.e20&&capDistance*az<abs(side*${INNER} -eye.z))color=boundaryShade(eye+ray*capDistance,capKind);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(geometry,material);mesh.name='infinite-gallery-horizon';mesh.frustumCulled=false;mesh.renderOrder=10000;scene.add(mesh);
  return {setLimits(limits:WorldLimits){material.uniforms.corner.value.set(limits.minX??limits.maxX??0,limits.minY??limits.maxY??0,limits.minX!==undefined?1:limits.maxX!==undefined?-1:0,limits.minY!==undefined?1:limits.maxY!==undefined?-1:0);},update(camera:T.Camera){material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);material.uniforms.cameraWorld.value.copy(camera.matrixWorld);},dispose(){scene.remove(mesh);geometry.dispose();material.dispose();profile.dispose();}};
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
      vec3 delta=horizonWorld-cameraPosition;
      float distanceToEye=length(delta);
      vec3 sight=delta/max(distanceToEye,.0001);
      vec3 dx=dFdx(sight),dy=dFdy(sight);
      float wallDistance=abs((sight.z<0.0?-${OUTER}:${OUTER})-cameraPosition.z);
      float cellFootprint=wallDistance*(abs(sight.z*dx.y-sight.y*dx.z)+abs(sight.z*dy.y-sight.y*dy.z))/max(sight.z*sight.z,1.e-20)/${HEIGHT};
      float floorPixels=1.0/max(cellFootprint,1.e-8);
      float horizonFade=max(smoothstep(${HORIZON_BLEND_START}.0,${HORIZON_BLEND_END}.0,distanceToEye),1.0-smoothstep(.5,2.0,floorPixels));
      vec2 pixel=mod(floor(gl_FragCoord.xy),4.0);
      float low=mod(pixel.x,2.0)*2.0+mod(pixel.x+pixel.y,2.0);
      float high=floor(pixel.x/2.0)*2.0+mod(floor(pixel.x/2.0)+floor(pixel.y/2.0),2.0);
      if(horizonFade>(low*4.0+high+.5)/16.0)discard;
    `);
  };
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-infinite-handoff-v1';return material;
}
