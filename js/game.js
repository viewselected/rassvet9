// ПРОСВЕТ-9 · игрок, бой, враги, мир
import * as THREE from 'three';
import { E, psxify } from './engine.js';
import { Snd } from './assets.js';

/* ================= МИР ================= */

export const W = {
  colliders: [],      // {min:Vector3, max:Vector3}
  interact: [],       // {pos, r, label, use(), enabled}
  items: [],          // {mesh, type, amount, taken}
  enemies: [],
  triggers: [],       // {min, max, once, fired, enter()}
  doors: [],          // {mesh, open, from, to, t, collider}
  update: null,       // хук уровня
  flags: {},          // произвольные флаги уровня
  reset() {
    this.colliders = []; this.interact = []; this.items = [];
    this.enemies = []; this.triggers = []; this.doors = [];
    this.update = null; this.flags = {};
  }
};

export function addCollider(x, y, z, sx, sy, sz) {
  const c = {
    min: new THREE.Vector3(x - sx/2, y - sy/2, z - sz/2),
    max: new THREE.Vector3(x + sx/2, y + sy/2, z + sz/2),
  };
  W.colliders.push(c);
  return c;
}

/* ================= ИГРОК ================= */

export const P = {
  pos: new THREE.Vector3(0, 1.7, 0),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false,
  hp: 100, maxHp: 100,
  stamina: 100,
  god: false,
  weapon: 1,
  weapons: { 1: true, 2: false, 3: false },
  ammo: { 2: 0, 3: 0 },
  clip: { 2: 0, 3: 0 },
  clipSize: { 2: 8, 3: 2 },
  dead: false,
  flash: null, flashOn: false,
  viewGroup: null, vmParts: {},
  attackT: 0, bobT: 0, stepT: 0,
  keysHeld: {}, // ключи-предметы: канистра итп
};

const HALF = .32, HEIGHT = 1.7, EYE = 1.58;

export function spawnPlayer(x, y, z, yaw = 0) {
  P.pos.set(x, y, z); P.vel.set(0, 0, 0);
  P.yaw = yaw; P.pitch = 0; P.dead = false;
  buildViewmodel();
  if (!P.flash) {
    P.flash = new THREE.SpotLight(0xfff2d0, 0, 26, .5, .45);
    P.flash.target = new THREE.Object3D();
  }
  E.scene.add(P.flash); E.scene.add(P.flash.target);
}

function buildViewmodel() {
  if (P.viewGroup) E.camera.remove(P.viewGroup);
  P.viewGroup = new THREE.Group();
  const m = (c) => new THREE.MeshLambertMaterial({ color: c });

  // 1: разводной ключ
  const wr = new THREE.Group();
  const h = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .38), m(0x7a7d80)); h.position.z = -.1;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(.11, .05, .1), m(0x8b8e91)); jaw.position.z = -.32;
  wr.add(h, jaw);
  wr.position.set(.3, -.28, -.5); wr.rotation.set(.2, -.4, .15);

  // 2: пистолет
  const pi = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(.06, .07, .26), m(0x2c2e31));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.055, .14, .07), m(0x3a3128));
  grip.position.set(0, -.09, .08); grip.rotation.x = .25;
  pi.add(slide, grip);
  pi.position.set(.26, -.24, -.45); pi.rotation.y = -.05;

  // 3: обрез
  const sg = new THREE.Group();
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5), m(0x26282b));
  const b2 = b1.clone();
  b1.rotation.x = Math.PI/2; b2.rotation.x = Math.PI/2;
  b1.position.x = -.024; b2.position.x = .024;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .22), m(0x4a3a26));
  stock.position.set(0, -.03, .3);
  sg.add(b1, b2, stock);
  sg.position.set(.24, -.26, -.5);

  P.vmParts = { 1: wr, 2: pi, 3: sg };
  P.viewGroup.add(wr, pi, sg);
  E.camera.add(P.viewGroup);
  if (!E.scene.children.includes(E.camera)) E.scene.add(E.camera);
  updateVM();
}

function updateVM() {
  for (const k of [1, 2, 3]) P.vmParts[k].visible = (+k === P.weapon);
}

function collideAxis(pos, axis, d) {
  pos[axis] += d;
  const pmin = new THREE.Vector3(pos.x - HALF, pos.y - EYE, pos.z - HALF);
  const pmax = new THREE.Vector3(pos.x + HALF, pos.y - EYE + HEIGHT, pos.z + HALF);
  for (const c of W.colliders) {
    if (pmax.x > c.min.x && pmin.x < c.max.x &&
        pmax.y > c.min.y && pmin.y < c.max.y &&
        pmax.z > c.min.z && pmin.z < c.max.z) {
      if (d > 0) pos[axis] = (axis === 'y' ? c.min.y + EYE - HEIGHT : c.min[axis] - HALF) - .001;
      else pos[axis] = (axis === 'y' ? c.max.y + EYE : c.max[axis] + HALF) + .001;
      if (axis === 'y') { if (d < 0) P.onGround = true; P.vel.y = 0; }
      return true;
    }
  }
  return false;
}

