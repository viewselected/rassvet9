// ПРОСВЕТ-9 · ассеты: всё генерируется кодом, никаких файлов
import * as THREE from 'three';

/* ---------------- ТЕКСТУРЫ ---------------- */

function canv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function noise(ctx, w, h, amp, base) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - .5) * amp;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const T = {};

export function buildTextures() {
  // бетон
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#5a5b56'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 34);
    x.strokeStyle = 'rgba(30,30,28,.5)';
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.moveTo(Math.random()*64, Math.random()*64);
      x.lineTo(Math.random()*64, Math.random()*64);
      x.stroke();
    }
    T.concrete = tex(c);
  }
  // панелька (стена дома с потёками)
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#6e6a5e'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 22);
    x.fillStyle = 'rgba(40,38,32,.35)';
    for (let i = 0; i < 8; i++) {
      const px = Math.random()*64;
      x.fillRect(px, 0, 1 + Math.random()*2, 20 + Math.random()*44);
    }
    x.strokeStyle = 'rgba(35,33,30,.8)'; x.lineWidth = 2;
    x.strokeRect(1, 1, 62, 62);
    T.panel = tex(c);
  }
  // земля / грязь
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#4b4638'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 30);
    x.fillStyle = 'rgba(70,72,50,.4)';
    for (let i = 0; i < 40; i++) x.fillRect(Math.random()*64, Math.random()*64, 2, 1);
    T.dirt = tex(c, 24);
  }
  // асфальт
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#3b3d3e'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 20);
    T.asphalt = tex(c, 16);
  }
  // доски
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#5e4c36'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = `rgb(${80+Math.random()*20|0},${62+Math.random()*15|0},${40+Math.random()*10|0})`;
      x.fillRect(0, i*16, 64, 15);
    }
    noise(x, 64, 64, 24);
    T.wood = tex(c);
  }
  // ржавый металл
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#4f4a45'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 18);
    x.fillStyle = 'rgba(120,60,35,.45)';
    for (let i = 0; i < 20; i++) {
      x.beginPath();
      x.arc(Math.random()*64, Math.random()*64, 2+Math.random()*5, 0, 7);
      x.fill();
    }
    T.rust = tex(c);
  }
  // крыша / шифер
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#4a4d50'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(20,22,24,.5)'; x.fillRect(0, i*8, 64, 1); }
    noise(x, 64, 64, 16);
    T.roof = tex(c);
  }
  // окно (тёмное)
  {
    const [c, x] = canv(32, 32);
    x.fillStyle = '#12161c'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = 'rgba(143,181,173,.12)';
    x.fillRect(2, 2, 12, 12);
    x.strokeStyle = '#3a3b36'; x.lineWidth = 3;
    x.strokeRect(0, 0, 32, 32);
    x.beginPath(); x.moveTo(16, 0); x.lineTo(16, 32); x.moveTo(0, 16); x.lineTo(32, 16); x.stroke();
    T.window = tex(c);
  }
  // кафель (интерьеры)
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#79837c'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(30,35,33,.7)';
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i*16, 0); x.lineTo(i*16, 64); x.stroke();
      x.beginPath(); x.moveTo(0, i*16); x.lineTo(64, i*16); x.stroke();
    }
    noise(x, 64, 64, 14);
    T.tile = tex(c);
  }
  // бетонный пол интерьера
  {
    const [c, x] = canv(64, 64);
    x.fillStyle = '#494a46'; x.fillRect(0, 0, 64, 64);
    noise(x, 64, 64, 16);
    T.floor = tex(c, 4);
  }
}

export function mat(t, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: t, ...opts });
}

/* ---------------- ЗВУК ---------------- */

export const Snd = {
  ctx: null, master: null, windGain: null, droneGain: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = .5;
    this.master.connect(this.ctx.destination);
    this._wind();
    this._drone();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  _noiseBuf(sec = 2) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  _wind() { // ветер: фильтрованный шум с медленной модуляцией
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
  _drone() { // тревожный низкий дрон
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 41.7;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    this.droneGain = g;
  },
  ambience(wind = .12, drone = .05) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.linearRampToValueAtTime(wind, t + 2);
    this.droneGain.gain.linearRampToValueAtTime(drone, t + 3);
  },

  _env(dur, vol, node) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    node.connect(g); g.connect(this.master);
    return t;
  },
  shot() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.3);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    src.connect(f);
    this._env(.22, .8, f);
    src.start();
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(160, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + .12);
    this._env(.14, .5, o);
    o.start(); o.stop(this.ctx.currentTime + .15);
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
  step() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf(.1);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400 + Math.random()*200;
    src.connect(f); this._env(.09, .16, f); src.start();
  },
  pickup() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(620, this.ctx.currentTime);
    o.frequency.setValueAtTime(830, this.ctx.currentTime + .07);
    this._env(.18, .25, o); o.start(); o.stop(this.ctx.currentTime + .2);
  },
  hurt() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + .25);
    this._env(.28, .4, o); o.start(); o.stop(this.ctx.currentTime + .3);
  },
  creature() { // голос существа: неправильный, обратный
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 4;
    o.frequency.setValueAtTime(90, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(340, this.ctx.currentTime + .4);
    o.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + .8);
    o.connect(f); this._env(.85, .3, f); o.start(); o.stop(this.ctx.currentTime + .9);
  },
  radio(on = true) { // писк рации перед репликой
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.value = on ? 1400 : 900;
    this._env(.07, .12, o); o.start(); o.stop(this.ctx.currentTime + .08);
  },
  door() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + .6);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    o.connect(f); this._env(.7, .3, f); o.start(); o.stop(this.ctx.currentTime + .75);
  },
  generator() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 55;
    const g = this.ctx.createGain(); g.gain.value = .08;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
    return { stop: () => { g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + .5); } };
  }
};
