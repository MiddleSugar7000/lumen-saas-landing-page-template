// Lumen: one persistent WebGL scene, choreographed by scroll.
// Liquid chrome core + glass halo ring + chrome orbits + 3-stage morphing particle field.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 900;

const ACCENT = new THREE.Color('#ff6a2b');
const BG = new THREE.Color('#07080b');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
// Render-resolution budget: never shade more than ~2.1M pixels (≈1080p), whatever the screen.
// On a 1440p/4K monitor with Windows scaling the raw DPR would mean 6-8M pixels per pass.
const MAX_PIXELS = isMobile() ? 1.1e6 : 2.1e6;
let quality = 1; // lowered automatically if frames run long
const targetDpr = () => {
  const budget = Math.sqrt(MAX_PIXELS / (innerWidth * innerHeight));
  return Math.max(0.5, Math.min(devicePixelRatio, isMobile() ? 1.5 : 1.25, budget) * quality);
};
renderer.setPixelRatio(targetDpr());
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor(BG, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = BG;
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);

// ---------- Studio environment: softboxes, warm rim, faint cool fill ----------
function buildEnv() {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#050507');
  const box = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); if (rot) m.rotation.set(...rot); m.lookAt(0, 0, 0); env.add(m);
  };
  box(10, 3, '#ffffff', 3.2, [0, 8, 2]);           // key softbox above
  box(2, 12, '#ff6a2b', 4.0, [-9, 0, -2]);         // warm rim left
  box(1.2, 10, '#ff8a4c', 2.2, [8, -1, -4]);       // warm kicker right
  box(6, 6, '#c8d2e8', 0.22, [6, 2, 8]);           // faint neutral fill front-right
  box(14, 1, '#ffffff', 1.4, [0, -7, 3]);          // floor bounce strip
  box(3, 3, '#ffffff', 1.6, [-4, 3, 8]);           // small front sparkle
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = buildEnv();

// ---------- Simplex noise (GLSL, Ashima) ----------
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ---------- Liquid chrome core ----------
const world = new THREE.Group();
scene.add(world);
const coreGroup = new THREE.Group();
world.add(coreGroup);

const blobUniforms = { uTime: { value: 0 }, uAmp: { value: 0.14 }, uFreq: { value: 0.72 }, uHeat: { value: 0 } };
const blobMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.09, envMapIntensity: 1.3 });
blobMat.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, blobUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uAmp; uniform float uFreq;
      varying float vDisp;
      ${NOISE}
      float field(vec3 p){
        float n = snoise(p*uFreq + vec3(0., uTime*.16, uTime*.09));
        n += .28*snoise(p*uFreq*2.2 - vec3(uTime*.14));
        return n;
      }
      vec3 disp(vec3 p){ return p + normalize(p) * field(normalize(p)) * uAmp; }`)
    .replace('#include <beginnormal_vertex>', `
      vec3 pN = normalize(position);
      vec3 tng = normalize(cross(pN, abs(pN.y) > .99 ? vec3(1.,0.,0.) : vec3(0.,1.,0.)));
      vec3 btg = normalize(cross(pN, tng));
      float e = .012;
      vec3 d0 = disp(position);
      vec3 d1 = disp(position + tng*e);
      vec3 d2 = disp(position + btg*e);
      vec3 objectNormal = normalize(cross(d1 - d0, d2 - d0));
      if (dot(objectNormal, pN) < 0.) objectNormal *= -1.;
      vDisp = field(pN);
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif`)
    .replace('#include <begin_vertex>', 'vec3 transformed = d0;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDisp; uniform float uHeat;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // molten seams: troughs of the field glow faintly ember
      float seam = smoothstep(-.55, -1.0, vDisp);
      totalEmissiveRadiance += vec3(1., .38, .12) * seam * (.18 + uHeat*.8);`);
};
const blob = new THREE.Mesh(new THREE.SphereGeometry(1.15, isMobile() ? 96 : 140, isMobile() ? 72 : 100), blobMat);
coreGroup.add(blob);

