// ПРОСВЕТ-9 · движок: PSX-рендер и ввод
import * as THREE from 'three';

export const E = {
  renderer: null, scene: null, camera: null,
  rt: null, postScene: null, postCam: null, postMat: null,
  keys: {}, mouseDX: 0, mouseDY: 0, pointerLocked: false,
  clock: new THREE.Clock(),
  RES_H: 270, // высота внутреннего рендера — PSX-сердце всей картинки
};

const JITTER = 160.0; // сетка привязки вершин (меньше = сильнее дрожь)

// патч материала: привязка вершин к сетке в clip space — фирменная дрожь PS1
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
uniform float vhs;      // 0..1 сила помех
varying vec2 vUv;

float rnd(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }

// байеровский дизеринг 4x4
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
  // лёгкое искривление трубки
  vec2 cc = uv - 0.5;
  uv = uv + cc * dot(cc, cc) * 0.08;

  // vhs: строчный сдвиг
  float lineShift = (rnd(vec2(floor(uv.y * 270.0), floor(time * 12.0))) - 0.5) * 0.004 * vhs;
  uv.x += lineShift;

  vec3 col = texture2D(tex, uv).rgb;

  // квантование цвета + дизеринг = ретро-градиенты
  float d = bayer(gl_FragCoord.xy) / 24.0;
  col = floor((col + d) * 24.0) / 24.0;

  // сканлайны
  col *= 0.94 + 0.06 * sin(uv.y * 270.0 * 3.14159);

  // зерно
  col += (rnd(uv * time) - 0.5) * (0.035 + 0.09 * vhs);

  // виньетка
  col *= 1.0 - dot(cc, cc) * 0.9;

  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function initEngine() {
  const canvas = document.getElementById('game');
  E.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  E.renderer.setPixelRatio(1);

  E.scene = new THREE.Scene();
  E.camera = new THREE.PerspectiveCamera(72, 16/9, .1, 400);

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