export function updatePlayer(dt) {
  if (P.dead) return;
  // взгляд
  P.yaw -= E.mouseDX * .0021;
  P.pitch -= E.mouseDY * .0021;
  P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
  E.mouseDX = 0; E.mouseDY = 0;

  // движение
  const fwd = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const wish = new THREE.Vector3();
  if (E.keys['KeyW']) wish.add(fwd);
  if (E.keys['KeyS']) wish.sub(fwd);
  if (E.keys['KeyD']) wish.add(right);
  if (E.keys['KeyA']) wish.sub(right);
  wish.normalize();

  const running = E.keys['ShiftLeft'] && P.stamina > 1 && wish.lengthSq() > 0;
  const speed = running ? 7.2 : 4.2;
  if (running) P.stamina = Math.max(0, P.stamina - 22 * dt);
  else P.stamina = Math.min(100, P.stamina + 14 * dt);

  P.vel.x = wish.x * speed;
  P.vel.z = wish.z * speed;
  P.vel.y -= 22 * dt;
  if (E.keys['Space'] && P.onGround) { P.vel.y = 7.5; P.onGround = false; }

  P.onGround = false;
  collideAxis(P.pos, 'x', P.vel.x * dt);
  collideAxis(P.pos, 'z', P.vel.z * dt);
  collideAxis(P.pos, 'y', P.vel.y * dt);
  if (P.pos.y < -30) damage(1000); // пропасть

  // шаги
  if (wish.lengthSq() > 0 && P.onGround) {
    P.stepT -= dt * (running ? 1.7 : 1);
    if (P.stepT <= 0) { Snd.step(); P.stepT = .42; }
    P.bobT += dt * (running ? 11 : 7);
  }

  // камера
  E.camera.position.copy(P.pos);
  E.camera.position.y += Math.sin(P.bobT) * .04;
  E.camera.rotation.order = 'YXZ';
  E.camera.rotation.y = P.yaw;
  E.camera.rotation.x = P.pitch;

  // фонарь
  P.flash.position.copy(E.camera.position);
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  P.flash.target.position.copy(E.camera.position).add(dir.multiplyScalar(10));
  P.flash.intensity = P.flashOn ? 55 : 0;

  // анимация атаки viewmodel
  if (P.attackT > 0) {
    P.attackT -= dt * 4;
    const k = Math.sin(Math.max(0, P.attackT) * Math.PI);
    P.viewGroup.position.z = -k * .12;
    P.viewGroup.rotation.x = -k * .3;
  } else { P.viewGroup.position.z = 0; P.viewGroup.rotation.x = 0; }

  // предметы
  for (const it of W.items) {
    if (it.taken) continue;
    it.mesh.rotation.y += dt * 1.5;
    if (it.mesh.position.distanceTo(P.pos) < 1.4) pickup(it);
  }

  // триггеры
  for (const t of W.triggers) {
    if (t.fired && t.once) continue;
    if (P.pos.x > t.min.x && P.pos.x < t.max.x &&
        P.pos.y > t.min.y && P.pos.y < t.max.y &&
        P.pos.z > t.min.z && P.pos.z < t.max.z) {
      t.fired = true; t.enter();
    }
  }

  // интерактив: подсказка
  let best = null, bd = 2.4;
  for (const i of W.interact) {
    if (i.enabled === false) continue;
    const d = i.pos.distanceTo(P.pos);
    if (d < bd) { bd = d; best = i; }
  }
  const ui = document.getElementById('interact');
  if (best) { ui.style.display = 'block'; ui.textContent = `[E] ${best.label}`; }
  else ui.style.display = 'none';
  P._interactTarget = best;

  // двери
  for (const d of W.doors) {
    const target = d.open ? 1 : 0;
    if (Math.abs(d.t - target) > .001) {
      d.t += (target - d.t) * Math.min(1, dt * 2.5);
      d.mesh.position.lerpVectors(d.from, d.to, d.t);
      if (d.collider) {
        const s = d.size;
        d.collider.min.set(d.mesh.position.x - s.x/2, d.mesh.position.y - s.y/2, d.mesh.position.z - s.z/2);
        d.collider.max.set(d.mesh.position.x + s.x/2, d.mesh.position.y + s.y/2, d.mesh.position.z + s.z/2);
      }
    }
  }
}

