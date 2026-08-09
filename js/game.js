// ПРОСВЕТ-9 v2 · игрок, боёвка, враги
import * as THREE from 'three';
import { E, segmentHitsAABB } from './engine.js';
import { Snd } from './assets.js';

/* ================= МИР ================= */

export const W = {
  colliders: [], solidOnly: [], // solidOnly — стены, блокирующие пули/взгляд
  interact: [], items: [], enemies: [], triggers: [], doors: [],
  update: null, flags: {},
  rail: null, // поездка: {points:[Vector3], t, speed, look, onArrive}
  reset() {
    this.colliders = []; this.solidOnly = []; this.interact = []; this.items = [];
    this.enemies = []; this.triggers = []; this.doors = [];
    this.update = null; this.flags = {}; this.rail = null;
  }
};

export function addCollider(x, y, z, sx, sy, sz, blocksShots = true) {
  const c = {
    min: new THREE.Vector3(x - sx/2, y - sy/2, z - sz/2),
    max: new THREE.Vector3(x + sx/2, y + sy/2, z + sz/2),
  };
  W.colliders.push(c);
  if (blocksShots && sy > 1.2) W.solidOnly.push(c);
  return c;
}

export function lineBlocked(a, b) {
  for (const c of W.solidOnly) {
    if (segmentHitsAABB(a, b, c.min, c.max)) return true;
  }
  return false;
}

/* ================= ИГРОК ================= */

export const P = {
  pos: new THREE.Vector3(0, 1.7, 0),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, onGround: false,
  hp: 100, maxHp: 100, armor: 0, stamina: 100,
  god: false, dead: false, locked: false, // locked — во время поездки
  weapon: 1,
  weapons: { 1: true, 2: false, 3: false, 4: false },
  // 2 ПМ · 3 АКС · 4 обрез
  ammo: { 2: 0, 3: 0, 4: 0 },
  clip: { 2: 0, 3: 0, 4: 0 },
  clipSize: { 2: 8, 3: 30, 4: 2 },
  fireRate: { 1: .45, 2: .22, 3: .1, 4: .8 },
  auto: { 3: true },
  firing: false, fireT: 0, reloadT: 0,
  recoil: 0, kick: 0,
  flash: null, flashOn: false,
  viewGroup: null, vmParts: {},
  bobT: 0, stepT: 0, keysHeld: {},
};

const HALF = .32, HEIGHT = 1.7, EYE = 1.58;

export function spawnPlayer(x, y, z, yaw = 0) {
  P.pos.set(x, y, z); P.vel.set(0, 0, 0);
  P.yaw = yaw; P.pitch = 0; P.dead = false; P.locked = false;
  buildViewmodel();
  P.flash = new THREE.SpotLight(0xfff2d0, 0, 30, .5, .45);
  P.flash.target = new THREE.Object3D();
  E.scene.add(P.flash); E.scene.add(P.flash.target);
}

function buildViewmodel() {
  P.viewGroup = new THREE.Group();
  const m = (c) => new THREE.MeshLambertMaterial({ color: c });

  const wr = new THREE.Group(); // ключ
  const h = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .38), m(0x7a7d80)); h.position.z = -.1;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(.11, .05, .1), m(0x8b8e91)); jaw.position.z = -.32;
  wr.add(h, jaw);
  wr.position.set(.3, -.28, -.5); wr.rotation.set(.2, -.4, .15);

  const pi = new THREE.Group(); // ПМ
  const slide = new THREE.Mesh(new THREE.BoxGeometry(.06, .07, .26), m(0x2c2e31));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.055, .14, .07), m(0x3a3128));
  grip.position.set(0, -.09, .08); grip.rotation.x = .25;
  pi.add(slide, grip);
  pi.position.set(.26, -.24, -.45);

  const ak = new THREE.Group(); // АКС-74У
  const recv = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .5), m(0x2e2c28));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .3), m(0x232323));
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, .01, -.38);
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(.05, .2, .09), m(0x8a4a2a));
  magazine.position.set(0, -.13, -.04); magazine.rotation.x = .35;
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(.075, .07, .18), m(0x6a4a2c));
  handguard.position.set(0, -.005, -.26);
  ak.add(recv, barrel, magazine, handguard);
  ak.position.set(.24, -.25, -.42);

  const sg = new THREE.Group(); // обрез
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5), m(0x26282b));
  const b2 = b1.clone();
  b1.rotation.x = Math.PI/2; b2.rotation.x = Math.PI/2;
  b1.position.x = -.024; b2.position.x = .024;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .22), m(0x4a3a26));
  stock.position.set(0, -.03, .3);
  sg.add(b1, b2, stock);
  sg.position.set(.24, -.26, -.5);

  P.vmParts = { 1: wr, 2: pi, 3: ak, 4: sg };
  P.viewGroup.add(wr, pi, ak, sg);
  E.camera.add(P.viewGroup);
  if (!E.scene.children.includes(E.camera)) E.scene.add(E.camera);
  updateVM();
}

