// ПРОСВЕТ-9 v2 · ассеты: многослойные процедурные текстуры, надписи, звук
import * as THREE from 'three';

function canv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function noise(ctx, w, h, amp) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - .5) * amp;
    d[i] += n; d[i+1] += n; d[i+2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
// потёки сверху вниз
function drips(x, w, h, count, color) {
  x.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const px = Math.random() * w, len = h * (.2 + Math.random() * .6);
    x.globalAlpha = .15 + Math.random() * .25;
    x.fillRect(px, 0, 1 + Math.random() * 2, len);
  }
  x.globalAlpha = 1;
}
// грязь понизу
function grime(x, w, h, color, height = .3) {
  const g = x.createLinearGradient(0, h * (1 - height), 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
}
function pit(x, w, h, n) { // выщербины
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(20,20,18,${.2 + Math.random() * .3})`;
    x.beginPath();
    x.arc(Math.random() * w, Math.random() * h, .5 + Math.random() * 2.5, 0, 7);
    x.fill();
  }
}
function tex(c, rx = 1, ry = rx) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const T = {};

export function buildTextures() {
  const S = 128;

  // бетон стеновой: база + пятна + потёки + грязь + швы
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#63645f'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 26);
    for (let i = 0; i < 6; i++) { // облачные пятна
      const g = x.createRadialGradient(Math.random()*S, Math.random()*S, 2, Math.random()*S, Math.random()*S, 30);
      g.addColorStop(0, 'rgba(40,42,38,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    drips(x, S, S, 10, 'rgba(35,36,30,1)');
    pit(x, S, S, 30);
    x.strokeStyle = 'rgba(30,30,28,.6)'; x.lineWidth = 2;
    x.strokeRect(1, 1, S-2, S-2);
    grime(x, S, S, 'rgba(25,26,20,.55)');
    T.concrete = tex(c);
  }
  // бетон с горизонтальной полосой-отбойником
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#6a6b64'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 20);
    x.fillStyle = '#4a5a4e'; x.fillRect(0, S*.55, S, S*.22); // крашеная полоса
    drips(x, S, S, 6, 'rgba(35,36,30,1)');
    pit(x, S, S, 16);
    grime(x, S, S, 'rgba(25,26,20,.5)');
    T.wallStripe = tex(c);
  }
  // кафель с грязными швами
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#8a958c'; x.fillRect(0, 0, S, S);
    const cell = S/4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = `rgba(${125+Math.random()*24|0},${138+Math.random()*20|0},${128+Math.random()*18|0},1)`;
      x.fillRect(i*cell+1, j*cell+1, cell-2, cell-2);
      if (Math.random() < .12) { // сколотая плитка
        x.fillStyle = '#3f4540';
        x.fillRect(i*cell+2, j*cell+2, cell-4, cell-4);
      }
    }
    x.strokeStyle = 'rgba(38,42,38,.9)';
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i*cell, 0); x.lineTo(i*cell, S); x.stroke();
      x.beginPath(); x.moveTo(0, i*cell); x.lineTo(S, i*cell); x.stroke();
    }
    noise(x, S, S, 10);
    drips(x, S, S, 5, 'rgba(45,48,40,1)');
    grime(x, S, S, 'rgba(28,30,24,.45)');
    T.tile = tex(c);
  }
  // металлические панели с заклёпками
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#575c60'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 14);
    x.strokeStyle = 'rgba(28,30,32,.8)'; x.lineWidth = 2;
    x.strokeRect(2, 2, S-4, S-4);
    x.beginPath(); x.moveTo(S/2, 0); x.lineTo(S/2, S); x.stroke();
    x.fillStyle = 'rgba(30,32,34,.9)';
    for (const px of [8, S/2-8, S/2+8, S-8]) for (const py of [8, S/2, S-8]) {
      x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(140,80,45,.28)'; // ржавые углы
    x.fillRect(0, S-18, 30, 18); x.fillRect(S-26, 0, 26, 14);
    T.metal = tex(c);
  }
  // ребристый пол (металл)
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#43474a'; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(90,95,98,.5)';
    for (let i = 0; i < S; i += 8) x.fillRect(0, i, S, 2);
    noise(x, S, S, 16);
    pit(x, S, S, 20);
    T.floorMetal = tex(c, 6);
  }
  // бетонный пол с разметкой
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#4e4f4a'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 18);
    pit(x, S, S, 26);
    x.fillStyle = 'rgba(160,150,60,.25)'; // затёртая жёлтая разметка
    x.fillRect(0, 10, S, 5);
    T.floorConc = tex(c, 5);
  }
  // потолок: плиты
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#55564f'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 14);
    x.strokeStyle = 'rgba(30,30,28,.5)';
    x.strokeRect(0, 0, S/2, S/2); x.strokeRect(S/2, S/2, S/2, S/2);
    x.strokeRect(S/2, 0, S/2, S/2); x.strokeRect(0, S/2, S/2, S/2);
    T.ceil = tex(c, 3);
  }
  // предупредительные полосы
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#a89530'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#20211e';
    for (let i = -64; i < 128; i += 24) {
      x.beginPath();
      x.moveTo(i, 0); x.lineTo(i+12, 0); x.lineTo(i-52+12, 64); x.lineTo(i-52, 64);
      x.fill();
    }
    noise(x, 64, 64, 24);
    T.hazard = tex(c, 4, 1);
  }
  // земля (для поверхности)
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#453f32'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 26);
    x.fillStyle = 'rgba(80,84,54,.35)';
    for (let i = 0; i < 60; i++) x.fillRect(Math.random()*S, Math.random()*S, 2, 1);
    T.dirt = tex(c, 24);
  }
  // ржавый металл (вагоны, ворота)
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#4f4a45'; x.fillRect(0, 0, S, S);
    noise(x, S, S, 16);
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(${110+Math.random()*40|0},${55+Math.random()*20|0},30,${.25+Math.random()*.3})`;
      x.beginPath(); x.arc(Math.random()*S, Math.random()*S, 2+Math.random()*7, 0, 7); x.fill();
    }
    drips(x, S, S, 8, 'rgba(90,50,28,1)');
    T.rust = tex(c);
  }
  // тёмное стекло
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#141c22'; x.fillRect(0, 0, 64, 64);
    const g = x.createLinearGradient(0, 0, 64, 64);
    g.addColorStop(.3, 'rgba(150,190,185,0)');
    g.addColorStop(.5, 'rgba(150,190,185,.14)');
    g.addColorStop(.7, 'rgba(150,190,185,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    T.glass = tex(c);
  }
  // дерево
  {
    const [c, x] = canv(S, S);
    x.fillStyle = '#5e4c36'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `rgb(${78+Math.random()*22|0},${60+Math.random()*16|0},${38+Math.random()*12|0})`;
      x.fillRect(0, i*16, S, 15);
    }
    noise(x, S, S, 22);
    T.wood = tex(c);
  }
}

