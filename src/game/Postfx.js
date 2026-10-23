import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'

// Colour grade + vignette + subtle film grain (applied in linear space before OutputPass)
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uNight: { value: 0 }, uVignette: { value: 0.6 }, uSat: { value: 1.18 }, uContrast: { value: 1.04 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uNight, uVignette, uSat, uContrast; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // warm highlights / cool shadows
      vec3 warm = vec3(1.08, 1.0, 0.88), cool = vec3(0.9, 0.95, 1.1);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= mix(cool, warm, clamp(l * 1.5, 0.0, 1.0));
      col = mix(col, col * vec3(0.85, 0.9, 1.15), uNight * 0.5);
      col = (col - 0.5) * uContrast + 0.5;
      col = col * 0.96 + 0.012;
      float g = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(g), col, uSat);
      vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVignette * 2.2;
      col *= clamp(v, 0.0, 1.0);
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.018;
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
}

export function createPostfx(renderer, scene, camera, quality) {
  const size = renderer.getSize(new THREE.Vector2())
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 })
  const composer = new EffectComposer(renderer, rt)
  composer.addPass(new RenderPass(scene, camera))
  const gtao = null
  let bloom = null
  if (quality !== 'low') { bloom = new UnrealBloomPass(size, 0.18, 0.25, 0.9); composer.addPass(bloom) }
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)
  composer.addPass(new OutputPass())
  let smaa = null
  if (quality !== 'low') { smaa = new SMAAPass(); composer.addPass(smaa) }
  return {
    composer, grade, bloom, gtao,
    resize(w, h) { composer.setSize(w, h); gtao && gtao.setSize(w, h); smaa && smaa.setSize(w, h) },
    render(dt, night) { grade.uniforms.uTime.value += dt; grade.uniforms.uNight.value = night; composer.render() },
  }
}
