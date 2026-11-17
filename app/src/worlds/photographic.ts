/** One bounded GLSL finish over the actual 3D scene. No video, baked background or external texture. */
import { HalfFloatType, Vector2, Vector3, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export function createPhotographicFinish(renderer: WebGLRenderer, scene: Scene, camera: Camera, grade: { shadows: readonly number[]; highlights: readonly number[] } = { shadows: [-.008,.009,.012], highlights: [.016,.006,-.009] }) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  const base = new RenderPass(scene, camera);
  const finish = new ShaderPass({
    name: 'AftermathPhotographicFinish',
    uniforms: { tDiffuse: { value: null }, resolution: { value: new Vector2(1, 1) }, shadowTint: { value: new Vector3(...grade.shadows) }, highlightTint: { value: new Vector3(...grade.highlights) } },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform vec3 shadowTint;
      uniform vec3 highlightTint;
      varying vec2 vUv;
      vec3 bright(vec2 uv){ return max(texture2D(tDiffuse, clamp(uv,0.0,1.0)).rgb-vec3(1.0),vec3(0.0)); }
      float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec3 color=texture2D(tDiffuse,vUv).rgb;
        vec2 px=vec2(2.8)/resolution;
        vec3 halo=(bright(vUv+vec2(px.x,0.0))+bright(vUv-vec2(px.x,0.0))
          +bright(vUv+vec2(0.0,px.y))+bright(vUv-vec2(0.0,px.y)))*0.25;
        color+=halo*vec3(0.075,0.052,0.035);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        color=gl_FragColor.rgb;
        float luma=dot(color,vec3(0.2126,0.7152,0.0722));
        color+=shadowTint*(1.0-smoothstep(0.1,0.55,luma));
        color+=highlightTint*smoothstep(0.45,0.95,luma);
        vec2 centered=vUv-0.5;
        color*=1.0-0.15*smoothstep(0.12,0.5,dot(centered,centered));
        // Stable fine grain: no flashing or motion when reduced motion is requested.
        float grain=noise(floor(vUv*resolution))-0.5;
        color+=grain*0.014*(0.35+0.65*(1.0-luma));
        gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
      }`,
  });
  composer.addPass(base); composer.addPass(finish);
  return {
    resize(width: number, height: number): void {
      const dpr = renderer.getPixelRatio(); composer.setPixelRatio(dpr); composer.setSize(width, height);
      (finish.uniforms['resolution']!.value as Vector2).set(width * dpr, height * dpr);
    },
    render(): void { composer.render(0); },
    dispose(): void { base.dispose(); finish.dispose(); composer.dispose(); },
  };
}