// Glass halo ring (refracts the core)
// Glass ring: a cheap fresnel shader (bright rim, faint iridescent sheen, specular streaks).
// Looks like glass without the transmission pass that would re-render the whole scene.
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 n = normalize(vN), v = normalize(vV);
      float f = 1. - abs(dot(n, v));
      float rim = pow(f, 2.2);
      vec3 irid = .5 + .5 * cos(6.2831 * (f * 1.1 + vec3(0., .33, .67)) + uTime * .2);
      vec3 col = mix(vec3(1., .93, .88), irid, .35) * rim * .9;
      vec3 r = reflect(-v, n);
      float key = pow(max(dot(r, normalize(vec3(.2, 1., .4))), 0.), 60.) * 2.2;
      float warm = pow(max(dot(r, normalize(vec3(-1., .1, -.2))), 0.), 24.) * 1.4;
      col += vec3(key) + vec3(1., .45, .18) * warm;
      col += vec3(.035, .03, .03);
      gl_FragColor = vec4(col, 1.);
    }`,
});
const glassRing = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.2, 32, 160), glassMat);
glassRing.rotation.set(1.15, 0.25, 0);
coreGroup.add(glassRing);

// Thin chrome orbits
const chrome = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 });
const orbitA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.008, 6, 240), chrome);
const orbitB = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.006, 6, 240), chrome);
orbitA.rotation.set(1.35, -0.4, 0.3); orbitB.rotation.set(1.7, 0.55, -0.2);
coreGroup.add(orbitA, orbitB);
// Beads riding the orbits (emissive, they bloom)
const beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb48a').multiplyScalar(4) });
const beadA = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), beadMat);
const beadB = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3) }));
orbitA.add(beadA); orbitB.add(beadB);

// ---------- Particle field: halo -> globe -> GPU fabric ----------
const COUNT = isMobile() ? 6000 : 11000;
const posA = new Float32Array(COUNT * 3), posB = new Float32Array(COUNT * 3), posC = new Float32Array(COUNT * 3);
const rnd = new Float32Array(COUNT * 4);

// crude continent mask from layered sines, enough to read as land masses
const land = (lat, lon) => {
  const v = Math.sin(lat * 2.1 + 0.6) * Math.cos(lon * 1.7 - 0.3) + 0.55 * Math.sin(lon * 3.3 + lat * 1.3) + 0.35 * Math.cos(lat * 5.1 - lon * 2.2);
  return v > 0.38;
};
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const gridN = Math.ceil(Math.sqrt(COUNT * 1.6));
for (let i = 0; i < COUNT; i++) {
  // A: loose halo shell, flattened like an accretion disk
  const r = 2.6 + Math.pow(Math.random(), 1.6) * 3.4;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  posA.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.28 + (Math.random() - .5) * 0.5, r * Math.sin(ph) * Math.sin(th)], i * 3);

  // B: globe. Fibonacci points; land points sit on the surface, ocean ones get sparse & scattered
  let gx, gy, gz, tries = 0, landHit = false;
  do {
    const k = Math.floor(Math.random() * 30000);
    const y = 1 - (k / 29999) * 2, rad = Math.sqrt(1 - y * y), t = GOLDEN * k;
    gx = Math.cos(t) * rad; gy = y; gz = Math.sin(t) * rad;
    landHit = land(Math.asin(gy), Math.atan2(gz, gx));
    tries++;
  } while (!landHit && tries < 3 && Math.random() < 0.85);
  const gr = landHit ? 2.15 : 2.15 + (Math.random() < .5 ? 0 : Math.random() * 0.05);
  posB.set([gx * gr, gy * gr, gz * gr], i * 3);

  // C: GPU fabric, a wide plane grid (wave added in shader)
  const gi = i % gridN, gj = Math.floor(i / gridN);
  posC.set([(gi / gridN - 0.5) * 8.2, 0, (gj / gridN - 0.5) * 6.4], i * 3);

  rnd.set([Math.random(), Math.random(), Math.random(), landHit ? 1 : 0], i * 4);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
pGeo.setAttribute('posB', new THREE.BufferAttribute(posB, 3));
pGeo.setAttribute('posC', new THREE.BufferAttribute(posC, 3));
pGeo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4));

const pUniforms = {
  uTime: { value: 0 }, uMorph: { value: 0 }, uPx: { value: renderer.getPixelRatio() },
  uAccent: { value: ACCENT.clone() }, uAlpha: { value: 1 }, uSwirl: { value: 1 },
};
const pMat = new THREE.ShaderMaterial({
  uniforms: pUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uMorph, uPx, uSwirl;
    attribute vec3 posB; attribute vec3 posC; attribute vec4 rnd;
    varying float vA; varying float vHot;
    ${NOISE}
    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
    void main(){
      vec3 a = position;
      a.xz *= rot(uTime * (.05 + .08 * rnd.x) * uSwirl);
      a.y += sin(uTime*.6 + rnd.y*6.28) * .06;
      vec3 b = posB;
      b.xz *= rot(uTime * .12);
      b.yz *= rot(.35);
      vec3 c = posC;
      float w = snoise(vec3(c.x*.28, c.z*.28, uTime*.25));
      c.y = w * .5 + sin(c.x*1.1 + uTime*.8) * .1;
      c.yz *= rot(-.62);
      c.xz *= rot(.35);
      // staggered morph: each particle travels at its own moment
      float m1 = smoothstep(0., 1., clamp(uMorph * 1.6 - rnd.z * .6, 0., 1.));
      float m2 = smoothstep(0., 1., clamp((uMorph - 1.) * 1.6 - rnd.z * .6, 0., 1.));
      vec3 p = mix(a, b, m1);
      p = mix(p, c, m2);
      // a little turbulence mid-flight
      float flight = sin(m1 * 3.1416) + sin(m2 * 3.1416);
      if (flight > .002) p += vec3(snoise(p*.6+uTime*.3), snoise(p*.6-uTime*.3), snoise(p*.6+7.)) * .35 * flight;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      float hot = step(.93, rnd.x);                              // ~7% of points are ember
      float landBoost = mix(1., mix(.3, 1.35, rnd.w), m1 * (1. - m2));
      float sz = (1.1 + rnd.y * 1.7 + hot * 1.4) * landBoost;
      sz = mix(sz, 1.25 + hot * 1.6, m2);
      // traffic pulses sweeping across the fabric
      float pulse = pow(max(0., sin(posC.x*.9 + posC.z*.5 - uTime*2.2)), 18.);
      gl_PointSize = sz * uPx * (9. / -mv.z);
      vA = (.35 + .65 * rnd.x) * landBoost + m2 * (pulse * 1.6 + .15);
      vHot = hot;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uAccent; uniform float uAlpha;
    varying float vA; varying float vHot;
    void main(){
      vec2 uv = gl_PointCoord - .5;
      float d = length(uv);
      float a = smoothstep(.5, .0, d);
      a *= a;
      vec3 col = mix(vec3(.92,.94,1.), uAccent * 1.6, vHot);
      gl_FragColor = vec4(col, a * vA * uAlpha * .85);
    }`,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
