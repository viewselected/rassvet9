// ПРОСВЕТ-9 v2 · движок
import * as THREE from 'three';

export const E = {
  renderer: null, scene: null, camera: null,
  rt: null, postScene: null, postCam: null, postMat: null,
  keys: {}, mouseDX: 0, mouseDY: 0, pointerLocked: false,
  RES_H: 540, // x2 к первой версии
  shake: 0,
};

const JITTER = 420.0; // при новом разрешении дрожь тоньше, но всё ещё живая

export function psxify(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       {
         vec4 p = gl_Position;
         p.xyz /= p.w;
         p.xy = floor(p.xy * ${JITTER.toFixed(1)}) / ${JITTER.toFixed(1)};
         p.xyz *= p.w;
         gl_Position = p;
       }`
    );
  };
  return material;
}

const POST_FRAG = `
precision highp float;
uniform sampler2D tex;
uniform float time;
uniform float vhs;
varying vec2 vUv;

float rnd(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }

float bayer(vec2 p){
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for(int k=0;k<16;k++){ if(k==i) return m[k]/16.0 - 0.5; }
  return 0.0;
}

void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  uv = uv + cc * dot(cc, cc) * 0.06;

  float lineShift = (rnd(vec2(floor(uv.y * 540.0), floor(time * 12.0))) - 0.5) * 0.003 * vhs;
  uv.x += lineShift;

  vec3 col = texture2D(tex, uv).rgb;

  // тонкое квантование: больше ступеней чем в v1 — картинка богаче, зерно тоньше
  float d = bayer(gl_FragCoord.xy) / 48.0;
  col = floor((col + d) * 48.0) / 48.0;

  col *= 0.98 + 0.02 * sin(uv.y * 540.0 * 3.14159);
  col += (rnd(uv * time) - 0.5) * (0.014 + 0.05 * vhs);
  col *= 1.0 - dot(cc, cc) * 0.35;

  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function initEngine() {
  const canvas = document.getElementById('game');
  E.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  E.renderer.setPixelRatio(1);

  E.scene = new THREE.Scene();
  E.camera = new THREE.PerspectiveCamera(74, 16/9, .08, 500);

  E.postScene = new THREE.Scene();
  E.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  E.postMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, time: { value: 0 }, vhs: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FRAG,
  });
  E.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), E.postMat));

  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('keydown', e => { E.keys[e.code] = true; });
  document.addEventListener('keyup', e => { E.keys[e.code] = false; });
  document.addEventListener('mousemove', e => {
    if (!E.pointerLocked) return;
    E.mouseDX += e.movementX;
    E.mouseDY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    E.pointerLocked = document.pointerLockElement === canvas;
  });
}

export function lockPointer() {
  document.getElementById('game').requestPointerLock();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  E.renderer.setSize(w, h);
  E.camera.aspect = w / h;
  E.camera.updateProjectionMatrix();
  const rw = Math.round(E.RES_H * w / h);
  if (E.rt) E.rt.dispose();
  E.rt = new THREE.WebGLRenderTarget(rw, E.RES_H, {
    magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter,
  });
  E.postMat.uniforms.tex.value = E.rt.texture;
}

export function renderFrame(t, vhsAmount = 0) {
  E.postMat.uniforms.time.value = t;
  E.postMat.uniforms.vhs.value = vhsAmount;
  if (E.shake > 0) {
    E.camera.position.x += (Math.random()-.5) * E.shake * .06;
    E.camera.position.y += (Math.random()-.5) * E.shake * .06;
    E.shake = Math.max(0, E.shake - .08);
  }
  E.renderer.setRenderTarget(E.rt);
  E.renderer.render(E.scene, E.camera);
  E.renderer.setRenderTarget(null);
  E.renderer.render(E.postScene, E.postCam);
}

export function clearScene() {
  while (E.scene.children.length) {
    const o = E.scene.children[0];
    E.scene.remove(o);
    o.traverse?.(c => {
      c.geometry?.dispose?.();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
    });
  }
}

/* сегмент-AABB: линия видимости и попадания сквозь стены */
export function segmentHitsAABB(a, b, min, max) {
  let tmin = 0, tmax = 1;
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  for (const ax of ['x', 'y', 'z']) {
    if (Math.abs(d[ax]) < 1e-8) {
      if (a[ax] < min[ax] || a[ax] > max[ax]) return false;
    } else {
      let t1 = (min[ax] - a[ax]) / d[ax];
      let t2 = (max[ax] - a[ax]) / d[ax];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}