function updateVM() {
  for (const k of [1, 2, 3, 4]) P.vmParts[k].visible = (+k === P.weapon);
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

  // взгляд (работает и в поездке)
  P.yaw -= E.mouseDX * .0021;
  P.pitch -= E.mouseDY * .0021;
  P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
  E.mouseDX = 0; E.mouseDY = 0;

  // поездка по рельсам
  if (W.rail) {
    const r = W.rail;
    r.t += r.speed * dt;
    const pts = r.points;
    const total = pts.length - 1;
    const seg = Math.min(total - .0001, r.t);
    const i = Math.floor(seg), f = seg - i;
    P.pos.lerpVectors(pts[i], pts[i + 1], f);
    if (r.t >= total) { const cb = r.onArrive; W.rail = null; P.locked = false; cb?.(); }
    applyCamera(dt, 0);
    return;
  }

  if (!P.locked) {
    const fwd = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (E.keys['KeyW']) wish.add(fwd);
    if (E.keys['KeyS']) wish.sub(fwd);
    if (E.keys['KeyD']) wish.add(right);
    if (E.keys['KeyA']) wish.sub(right);
    wish.normalize();

    const running = E.keys['ShiftLeft'] && P.stamina > 1 && wish.lengthSq() > 0;
    const speed = running ? 7.4 : 4.4;
    if (running) P.stamina = Math.max(0, P.stamina - 20 * dt);
    else P.stamina = Math.min(100, P.stamina + 15 * dt);

    P.vel.x = wish.x * speed;
    P.vel.z = wish.z * speed;
    P.vel.y -= 22 * dt;
    if (E.keys['Space'] && P.onGround) { P.vel.y = 7.5; P.onGround = false; }

    P.onGround = false;
    collideAxis(P.pos, 'x', P.vel.x * dt);
    collideAxis(P.pos, 'z', P.vel.z * dt);
    collideAxis(P.pos, 'y', P.vel.y * dt);
    if (P.pos.y < -40) damage(1000);

    if (wish.lengthSq() > 0 && P.onGround) {
      P.stepT -= dt * (running ? 1.7 : 1);
      if (P.stepT <= 0) { Snd.step(W.flags.hardFloor); P.stepT = .42; }
      P.bobT += dt * (running ? 11 : 7);
    }
  }

  // стрельба
  P.fireT -= dt;
  if (P.firing && P.fireT <= 0 && P.reloadT <= 0) {
    fireOnce();
    P.fireT = P.fireRate[P.weapon];
    if (!P.auto[P.weapon]) P.firing = false;
  }
  if (P.reloadT > 0) {
    P.reloadT -= dt;
    if (P.reloadT <= 0) finishReload();
  }
  P.recoil = Math.max(0, P.recoil - dt * 3);
  if (P.kick > 0) { P.pitch += P.kick * dt * 6; P.kick = Math.max(0, P.kick - dt * .25); }

  applyCamera(dt);

  // предметы
  for (const it of W.items) {
    if (it.taken) continue;
    it.mesh.rotation.y += dt * 1.5;
    if (it.mesh.position.distanceTo(P.pos) < 1.5) pickup(it);
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
  // интерактив
  let best = null, bd = 2.4;
  for (const i of W.interact) {
    if (i.enabled === false) continue;
    const d = i.pos.distanceTo(P.pos);
    if (d < bd) { bd = d; best = i; }
  }
  const ui = document.getElementById('interact');
  if (best && !P.locked) { ui.style.display = 'block'; ui.textContent = `[E] ${best.label}`; }
  else ui.style.display = 'none';
  P._interactTarget = best;

  // двери
  for (const d of W.doors) {
    const target = d.open ? 1 : 0;
    if (Math.abs(d.t - target) > .001) {
      d.t += (target - d.t) * Math.min(1, dt * 2.2);
      d.mesh.position.lerpVectors(d.from, d.to, d.t);
      if (d.collider) {
        const s = d.size;
        d.collider.min.set(d.mesh.position.x - s.x/2, d.mesh.position.y - s.y/2, d.mesh.position.z - s.z/2);
        d.collider.max.set(d.mesh.position.x + s.x/2, d.mesh.position.y + s.y/2, d.mesh.position.z + s.z/2);
      }
    }
  }
  updateFx(dt);
}

function applyCamera(dt, bob = 1) {
  E.camera.position.copy(P.pos);
  E.camera.position.y += Math.sin(P.bobT) * .04 * bob;
  E.camera.rotation.order = 'YXZ';
  E.camera.rotation.y = P.yaw;
  E.camera.rotation.x = P.pitch;

  P.flash.position.copy(E.camera.position);
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  P.flash.target.position.copy(E.camera.position).add(dir.multiplyScalar(10));
  P.flash.intensity = P.flashOn ? 60 : 0;

  // viewmodel: отдача и перезарядка
  const r = P.recoil;
  P.viewGroup.position.z = r * .09;
  P.viewGroup.rotation.x = -r * .22;
  if (P.reloadT > 0) P.viewGroup.position.y = -.18 * Math.sin(Math.min(1, P.reloadT) * Math.PI);
  else P.viewGroup.position.y = 0;
}

function pickup(it) {
  it.taken = true;
  it.mesh.visible = false;
  Snd.pickup();
  if (it.type === 'medkit') { P.hp = Math.min(P.maxHp, P.hp + it.amount); toast(`аптечка +${it.amount}`); }
  else if (it.type === 'armor') { P.armor = Math.min(100, P.armor + it.amount); toast(`бронежилет +${it.amount}`); }
  else if (it.type === 'ammo2') { P.ammo[2] += it.amount; toast(`9×18 +${it.amount}`); }
  else if (it.type === 'ammo3') { P.ammo[3] += it.amount; toast(`5,45 +${it.amount}`); }
  else if (it.type === 'ammo4') { P.ammo[4] += it.amount; toast(`12 калибр +${it.amount}`); }
  else if (it.type === 'pistol') { P.weapons[2] = true; P.clip[2] = 8; switchWeapon(2); toast('пистолет ПМ'); }
  else if (it.type === 'ak') { P.weapons[3] = true; P.clip[3] = 30; switchWeapon(3); toast('АКС-74У'); }
  else if (it.type === 'shotgun') { P.weapons[4] = true; P.clip[4] = 2; switchWeapon(4); toast('обрез'); }
  else if (it.type === 'key') { P.keysHeld[it.keyId] = true; toast(it.label || 'предмет получен'); }
  it.onTaken?.();
  updateHUD();
}

export function switchWeapon(n) {
  if (!P.weapons[n] || P.reloadT > 0) return;
  P.weapon = n; updateVM(); updateHUD();
}

export function startFire() {
  if (P.dead || P.locked) return;
  P.firing = true;
}
export function stopFire() { P.firing = false; }

function fireOnce() {
  const w = P.weapon;
  if (w === 1) {
    P.recoil = 1; Snd.swing();
    setTimeout(() => meleeHit(), 110);
    return;
  }
  if (P.clip[w] <= 0) { startReload(); return; }
  P.clip[w]--;
  P.recoil = 1;
  P.kick = w === 4 ? .09 : w === 3 ? .028 : .045;
  E.shake = Math.min(1, E.shake + (w === 4 ? .5 : .18));
  Snd.shot(w === 3 ? 'ak' : w === 4 ? 'sg' : 'pm');
  muzzle();
  const pellets = w === 4 ? 7 : 1;
  const dmg = w === 4 ? 15 : w === 3 ? 14 : 25;
  const spread = w === 4 ? .07 : w === 3 ? .028 : .014;
  for (let i = 0; i < pellets; i++) rayShot(dmg, spread);
  updateHUD();
}

export function startReload() {
  const w = P.weapon;
  if (w === 1 || P.reloadT > 0) return;
  if (P.clip[w] >= P.clipSize[w] || P.ammo[w] <= 0) { if (P.ammo[w] <= 0 && P.clip[w] <= 0) toast('нет патронов'); return; }
  P.reloadT = w === 3 ? 1.6 : w === 4 ? 1.9 : 1.1;
  Snd.hitMetal();
}
function finishReload() {
  const w = P.weapon;
  const need = P.clipSize[w] - P.clip[w];
  const take = Math.min(need, P.ammo[w]);
  P.clip[w] += take; P.ammo[w] -= take;
  Snd.hitMetal();
  updateHUD();
}

function muzzle() {
  const l = new THREE.PointLight(0xffcf90, 50, 10);
  l.position.copy(E.camera.position);
  const d = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  l.position.add(d.multiplyScalar(.6));
  E.scene.add(l);
  setTimeout(() => E.scene.remove(l), 55);
}

/* трассеры, искры, частицы */
const fx = [];
function tracer(a, b, color = 0xffe9a8) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 }));
  E.scene.add(l);
  fx.push({ obj: l, life: .07, kind: 'line' });
}
export function spark(p, color = 0xd8c8a0, n = 5, spread = 2.4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(.03, .03, .03),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.copy(p);
    m.userData.v = new THREE.Vector3(
      (Math.random()-.5) * spread, Math.random() * 2.2, (Math.random()-.5) * spread);
    E.scene.add(m);
    fx.push({ obj: m, life: .32 + Math.random() * .2, kind: 'p' });
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.kind === 'p') {
      f.obj.userData.v.y -= 9 * dt;
      f.obj.position.addScaledVector(f.obj.userData.v, dt);
    } else if (f.obj.material) {
      f.obj.material.opacity = Math.max(0, f.life * 12);
    }
    if (f.life <= 0) { E.scene.remove(f.obj); fx.splice(i, 1); }
  }
}