world.add(points);

// Ember core light, visible inside the glass, feeds the bloom
const emberCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a3a').multiplyScalar(0) }));
coreGroup.add(emberCore);

// ---------- Post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.65, 0.82);
// blur chain at half resolution: bloom is soft by nature, the difference is invisible
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
let useBloom = true;
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Scroll-driven state (written by main.js through window.LUMEN) ----------
const S = {
  hero: 0,      // 0 -> 1 as hero scrolls away
  morph: 0,     // 0..2 pinned section stages
  morphIn: 0,   // 0..1 entering pinned section
  cta: 0,       // 0..1 final CTA arrival
  intro: reduce ? 1 : 0,
};
const mouse = { x: 0, y: 0, sx: 0, sy: 0, vel: 0 };
addEventListener('pointermove', (e) => {
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
  mouse.vel = Math.min(1, mouse.vel + Math.hypot(nx - mouse.x, ny - mouse.y) * 2);
  mouse.x = nx; mouse.y = ny;
}, { passive: true });

let active = true;
window.LUMEN = { S, setActive: (v) => { active = v; } };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(targetDpr());
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  // keep the subject framed on tall screens
  camera.fov = w / h < 0.8 ? 46 : 32;
  camera.updateProjectionMatrix();
  pUniforms.uPx.value = renderer.getPixelRatio();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let t = 0;