function pickup(it) {
  it.taken = true;
  it.mesh.visible = false;
  Snd.pickup();
  if (it.type === 'medkit') { P.hp = Math.min(P.maxHp, P.hp + it.amount); toast(`аптечка +${it.amount}`); }
  else if (it.type === 'ammo2') { P.ammo[2] += it.amount; toast(`патроны 9мм +${it.amount}`); }
  else if (it.type === 'ammo3') { P.ammo[3] += it.amount; toast(`патроны 12к +${it.amount}`); }
  else if (it.type === 'pistol') { P.weapons[2] = true; P.clip[2] = 8; switchWeapon(2); toast('найден пистолет ПМ'); }
  else if (it.type === 'shotgun') { P.weapons[3] = true; P.clip[3] = 2; switchWeapon(3); toast('найден обрез'); }
  else if (it.type === 'key') { P.keysHeld[it.keyId] = true; toast(it.label || 'предмет получен'); }
  it.onTaken?.();
  updateHUD();
}

export function switchWeapon(n) {
  if (!P.weapons[n]) return;
  P.weapon = n; updateVM(); updateHUD();
}

export function attack() {
  if (P.dead || P.attackT > 0) return;
  const w = P.weapon;
  if (w === 1) {
    P.attackT = 1; Snd.swing();
    setTimeout(() => meleeHit(), 120);
  } else {
    if (P.clip[w] <= 0) { reload(w); return; }
    P.clip[w]--; P.attackT = 1;
    Snd.shot(); muzzle();
    const pellets = w === 3 ? 6 : 1;
    const dmg = w === 3 ? 16 : 22;
    for (let i = 0; i < pellets; i++) rayShot(dmg, w === 3 ? .06 : .012);
    updateHUD();
  }
}

function reload(w) {
  if (P.ammo[w] <= 0) { toast('нет патронов'); return; }
  const need = P.clipSize[w] - P.clip[w];
  const take = Math.min(need, P.ammo[w]);
  P.clip[w] += take; P.ammo[w] -= take;
  Snd.hitMetal(); toast('перезарядка');
  updateHUD();
}

function muzzle() {
  const l = new THREE.PointLight(0xffcf90, 40, 9);
  l.position.copy(E.camera.position);
  E.scene.add(l);
  setTimeout(() => E.scene.remove(l), 60);
}

const _ray = new THREE.Raycaster();
function rayShot(dmg, spread) {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  dir.x += (Math.random()-.5) * spread;
  dir.y += (Math.random()-.5) * spread;
  dir.normalize();
  _ray.set(E.camera.position, dir);
  _ray.far = 120;
  // враги
  let hit = null, hd = 1e9;
  for (const en of W.enemies) {
    if (en.dead) continue;
    const r = _ray.ray.distanceSqToPoint(en.group.position.clone().setY(en.group.position.y + 1));
    const d = en.group.position.distanceTo(E.camera.position);
    if (r < 1.1 && d < hd) { hd = d; hit = en; }
  }
  if (hit) hurtEnemy(hit, dmg);
}

function meleeHit() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  for (const en of W.enemies) {
    if (en.dead) continue;
    const to = en.group.position.clone().sub(P.pos);
    if (to.length() < 2.6 && to.normalize().dot(dir) > .5) {
      hurtEnemy(en, 34); Snd.hitMetal();
      return;
    }
  }
}

export function damage(n) {
  if (P.god || P.dead) return;
  P.hp -= n;
  Snd.hurt();
  const d = document.getElementById('damage');
  d.style.boxShadow = 'inset 0 0 140px rgba(181,55,42,.75)';
  setTimeout(() => d.style.boxShadow = 'inset 0 0 120px rgba(181,55,42,0)', 250);
  if (P.hp <= 0) { P.hp = 0; die(); }
  updateHUD();
}

function die() {
  P.dead = true;
  document.exitPointerLock();
  document.getElementById('deathscreen').style.display = 'flex';
}

/* ================= ВРАГИ ================= */

export function spawnShade(x, y, z, opts = {}) {
  // «тень» — вытянутая тёмная фигура, стоит неподвижно, потом идёт неправильно
  const g = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: 0x0a0b0d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.9, .34), black);
  body.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.3, .42, .3), black);
  head.position.y = 2.5;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd8d3c4 });
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), eyeM);
  const e2 = e1.clone();
  e1.position.set(-.08, 2.52, .16); e2.position.set(.08, 2.52, .16);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.5, .12), black);
  const a2 = a1.clone();
  a1.position.set(-.36, 1.5, 0); a2.position.set(.36, 1.5, 0);
  g.add(body, head, e1, e2, a1, a2);
  g.position.set(x, y, z);
  g.scale.setScalar(1.05);
  E.scene.add(g);
  const en = {
    group: g, hp: opts.hp ?? 60, dead: false,
    state: 'idle', speed: opts.speed ?? 3.1,
    aggroR: opts.aggroR ?? 16, attackT: 0, voiceT: Math.random() * 6,
    arms: [a1, a2], home: g.position.clone(),
    onDeath: opts.onDeath,
  };
  W.enemies.push(en);
  return en;
}