function hitWallPoint(a, dir, maxDist) {
  // ближайшее пересечение со стенами — грубым шагом (дёшево и стабильно)
  const step = .5, p = a.clone();
  for (let d = 0; d < maxDist; d += step) {
    p.addScaledVector(dir, step);
    for (const c of W.solidOnly) {
      if (p.x > c.min.x && p.x < c.max.x && p.y > c.min.y && p.y < c.max.y && p.z > c.min.z && p.z < c.max.z)
        return { point: p.clone(), dist: d };
    }
  }
  return { point: a.clone().addScaledVector(dir, maxDist), dist: maxDist };
}

function rayShot(dmg, spread) {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  dir.x += (Math.random()-.5) * spread * (1 + P.recoil);
  dir.y += (Math.random()-.5) * spread * (1 + P.recoil);
  dir.normalize();
  const origin = E.camera.position.clone();
  const wall = hitWallPoint(origin, dir, 90);

  // ближайший враг на луче ДО стены
  let hit = null, hd = wall.dist;
  const ray = new THREE.Ray(origin, dir);
  for (const en of W.enemies) {
    if (en.dead) continue;
    const center = en.group.position.clone(); center.y += en.hitY;
    const distSq = ray.distanceSqToPoint(center);
    const d = center.distanceTo(origin);
    if (distSq < en.hitR * en.hitR && d < hd) { hd = d; hit = en; }
  }
  const end = hit ? origin.clone().addScaledVector(dir, hd) : wall.point;
  tracer(origin.clone().addScaledVector(dir, .8), end);
  if (hit) {
    hurtEnemy(hit, dmg);
    spark(end, 0x3a2a2a, 5, 1.6);
    Snd.hitmark();
    hitmarkUI();
  } else {
    spark(end, 0xcfc4a0, 4, 2.2);
    if (Math.random() < .4) Snd.ricochet();
  }
}