const cur = { x: 0, y: 0, s: 1, ry: 0, morph: 0, camY: 0, heat: 0 };

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!active) return;
  t += reduce ? dt * 0.15 : dt;

  const mob = isMobile();
  mouse.sx = lerp(mouse.sx, mouse.x, 0.05);
  mouse.sy = lerp(mouse.sy, mouse.y, 0.05);
  mouse.vel *= 0.94;

  // --- target pose from scroll ---
  const h = ease(clamp01(S.hero));
  const mi = ease(clamp01(S.morphIn));
  const c = ease(clamp01(S.cta));
  const intro = ease(clamp01(S.intro));

  // hero: right of the headline; statement: drifts left & recedes; morph: right column; cta: rises center
  let tx = mob ? 0 : 2.35, ty = mob ? 1.55 : 0.05, ts = mob ? 0.78 : 1;
  tx = lerp(tx, mob ? 0 : 3.35, h); ty = lerp(ty, mob ? 2.5 : -0.35, h); ts = lerp(ts, mob ? 0.5 : 0.66, h);
  tx = lerp(tx, mob ? 0 : 2.4, mi); ty = lerp(ty, mob ? 1.85 : 0, mi); ts = lerp(ts, mob ? 0.5 : 0.95, mi);
  // the fabric is wide: pull it in and lift it a little
  const fab = ease(clamp01(cur.morph - 1)) * mi;
  tx += fab * (mob ? 0 : -0.5); ty += fab * (mob ? 0.35 : 0.15); ts *= 1 - fab * (mob ? 0.1 : 0.14);
  tx = lerp(tx, 0, c); ty = lerp(ty, mob ? -2.75 : -3.05, c); ts = lerp(ts, mob ? 1.05 : 1.5, c);
  ts *= lerp(0.6, 1, intro);

  const k = 0.06;
  cur.x = lerp(cur.x, tx, k); cur.y = lerp(cur.y, ty, k); cur.s = lerp(cur.s, ts, k);
  cur.morph = lerp(cur.morph, S.morph * (1 - c), 0.08);

  world.position.set(cur.x, cur.y, 0);
  world.scale.setScalar(cur.s);

  // the core hides inside the globe, then gives way to the fabric
  const m = cur.morph;
  const coreScale = m < 1 ? lerp(1, 0.62, ease(clamp01(m))) : lerp(0.62, 0.0001, ease(clamp01(m - 1)));
  coreGroup.scale.setScalar(Math.max(coreScale, 0.0001));
  coreGroup.visible = coreScale > 0.01;

  // rotation: idle spin + mouse parallax + scroll twist
  coreGroup.rotation.y = t * 0.18 + mouse.sx * 0.35 + h * 1.4;
  coreGroup.rotation.x = mouse.sy * 0.25 + Math.sin(t * 0.3) * 0.08;
  glassRing.rotation.z = t * 0.12;
  glassMat.uniforms.uTime.value = t;
  orbitA.rotation.z = t * 0.5; orbitB.rotation.z = -t * 0.36;
  beadA.position.set(2.55, 0, 0); beadB.position.set(2.9, 0, 0);
  points.rotation.y = mouse.sx * 0.12;
  points.rotation.x = mouse.sy * 0.06 + (m > 1 ? 0.1 : 0);

  // liquid behaviour: calm by default, agitated by pointer speed and the CTA
  blobUniforms.uTime.value = t;
  blobUniforms.uAmp.value = lerp(blobUniforms.uAmp.value, 0.14 + mouse.vel * 0.16 + c * 0.05, 0.06);
  cur.heat = lerp(cur.heat, c * 0.55 + mouse.vel * 0.3, 0.05);
  blobUniforms.uHeat.value = cur.heat;
  emberCore.material.color.copy(ACCENT).multiplyScalar(cur.heat * 6);

  pUniforms.uTime.value = t;
  pUniforms.uMorph.value = m;
  pUniforms.uSwirl.value = 1 + h * 2;
  pUniforms.uAlpha.value = intro * lerp(1, 1.25, mi);

  camera.position.x = mouse.sx * 0.25;
  camera.position.y = -mouse.sy * 0.18;
  camera.lookAt(0, 0, 0);

  bloom.strength = lerp(0.48, 0.62, c);
  if (useBloom) composer.render(); else renderer.render(scene, camera);
  adapt(dt);
}

// Adaptive quality: if frames keep running long, drop resolution, then bloom.
let acc = 0, frames = 0, settle = 0;
function adapt(dt) {
  if (settle > 0) { settle -= dt; return; }
  acc += dt; frames++;
  if (acc < 1.5) return;
  const avg = acc / frames; acc = 0; frames = 0;
  if (avg > 1 / 50) {
    if (quality > 0.6) { quality = Math.max(0.6, quality * 0.8); resize(); }
    else if (useBloom) useBloom = false;
    settle = 0.6;
  }
}

// Intro: let the core grow in once the page is ready
window.LUMEN.intro = () => {
  if (reduce) return;
  const start = performance.now();
  const step = (now) => {
    S.intro = Math.min(1, (now - start) / 1800);
    if (S.intro < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
frame();
document.documentElement.classList.add('gl-ready');
window.dispatchEvent(new Event('lumen:ready'));