function hurtEnemy(en, dmg) {
  en.hp -= dmg;
  en.state = 'chase';
  en.group.position.y += .02;
  if (en.hp <= 0 && !en.dead) {
    en.dead = true;
    Snd.creature();
    en.deathT = 1;
  }
}

export function updateEnemies(dt) {
  for (const en of W.enemies) {
    const g = en.group;
    if (en.dead) {
      if (en.deathT > 0) {
        en.deathT -= dt;
        g.scale.y = Math.max(.02, en.deathT);
        g.position.y = en.home.y + (1 - en.deathT) * -0.0;
        if (en.deathT <= 0) { E.scene.remove(g); en.onDeath?.(); }
      }
      continue;
    }
    const toP = P.pos.clone().sub(g.position); toP.y = 0;
    const dist = toP.length();

    en.voiceT -= dt;
    if (en.voiceT < 0 && dist < 26) { Snd.creature(); en.voiceT = 5 + Math.random() * 8; }

    if (en.state === 'idle') {
      if (dist < en.aggroR) en.state = 'chase';
      // стоит и медленно поворачивается к игроку — тревожнее чем движение
      if (dist < 30) g.lookAt(P.pos.x, g.position.y, P.pos.z);
    } else if (en.state === 'chase') {
      g.lookAt(P.pos.x, g.position.y, P.pos.z);
      if (dist > 1.4) {
        toP.normalize();
        // рывковое, неправильное движение: то замирает, то дёргается
        const jerk = (Math.sin(performance.now() * .01 + g.id) > -.3) ? 1 : 0;
        const step = toP.multiplyScalar(en.speed * dt * jerk);
        moveEnemy(g, step);
        en.arms[0].rotation.x = Math.sin(performance.now() * .02) * .9;
        en.arms[1].rotation.x = -Math.sin(performance.now() * .02) * .9;
      }
      if (dist < 1.7) {
        en.attackT -= dt;
        if (en.attackT <= 0) { damage(12); en.attackT = .9; }
      }
    }
  }
  W.enemies = W.enemies.filter(e => !e.dead || e.deathT > 0);
}

function moveEnemy(g, step) {
  const p = g.position;
  const tryMove = (axis, d) => {
    p[axis] += d;
    for (const c of W.colliders) {
      if (p.x + .3 > c.min.x && p.x - .3 < c.max.x &&
          p.y + 2.2 > c.min.y && p.y + .3 < c.max.y &&
          p.z + .3 > c.min.z && p.z - .3 < c.max.z) { p[axis] -= d; return; }
    }
  };
  tryMove('x', step.x); tryMove('z', step.z);
}

/* ================= UI ================= */

export function updateHUD() {
  document.querySelector('#hpbar i').style.width = (P.hp / P.maxHp * 100) + '%';
  document.querySelector('#stbar i').style.width = P.stamina + '%';
  const a = document.getElementById('ammo');
  if (P.weapon === 1) a.innerHTML = 'КЛЮЧ';
  else a.innerHTML = `<b>${P.clip[P.weapon]}</b> / ${P.ammo[P.weapon]}`;
  document.getElementById('godmode').style.display = P.god ? 'block' : 'none';
}

let toastT = null;
export function toast(text) {
  subtitle(null, text, 2.2);
}

let subQueue = [], subActive = null;
export function subtitle(who, text, dur = 4) {
  subQueue.push({ who, text, dur });
}
export function radioSay(text, dur = 4.5) {
  subQueue.push({ who: 'РАЦИЯ · НЕИЗВЕСТНЫЙ', text, dur, radio: true });
}
export function updateSubtitles(dt) {
  const el = document.getElementById('subtitles');
  if (subActive) {
    subActive.dur -= dt;
    if (subActive.dur <= 0) { subActive = null; el.style.display = 'none'; }
    return;
  }
  if (subQueue.length) {
    subActive = subQueue.shift();
    if (subActive.radio) Snd.radio();
    el.innerHTML = (subActive.who ? `<span class="who">${subActive.who}</span>` : '') + subActive.text;
    el.style.display = 'block';
  }
}

export function setObjective(text) {
  document.getElementById('objective').textContent = text;
}

export function showPaper(text) {
  document.getElementById('paper-text').textContent = text;
  document.getElementById('paper').style.display = 'flex';
  document.exitPointerLock();
}
export function hidePaper() {
  document.getElementById('paper').style.display = 'none';
}
export function paperOpen() {
  return document.getElementById('paper').style.display === 'flex';
}