function meleeHit() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
  for (const en of W.enemies) {
    if (en.dead) continue;
    const to = en.group.position.clone().sub(P.pos);
    if (to.length() < 2.6 && to.clone().normalize().dot(dir) > .5) {
      hurtEnemy(en, 38); Snd.hitMetal();
      spark(en.group.position.clone().setY(P.pos.y), 0x3a2a2a, 6, 2);
      hitmarkUI();
      return;
    }
  }
}

function hitmarkUI() {
  const c = document.getElementById('crosshair');
  c.style.borderColor = '#e6c15a';
  c.style.transform = 'translate(-50%,-50%) scale(1.6)';
  setTimeout(() => {
    c.style.borderColor = 'rgba(216,211,196,.7)';
    c.style.transform = 'translate(-50%,-50%) scale(1)';
  }, 90);
}

export function damage(n) {
  if (P.god || P.dead) return;
  if (P.armor > 0) {
    const absorbed = Math.min(P.armor, n * .6);
    P.armor -= absorbed;
    n -= absorbed;
  }
  P.hp -= n;
  Snd.hurt();
  E.shake = Math.min(1.2, E.shake + .5);
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

const blackM = () => new THREE.MeshLambertMaterial({ color: 0x0b0c0e });

export function spawnShade(x, y, z, opts = {}) {
  const g = new THREE.Group();
  const bm = blackM();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.9, .34), bm); body.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.3, .42, .3), bm); head.position.y = 2.5;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd8d3c4 });
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), eyeM);
  const e2 = e1.clone();
  e1.position.set(-.08, 2.52, .16); e2.position.set(.08, 2.52, .16);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.5, .12), bm);
  const a2 = a1.clone();
  a1.position.set(-.36, 1.5, 0); a2.position.set(.36, 1.5, 0);
  g.add(body, head, e1, e2, a1, a2);
  g.position.set(x, y, z);
  E.scene.add(g);
  const en = {
    kind: 'shade', group: g, hp: opts.hp ?? 65, dead: false,
    state: 'idle', speed: opts.speed ?? 3.2,
    aggroR: opts.aggroR ?? 16, attackT: 0, voiceT: Math.random() * 6,
    arms: [a1, a2], home: g.position.clone(),
    hitY: 1.4, hitR: .9,
    onDeath: opts.onDeath,
  };
  W.enemies.push(en);
  return en;
}