/* табличка с текстом — советский стиль */
export function signTexture(lines, opts = {}) {
  const w = opts.w || 256, h = opts.h || 96;
  const [c, x] = canv(w, h);
  x.fillStyle = opts.bg || '#20303c';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = opts.fg || '#c8cdc2'; x.lineWidth = 3;
  x.strokeRect(4, 4, w-8, h-8);
  x.fillStyle = opts.fg || '#c8cdc2';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = opts.fs || 22;
  x.font = `bold ${fs}px "Arial Narrow", Arial, sans-serif`;
  lines.forEach((l, i) => x.fillText(l, w/2, h/2 + (i - (lines.length-1)/2) * (fs + 6)));
  noise(x, w, h, 18);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* граффити баллончиком */
export function graffitiTexture(text, color = '#c8483a', size = 44) {
  const w = 512, h = 128;
  const [c, x] = canv(w, h);
  x.clearRect(0, 0, w, h);
  x.save();
  x.translate(w/2, h/2);
  x.rotate((Math.random() - .5) * .12);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `bold ${size}px Impact, "Arial Black", sans-serif`;
  // подтёк-тень
  x.fillStyle = color;
  x.globalAlpha = .85;
  x.fillText(text, 0, 0);
  x.globalAlpha = .35;
  x.fillText(text, 2, 3);
  x.restore();
  // капли краски вниз
  x.fillStyle = color; x.globalAlpha = .5;
  for (let i = 0; i < 14; i++) {
    const px = w*.2 + Math.random() * w*.6;
    x.fillRect(px, h*.6, 2, 8 + Math.random() * 26);
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* плакат ТБ */
export function posterTexture(title, sub) {
  const w = 128, h = 192;
  const [c, x] = canv(w, h);
  x.fillStyle = '#b9ad8d'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#8b2f24'; x.fillRect(0, 0, w, 34);
  x.fillStyle = '#e8e2cf';
  x.textAlign = 'center';
  x.font = 'bold 15px "Arial Narrow", Arial';
  x.fillText(title, w/2, 22);
  x.fillStyle = '#2c2a24';
  x.font = '11px "Arial Narrow", Arial';
  const words = sub.split(' ');
  let line = '', y = 56;
  for (const wd of words) {
    if ((line + wd).length > 16) { x.fillText(line, w/2, y); y += 14; line = wd + ' '; }
    else line += wd + ' ';
  }
  x.fillText(line, w/2, y);
  // пиктограмма: рука и молния
  x.strokeStyle = '#8b2f24'; x.lineWidth = 4;
  x.beginPath(); x.arc(w/2, 140, 26, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(w/2-10, 128); x.lineTo(w/2+4, 140); x.lineTo(w/2-4, 142); x.lineTo(w/2+10, 154); x.stroke();
  noise(x, w, h, 20);
  grime(x, w, h, 'rgba(60,55,40,.4)', .2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mat(t, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: t, ...opts });
}

/* ---------------- ЗВУК ---------------- */

export const Snd = {
  ctx: null, master: null, windGain: null, droneGain: null, humGain: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = .5;
    this.master.connect(this.ctx.destination);
    this._wind(); this._drone(); this._hum();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  _noiseBuf(sec = 2) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  _wind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf(4); src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = .6;
    const g = this.ctx.createGain(); g.gain.value = 0;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = .07;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); lfo.start();
    this.windGain = g;
  },
  _drone() {
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 41.7;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    this.droneGain = g;
  },
  _hum() { // гудение люминесцентных ламп
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 2;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start();
    this.humGain = g;
  },
  ambience(wind = .1, drone = .05, hum = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.linearRampToValueAtTime(wind, t + 2);
    this.droneGain.gain.linearRampToValueAtTime(drone, t + 3);
    this.humGain.gain.linearRampToValueAtTime(hum, t + 2);
  },

  _env(dur, vol, node) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    node.connect(g); g.connect(this.master);
  },
  shot(kind = 'pm') {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.3);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = kind === 'sg' ? 900 : kind === 'ak' ? 1700 : 1400;
    src.connect(f);
    this._env(kind === 'sg' ? .3 : .16, kind === 'sg' ? .9 : .6, f);
    src.start();
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(kind === 'sg' ? 110 : 170, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + .1);
    this._env(.12, .4, o);
    o.start(); o.stop(this.ctx.currentTime + .13);
  },
  enemyShot() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.2);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1;
    src.connect(f); this._env(.14, .35, f); src.start();
  },
  ricochet() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2400 + Math.random()*800, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + .1);
    this._env(.1, .1, o); o.start(); o.stop(this.ctx.currentTime + .11);
  },
  hitmark() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1900;
    this._env(.04, .12, o); o.start(); o.stop(this.ctx.currentTime + .05);
  },
  swing() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.2);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(400, this.ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + .12);
    src.connect(f); this._env(.15, .3, f); src.start();
  },
  hitMetal() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(900 + Math.random()*300, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + .1);
    this._env(.12, .35, o); o.start(); o.stop(this.ctx.currentTime + .13);
  },
  step(hard = false) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.1);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = (hard ? 700 : 400) + Math.random()*200;
    src.connect(f); this._env(.08, .15, f); src.start();
  },
  pickup() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(620, this.ctx.currentTime);
    o.frequency.setValueAtTime(830, this.ctx.currentTime + .07);
    this._env(.18, .22, o); o.start(); o.stop(this.ctx.currentTime + .2);
  },
  hurt() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + .25);
    this._env(.28, .35, o); o.start(); o.stop(this.ctx.currentTime + .3);
  },
  creature() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 4;
    o.frequency.setValueAtTime(90, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(340, this.ctx.currentTime + .4);
    o.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + .8);
    o.connect(f); this._env(.85, .28, f); o.start(); o.stop(this.ctx.currentTime + .9);
  },
  skitter() { // ползун
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) {
      const o = this.ctx.createOscillator(); o.type = 'square';
      o.frequency.value = 1200 + Math.random()*900;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * .05;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .01);
      g.gain.linearRampToValueAtTime(0, t + .04);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + .06);
    }
  },
  radio(on = true) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.value = on ? 1400 : 900;
    this._env(.07, .1, o); o.start(); o.stop(this.ctx.currentTime + .08);
  },
  pa() { // сигнал громкой связи: три ноты
    if (!this.ctx) return;
    [523, 659, 784].forEach((fr, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * .22;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.14, t + .03);
      g.gain.linearRampToValueAtTime(0, t + .2);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + .22);
    });
  },
  door() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + .6);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    o.connect(f); this._env(.7, .3, f); o.start(); o.stop(this.ctx.currentTime + .75);
  },
  tramLoop() { // рокот вагонетки
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(2); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    const g = this.ctx.createGain(); g.gain.value = .22;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 6;
    const og = this.ctx.createGain(); og.gain.value = .06;
    o.connect(og); og.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); o.start();
    return { setVol: v => g.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 1),
             stop: () => { g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5); } };
  },
  alarm() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const g = this.ctx.createGain(); g.gain.value = .12;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    o.frequency.setValueAtTime(400, this.ctx.currentTime);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 1.2;
    const lg = this.ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(); lfo.start();
    return { stop: () => { g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + .8); } };
  }
};