export function spawnCrawler(x, y, z, opts = {}) {
  // «ползун» — низкая быстрая тварь, бросается
  const g = new THREE.Group();
  const bm = new THREE.MeshLambertMaterial({ color: 0x2a2622 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.7, .3, .9), bm); body.position.y = .25;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xc86a4a });
  for (const ex of [-.15, .15]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .02), eyeM);
    e.position.set(ex, .32, .46);
    g.add(e);
  }
  const legs = [];
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .06), bm);
    l.position.set(s * .42, .15, -.3 + i * .3);
    legs.push(l); g.add(l);
  }
  g.add(body);
  g.position.set(x, y, z);
  E.scene.add(g);
  const en = {
    kind: 'crawler', group: g, hp: opts.hp ?? 26, dead: false,
    state: 'idle', speed: opts.speed ?? 5.6,
    aggroR: opts.aggroR ?? 13, attackT: 0, voiceT: Math.random() * 3,
    legs, lungeT: 0, home: g.position.clone(),
    hitY: .3, hitR: .6,
    onDeath: opts.onDeath,
  };
  W.enemies.push(en);
  return en;
}

export function spawnGunner(x, y, z, opts = {}) {
  // «одержимый» — бывший боец охраны с АКС; ходит, целится, бьёт очередями
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: 0x3d443c }); // форма
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a7f6d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.55, .9, .32), uni); body.position.y = 1.25;
  const legsM = new THREE.Mesh(new THREE.BoxGeometry(.5, .8, .3), new THREE.MeshLambertMaterial({ color: 0x2f342e }));
  legsM.position.y = .4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.28, .3, .28), skin); head.position.y = 1.9;
  // глаза светятся не тем светом
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xe8e4d4 });
  for (const ex of [-.07, .07]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .02), eyeM);
    e.position.set(ex, 1.93, .15);
    g.add(e);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .7), new THREE.MeshLambertMaterial({ color: 0x26262a }));
  gun.position.set(.2, 1.3, .3);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(.13, .6, .13), uni);
  a1.position.set(-.34, 1.25, .1);
  g.add(body, legsM, head, gun, a1);
  g.position.set(x, y, z);
  E.scene.add(g);
  const en = {
    kind: 'gunner', group: g, hp: opts.hp ?? 55, dead: false,
    state: 'idle', speed: opts.speed ?? 2.6,
    aggroR: opts.aggroR ?? 26,
    burstT: 0, burstLeft: 0, aimT: 0, strafeDir: 1, strafeT: 0,
    voiceT: Math.random() * 8, gun,
    hitY: 1.2, hitR: .8, home: g.position.clone(),
    onDeath: opts.onDeath,
  };
  W.enemies.push(en);
  return en;
}

function hurtEnemy(en, dmg) {
  en.hp -= dmg;
  if (en.state === 'idle') en.state = 'chase';
  en.group.position.y += .01;
  // флинч
  en.flinchT = .12;
  if (en.hp <= 0 && !en.dead) {
    en.dead = true;
    Snd.creature();
    en.deathT = .9;
  }
}

const eyeH = 1.5;
function canSeePlayer(en) {
  const a = en.group.position.clone(); a.y += en.hitY + .4;
  const b = P.pos.clone();
  return !lineBlocked(a, b);
}

export function updateEnemies(dt) {
  for (const en of W.enemies) {
    const g = en.group;
    if (en.dead) {
      if (en.deathT > 0) {
        en.deathT -= dt;
        g.rotation.x = (1 - en.deathT / .9) * (Math.PI / 2) * (en.kind === 'crawler' ? 0 : 1);
        g.scale.y = en.kind === 'crawler' ? Math.max(.1, en.deathT) : 1;
        if (en.deathT <= 0) {
          setTimeout(() => E.scene.remove(g), 4000); // тела лежат немного
          en.onDeath?.();
        }
      }
      continue;
    }
    if (en.flinchT > 0) { en.flinchT -= dt; continue; }

    const toP = P.pos.clone().sub(g.position); toP.y = 0;
    const dist = toP.length();

    en.voiceT -= dt;
    if (en.voiceT < 0 && dist < 28) {
      if (en.kind === 'crawler') Snd.skitter(); else Snd.creature();
      en.voiceT = 5 + Math.random() * 8;
    }

    if (en.state === 'idle') {
      if (dist < en.aggroR && canSeePlayer(en)) en.state = 'chase';
      if (dist < 30 && en.aggroR > 0) g.lookAt(P.pos.x, g.position.y, P.pos.z);
      continue;
    }

    // ---- преследование / бой ----
    g.lookAt(P.pos.x, g.position.y, P.pos.z);
    const see = canSeePlayer(en);

    if (en.kind === 'shade') {
      if (dist > 1.4) {
        const jerk = (Math.sin(performance.now() * .01 + g.id) > -.3) ? 1 : 0;
        moveEnemy(g, toP.normalize().multiplyScalar(en.speed * dt * jerk));
        en.arms[0].rotation.x = Math.sin(performance.now() * .02) * .9;
        en.arms[1].rotation.x = -Math.sin(performance.now() * .02) * .9;
      }
      if (dist < 1.7) {
        en.attackT -= dt;
        if (en.attackT <= 0) { damage(13); en.attackT = .9; }
      }
    }
    else if (en.kind === 'crawler') {
      en.legs.forEach((l, i) => l.rotation.x = Math.sin(performance.now() * .04 + i) * .6);
      if (en.lungeT > 0) {
        en.lungeT -= dt;
        moveEnemy(g, en.lungeDir.clone().multiplyScalar(11 * dt));
        if (dist < 1.2) { damage(9); en.lungeT = 0; }
      } else if (dist > 2.4) {
        moveEnemy(g, toP.normalize().multiplyScalar(en.speed * dt));
      } else {
        en.lungeT = .4;
        en.lungeDir = toP.normalize();
        Snd.skitter();
      }
    }
    else if (en.kind === 'gunner') {
      // держит дистанцию 6–16, стрейфится, бьёт очередями по 3
      en.strafeT -= dt;
      if (en.strafeT <= 0) { en.strafeDir *= -1; en.strafeT = 1 + Math.random() * 1.5; }
      const fwd = toP.clone().normalize();
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(en.strafeDir);
      let move = new THREE.Vector3();
      if (!see || dist > 16) move.add(fwd);
      else if (dist < 6) move.sub(fwd);
      if (see && dist < 20) move.add(side.multiplyScalar(.7));
      if (move.lengthSq() > 0) moveEnemy(g, move.normalize().multiplyScalar(en.speed * dt));

      if (see && dist < 24) {
        if (en.burstLeft > 0) {
          en.burstT -= dt;
          if (en.burstT <= 0) {
            en.burstLeft--; en.burstT = .13;
            gunnerFire(en);
          }
        } else {
          en.aimT -= dt;
          if (en.aimT <= 0) {
            en.burstLeft = 3; en.burstT = 0;
            en.aimT = 1.1 + Math.random() * .9;
          }
        }
      }
    }
  }
  W.enemies = W.enemies.filter(e => !e.dead || e.deathT > 0);
}

function gunnerFire(en) {
  Snd.enemyShot();
  const a = en.group.position.clone(); a.y += 1.35;
  const l = new THREE.PointLight(0xffcf90, 30, 7);
  l.position.copy(a);
  E.scene.add(l);
  setTimeout(() => E.scene.remove(l), 50);

  // точность падает с дистанцией и если игрок бежит
  const b = P.pos.clone();
  b.x += (Math.random()-.5) * (1.2 + P.vel.length() * .15);
  b.y += (Math.random()-.5) * .8;
  b.z += (Math.random()-.5) * (1.2 + P.vel.length() * .15);
  const dir = b.clone().sub(a).normalize();
  const g2 = new THREE.BufferGeometry().setFromPoints([a, a.clone().addScaledVector(dir, 40)]);
  const line = new THREE.Line(g2, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .8 }));
  E.scene.add(line);
  setTimeout(() => E.scene.remove(line), 60);

  const hitP = b.distanceTo(P.pos) < .8 && !lineBlocked(a, P.pos);
  if (hitP) damage(8);
  else if (!lineBlocked(a, b)) spark(b, 0xcfc4a0, 3, 1.8);
}

function moveEnemy(g, step) {
  const p = g.position;
  const tryMove = (axis, d) => {
    p[axis] += d;
    for (const c of W.colliders) {
      if (p.x + .3 > c.min.x && p.x - .3 < c.max.x &&
          p.y + 2.2 > c.min.y && p.y + .25 < c.max.y &&
          p.z + .3 > c.min.z && p.z - .3 < c.max.z) { p[axis] -= d; return; }
    }
  };
  tryMove('x', step.x); tryMove('z', step.z);
}

/* ================= UI ================= */

export function updateHUD() {
  document.querySelector('#hpbar i').style.width = (P.hp / P.maxHp * 100) + '%';
  document.querySelector('#arbar i').style.width = P.armor + '%';
  document.querySelector('#stbar i').style.width = P.stamina + '%';
  const a = document.getElementById('ammo');
  const names = { 1: 'КЛЮЧ', 2: 'ПМ', 3: 'АКС-74У', 4: 'ОБРЕЗ' };
  if (P.weapon === 1) a.innerHTML = names[1];
  else a.innerHTML = `${names[P.weapon]}<br><b>${P.clip[P.weapon]}</b> / ${P.ammo[P.weapon]}`;
  document.getElementById('godmode').style.display = P.god ? 'block' : 'none';
}

export function toast(text) { subtitle(null, text, 2.2); }

let subQueue = [], subActive = null;
export function subtitle(who, text, dur = 4) { subQueue.push({ who, text, dur }); }
export function radioSay(text, dur = 4.5) {
  subQueue.push({ who: 'РАЦИЯ · НЕИЗВЕСТНЫЙ', text, dur, radio: true });
}
export function paSay(text, dur = 5) {
  subQueue.push({ who: 'ГРОМКАЯ СВЯЗЬ', text, dur, pa: true });
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
    if (subActive.pa) Snd.pa();
    el.innerHTML = (subActive.who ? `<span class="who">${subActive.who}</span>` : '') + subActive.text;
    el.style.display = 'block';
  }
}
export function clearSubtitles() { subQueue = []; }

export function setObjective(text) {
  document.getElementById('objective').textContent = text;
}
export function showPaper(text) {
  document.getElementById('paper-text').textContent = text;
  document.getElementById('paper').style.display = 'flex';
  document.exitPointerLock();
}
export function hidePaper() { document.getElementById('paper').style.display = 'none'; }
export function paperOpen() { return document.getElementById('paper').style.display === 'flex'; }
