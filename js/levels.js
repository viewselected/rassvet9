// ПРОСВЕТ-9 v2 · уровни
import * as THREE from 'three';
import { E, psxify } from './engine.js';
import { T, mat, Snd, signTexture, graffitiTexture, posterTexture } from './assets.js';
import { W, P, addCollider, spawnPlayer, spawnShade, spawnCrawler, spawnGunner,
         radioSay, paSay, subtitle, toast, setObjective, showPaper, spark } from './game.js';

/* ============ КОНСТРУКТОР ============ */

function box(x, y, z, sx, sy, sz, material, solid = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  psxify(m.material);
  E.scene.add(m);
  if (solid) addCollider(x, y, z, sx, sy, sz);
  return m;
}
function decor(x, y, z, sx, sy, sz, material) { return box(x, y, z, sx, sy, sz, material, false); }

/* комната: пол, потолок, 4 стены, в каждой может быть центральный проём {w,h} */
function room(cx, cz, w, d, h, o = {}) {
  const mw = o.wall || mat(T.concrete);
  const mf = o.floor || mat(T.floorConc);
  const mc = o.ceil || mat(T.ceil);
  const t = .4;
  box(cx, -.2, cz, w + t*2, .4, d + t*2, mf);                    // пол
  if (!o.noCeil) box(cx, h + .2, cz, w + t*2, .4, d + t*2, mc);  // потолок
  const wallSeg = (x, z, sx, sz, hh, y = hh/2) => box(x, y, z, sx, hh, sz, mw);
  const side = (axis, sign, open) => {
    const len = axis === 'z' ? w : d;
    const wx = axis === 'z' ? cx : cx + sign * (w/2 + t/2);
    const wz = axis === 'z' ? cz + sign * (d/2 + t/2) : cz;
    if (!open) {
      axis === 'z' ? wallSeg(wx, wz, len + t*2, t, h) : wallSeg(wx, wz, t, len + t*2, h);
      return;
    }
    const ow = open.w || 2, oh = open.h || 2.6, off = open.off || 0;
    const segA = (len - ow) / 2 + off, segB = (len - ow) / 2 - off;
    if (axis === 'z') {
      if (segA > .05) wallSeg(cx - len/2 + segA/2, wz, segA, t, h);
      if (segB > .05) wallSeg(cx + len/2 - segB/2, wz, segB, t, h);
      wallSeg(cx - len/2 + segA + ow/2, wz, ow, t, h - oh, oh + (h - oh)/2);
    } else {
      if (segA > .05) wallSeg(wx, cz - len/2 + segA/2, t, segA, h);
      if (segB > .05) wallSeg(wx, cz + len/2 - segB/2, t, segB, h);
      wallSeg(wx, cz - len/2 + segA + ow/2, t, ow, h - oh, oh + (h - oh)/2);
    }
  };
  side('z', -1, o.n); // north = -z
  side('z',  1, o.s);
  side('x',  1, o.e);
  side('x', -1, o.w);
}


/* короткий переход между комнатами */
function link(cx, cz, w, d, h, axis = 'x') {
  box(cx, -.2, cz, w + .6, .4, d + .6, mat(T.floorConc));
  box(cx, h + .2, cz, w + .6, .4, d + .6, mat(T.ceil));
  if (axis === 'x') { // проход вдоль x — стены по z
    box(cx, h/2, cz - d/2 - .15, w + .6, h, .3, mat(T.concrete));
    box(cx, h/2, cz + d/2 + .15, w + .6, h, .3, mat(T.concrete));
  } else {
    box(cx - w/2 - .15, h/2, cz, .3, h, d + .6, mat(T.concrete));
    box(cx + w/2 + .15, h/2, cz, .3, h, d + .6, mat(T.concrete));
  }
}

/* люминесцентная трубка: светящаяся полоса + опц. реальный свет + мерцание */
const flickers = [];
function fluor(x, y, z, len = 2, axis = 'x', o = {}) {
  const tube = new THREE.Mesh(
    new THREE.BoxGeometry(axis === 'x' ? len : .12, .06, axis === 'z' ? len : .12),
    new THREE.MeshBasicMaterial({ color: o.color || 0xdfe8d8 })
  );
  tube.position.set(x, y, z);
  E.scene.add(tube);
  let light = null;
  if (o.light !== false) {
    light = new THREE.PointLight(o.color || 0xd8e2cc, o.i || 40, o.dist || 24);
    light.position.set(x, y - .3, z);
    E.scene.add(light);
  }
  if (o.flicker) flickers.push({ tube, light, base: o.i || 12, speed: o.flicker, seed: Math.random() * 99 });
  return { tube, light };
}
function redLamp(x, y, z, i = 8) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xc84a3a }));
  b.position.set(x, y, z); E.scene.add(b);
  const l = new THREE.PointLight(0xc84a3a, i * 2.6, 16);
  l.position.set(x, y, z); E.scene.add(l);
  return { b, l };
}
export function updateFlicker(t) {
  for (const f of flickers) {
    const v = Math.sin(t * f.speed + f.seed) + Math.sin(t * f.speed * 3.7 + f.seed * 2);
    const on = v > -0.6;
    f.tube.visible = on;
    if (f.light) f.light.intensity = on ? f.base : 0;
  }
}

/* трубы вдоль стены */
function pipes(x, y, z, len, axis = 'z', n = 2) {
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(.07 + i * .02, .07 + i * .02, len, 6),
      mat(T.rust)
    );
    p.rotation[axis === 'z' ? 'x' : 'z'] = Math.PI/2;
    p.position.set(x + (axis === 'z' ? i * .25 : 0), y + (axis === 'z' ? 0 : i * .25), z + (axis === 'x' ? 0 : 0));
    if (axis === 'x') p.position.z = z;
    psxify(p.material);
    E.scene.add(p);
  }
}

/* декор с текстом */
function sign(x, y, z, lines, ry = 0, o = {}) {
  const t = signTexture(lines, o);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(o.sw || 1.6, o.sh || .6),
    new THREE.MeshBasicMaterial({ map: t, transparent: false }));
  m.position.set(x, y, z); m.rotation.y = ry;
  E.scene.add(m);
}
function graffiti(x, y, z, text, ry = 0, color, size) {
  const t = graffitiTexture(text, color, size);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65),
    new THREE.MeshLambertMaterial({ map: t, transparent: true }));
  m.position.set(x, y, z); m.rotation.y = ry;
  psxify(m.material);
  E.scene.add(m);
}
function poster(x, y, z, title, sub, ry = 0) {
  const t = posterTexture(title, sub);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.2),
    new THREE.MeshLambertMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = ry;
  psxify(m.material);
  E.scene.add(m);
}

function crate(x, z, s = 1.4) { box(x, s/2, z, s, s, s, mat(T.wood)); }
function barrel(x, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1.15, 8), mat(T.rust));
  m.position.set(x, .575, z);
  psxify(m.material); E.scene.add(m);
  addCollider(x, .6, z, .9, 1.3, .9);
}
function locker(x, z, ry = 0) {
  const m = box(x, 1, z, .9, 2, .5, mat(T.metal));
  m.rotation.y = ry;
}
function bodyProp(x, z, ry = 0) { // погибший боец
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: 0x3d443c });
  const b = new THREE.Mesh(new THREE.BoxGeometry(.55, .28, 1.5), uni);
  const h = new THREE.Mesh(new THREE.BoxGeometry(.26, .24, .28), new THREE.MeshLambertMaterial({ color: 0x8a7f6d }));
  h.position.set(.05, 0, .85);
  psxify(uni);
  g.add(b, h);
  g.position.set(x, .15, z); g.rotation.y = ry;
  E.scene.add(g);
}
function glassPane(x, y, z, sw, sh, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
    new THREE.MeshLambertMaterial({ map: T.glass, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry;
  psxify(m.material);
  E.scene.add(m);
  // ходить сквозь нельзя, стрелять/видеть можно
  addCollider(x, y, z, ry ? .1 : sw, sh, ry ? sw : .1, false);
}

function item(x, y, z, type, amount = 0, extra = {}) {
  const colors = { medkit: 0xb5372a, armor: 0x4a6a8a, ammo2: 0x8a8a5a, ammo3: 0x9a7a3a,
                   ammo4: 0x8a6a3a, pistol: 0x3a3d42, ak: 0x5a4530, shotgun: 0x4a3a26, key: 0xc9b458 };
  let geo;
  if (extra.shape === 'can') geo = new THREE.CylinderGeometry(.16, .16, .42, 6);
  else if (type === 'ak') geo = new THREE.BoxGeometry(.14, .18, .9);
  else geo = new THREE.BoxGeometry(.34, .22, .34);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    color: colors[type] || 0x888888, emissive: colors[type] || 0x888888, emissiveIntensity: .15 }));
  psxify(m.material);
  m.position.set(x, y, z);
  E.scene.add(m);
  W.items.push({ mesh: m, type, amount, taken: false, ...extra });
}
function note(x, y, z, text, flat = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.4, .5),
    new THREE.MeshLambertMaterial({ color: 0xcfc9b6, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  if (flat) { m.rotation.x = -Math.PI/2 + .08; m.rotation.z = Math.random(); }
  psxify(m.material);
  E.scene.add(m);
  W.interact.push({ pos: new THREE.Vector3(x, y, z), r: 2, label: 'прочитать записку', use: () => showPaper(text) });
}
function trigger(x, y, z, sx, sy, sz, enter, once = true) {
  W.triggers.push({
    min: new THREE.Vector3(x - sx/2, y - sy/2, z - sz/2),
    max: new THREE.Vector3(x + sx/2, y + sy/2, z + sz/2),
    once, fired: false, enter,
  });
}
function slidingDoor(x, y, z, sx, sy, sz, dx, dy, dz, material) {
  const m = box(x, y, z, sx, sy, sz, material || mat(T.metal));
  const collider = W.colliders[W.colliders.length - 1];
  const d = {
    mesh: m, open: false, t: 0,
    from: m.position.clone(),
    to: m.position.clone().add(new THREE.Vector3(dx, dy, dz)),
    collider, size: new THREE.Vector3(sx, sy, sz),
  };
  W.doors.push(d);
  return d;
}

function skyOutdoor(fogColor, fogDensity, discColor) {
  E.scene.background = new THREE.Color(fogColor);
  E.scene.fog = new THREE.FogExp2(fogColor, fogDensity);
  if (discColor) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(26, 20),
      new THREE.MeshBasicMaterial({ color: discColor, fog: false, transparent: true, opacity: .85 }));
    d.position.set(60, 120, -240); d.lookAt(0, 0, 0);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(46, 20),
      new THREE.MeshBasicMaterial({ color: discColor, fog: false, transparent: true, opacity: .15 }));
    halo.position.copy(d.position); halo.lookAt(0, 0, 0);
    E.scene.add(d, halo);
  }
}
function interiorAtmo(color = 0x0a0c0e, density = .045, amb = .18) {
  E.scene.background = new THREE.Color(color);
  E.scene.fog = new THREE.FogExp2(color, density);
  E.scene.add(new THREE.AmbientLight(0x9aa2b0, amb));
  E.scene.add(new THREE.HemisphereLight(0x9aa4b4, 0x4a4a44, .9));
}

/* =====================================================
   ГЛАВА 1 · «СПУСК» — вагонетка и первые коридоры
===================================================== */

function level1() {
  interiorAtmo(0x11151a, .02, 1.0);
  W.flags.hardFloor = true;
  flickers.length = 0;

  // --- платформа отправления ---
  room(0, 2, 9, 12, 4, { n: { w: 3.4, h: 3.6 }, floor: mat(T.floorMetal) });
  fluor(0, 3.8, 0, 3, 'x');
  fluor(0, 3.8, 5, 3, 'x', { flicker: 7, i: 10 });
  sign(0, 3.1, 7.7, ['ПРОСВЕТ-9', 'ТРАНСПОРТНЫЙ УЗЕЛ «А»'], Math.PI, { sw: 3, sh: .9, fs: 24 });
  poster(-4.3, 1.8, 4, 'НЕ БОЛТАЙ', 'посторонним о работе объекта не сообщать', Math.PI/2);
  poster(4.3, 1.8, 2, 'ТБ №4', 'при сигнале тревоги следуй за жёлтой линией', -Math.PI/2);
  pipes(-4.2, 3.2, 2, 11, 'z', 2);

  // вагонетка (следует за игроком в поездке)
  const cart = new THREE.Group();
  const cm = mat(T.metal);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2, .25, 3.2), cm); base.position.y = .35;
  const rimF = new THREE.Mesh(new THREE.BoxGeometry(2, .9, .15), cm); rimF.position.set(0, .9, -1.55);
  const rimB = rimF.clone(); rimB.position.z = 1.55;
  const rimL = new THREE.Mesh(new THREE.BoxGeometry(.15, .9, 3.2), cm); rimL.position.set(-.95, .9, 0);
  const rimR = rimL.clone(); rimR.position.x = .95;
  psxify(cm);
  cart.add(base, rimF, rimB, rimL, rimR);
  cart.position.set(0, 0, 2);
  E.scene.add(cart);

  // --- тоннель ---
  const TL = -170; // конец тоннеля
  // пол/потолок/рельсы одним куском
  box(0, -.2, TL/2 - 2, 6, .4, -TL + 16, mat(T.floorConc));
  box(0, 3.6, TL/2 - 2, 6, .4, -TL + 16, mat(T.ceil));
  decor(-.5, .05, TL/2, .12, .1, -TL, mat(T.rust));
  decor(.5, .05, TL/2, .12, .1, -TL, mat(T.rust));
  // стены сегментами с оконными разрывами слева
  const windows = [[-52, -40], [-96, -84], [-132, -122]];
  let segStart = -4;
  const wallM = mat(T.wallStripe);
  for (const [a, b] of windows) {
    box(-2.6, 1.8, (segStart + b)/2, .4, 3.6, Math.abs(segStart - b), wallM); // до окна
    // окно: стекло + перемычки
    glassPane(-2.6, 1.9, (a + b)/2, Math.abs(a - b), 2.2, Math.PI/2);
    box(-2.6, .4, (a + b)/2, .4, .8, Math.abs(a - b), wallM);
    box(-2.6, 3.3, (a + b)/2, .4, .6, Math.abs(a - b), wallM);
    segStart = a;
  }
  box(-2.6, 1.8, (segStart + TL)/2, .4, 3.6, Math.abs(segStart - TL), wallM);
  box(2.6, 1.8, (TL - 4)/2, .4, 3.6, -TL + 4, wallM); // правая сплошная
  // свет в тоннеле: редкие лампы, часть мигает
  for (let z = -12; z > TL; z -= 14) {
    fluor(0, 3.5, z, 1.6, 'x', { i: 9, dist: 10, flicker: z % 42 === 0 ? 9 : 0 });
  }
  pipes(2.2, 3, TL/2, -TL, 'z', 3);
  sign(2.35, 2.2, -30, ['ДЕРЖИСЬ', 'ПРАВОЙ СТОРОНЫ'], -Math.PI/2, { sw: 1.4, sh: .7 });
  graffiti(2.35, 1.4, -70, 'ОНИ СЛЫШАТ', -Math.PI/2, '#3a3f4a', 52);

  // сцены за окнами (слева, x ≈ -6..-12)
  // 1: цех со сваркой
  room(-8, -46, 10, 12, 4, { wall: mat(T.metal), floor: mat(T.floorMetal) });
  crate(-10, -44); crate(-8, -49); barrel(-11, -49);
  fluor(-8, 3.6, -46, 2, 'x', { i: 8 });
  let sparkT = 0;
  // 2: пустая платформа с тенью
  room(-8, -90, 10, 12, 4, { wall: mat(T.concrete) });
  fluor(-8, 3.6, -90, 2, 'x', { i: 6, flicker: 5 });
  const platformShade = spawnShade(-8, 0, -90, { aggroR: -1, speed: 0 });
  // 3: разгромленная секция, аварийка
  room(-8, -127, 10, 10, 4, { wall: mat(T.concrete) });
  redLamp(-8, 3.2, -127, 10);
  crate(-9, -125, 1); barrel(-6, -129);
  graffiti(-8, 1.6, -131.8, 'ВЫХОДА НЕТ', 0, '#8b2f24', 56);

  // --- платформа прибытия ---
  room(0, -178, 10, 14, 4, { s: { w: 3.4, h: 3.6 }, w: { w: 2.2, h: 2.8 }, floor: mat(T.floorMetal) });
  fluor(0, 3.8, -176, 3, 'x', { flicker: 6 });
  redLamp(4.4, 3, -182, 6);
  sign(0, 3.1, -184.5, ['УЗЕЛ «Б» · ГОРИЗОНТ 2', 'ПОСАДКИ НЕТ'], 0, { sw: 3.4, sh: .9, fs: 22 });
  graffiti(-1.5, 1.5, -184.4, 'НЕ ВЕРЬ ГОЛОСУ', 0, '#20303c', 46);

  // --- коридоры на запад ---
  link(-6, -178, 2.4, 2.2, 2.8, 'x');   // платформа → вестибюль
  link(-13, -183.3, 2, 2.2, 2.6, 'z');  // вестибюль → медпункт
  const KX = -5.4; // стык
  // вестибюль с кафелем
  room(-13, -178, 12, 8, 3.4, { e: { w: 2.2, h: 2.8 }, n: { w: 2, h: 2.6 }, s: { w: 2, h: 2.6 }, wall: mat(T.tile), floor: mat(T.floorConc) });
  fluor(-13, 3.2, -178, 2.4, 'x');
  poster(-13, 1.9, -181.7, 'ГИГИЕНА', 'мойте руки после каждого спуска на горизонт', 0);
  graffiti(-16.5, 1.5, -181.7, 'ХУЙ', 0, '#c8483a', 68);
  graffiti(-10, 1.2, -174.4, 'СВЕТА НЕТ ХОДА НЕТ', Math.PI, '#3a3f4a', 40);
  locker(-18.6, -176.5); locker(-18.6, -175.4);

  // медпункт (север от вестибюля)
  room(-13, -188, 8, 8, 3.2, { s: { w: 2, h: 2.6 }, wall: mat(T.tile) });
  fluor(-13, 3, -188, 2, 'x', { flicker: 8, i: 9 });
  sign(-13, 2.7, -184.4, ['МЕДПУНКТ'], Math.PI, { sw: 1.6, sh: .5, bg: '#3c2020' });
  item(-15, .6, -190, 'medkit', 40);
  item(-11.5, .6, -190.5, 'medkit', 25);
  note(-13, .9, -187,
`Журнал медпункта, последняя запись.
Поступило шестеро с горизонта 3. Все с одним и тем же:
смотрят мимо тебя, зрачки как у рыбы, пульс сорок.
Говорят хором, если стоят рядом. Разводить по разным
комнатам. НЕ СТАВИТЬ ДРУГ НАПРОТИВ ДРУГА.`);

  // коридор дальше на запад из вестибюля? — нет, юг: техкоридор
  room(-13, -167, 4, 14, 3, { s: { w: 2, h: 2.6 }, n: { w: 2, h: 2.6 }, wall: mat(T.wallStripe) });
  pipes(-14.8, 2.4, -167, 13, 'z', 2);
  fluor(-13, 2.8, -170, 1.6, 'x', { i: 8 });
  fluor(-13, 2.8, -163, 1.6, 'x', { i: 8, flicker: 11 });
  // вент-решётка на стене — отсюда полезут
  decor(-11.2, .8, -166, .1, 1, 1.4, mat(T.metal));

  // зал с охранником и стеклом
  room(-13, -152, 14, 14, 3.6, { s: { w: 2, h: 2.6 }, w: { w: 2.4, h: 2.8 }, floor: mat(T.floorMetal) });
  fluor(-16, 3.4, -152, 2, 'x');
  fluor(-9, 3.4, -152, 2, 'x', { flicker: 6 });
  crate(-17, -156); crate(-15.5, -157); barrel(-9, -147);
  bodyProp(-13, -150, .6);
  item(-13, .45, -149.2, 'pistol');
  item(-12, .45, -149.8, 'ammo2', 16);
  note(-14, .5, -150.5, 
`Рапорт. Пост 2-Б.
Слышим в вентиляции возню уже третьи сутки. Не крысы —
крысы ушли ещё до События. Прошу разрешения заварить
решётки. Ответа с поверхности нет. Патронов мало.
Если найдёшь это — забери мой ПМ. Мне уже не надо.`);
  // стекло в диспетчерскую, за ним тень
  glassPane(-13, 1.8, -159, 6, 2.4, 0);
  room(-13, -163.5, 8, 5, 3.2, { wall: mat(T.concrete) });
  redLamp(-13, 2.8, -163, 7);
  const glassShade = spawnShade(-13, 0, -163.5, { aggroR: -1, speed: 0 });

  // лифтовый холл (запад) = выход
  room(-25, -152, 8, 8, 3.4, { e: { w: 2.4, h: 2.8 }, wall: mat(T.metal), floor: mat(T.floorMetal) });
  fluor(-25, 3.2, -152, 2, 'x');
  sign(-28.5, 2.4, -152, ['ЛИФТ · ГОРИЗОНТ 3', 'ЦЕХА'], Math.PI/2, { sw: 2, sh: .8 });
  const liftDoor = slidingDoor(-28.8, 1.6, -152, .4, 3.2, 2.6, 0, 3.4, 0);
  W.interact.push({
    pos: new THREE.Vector3(-28.2, 1.5, -152), r: 2.2, label: 'вызвать лифт',
    use: () => {
      if (W.flags.lift) return;
      W.flags.lift = true;
      Snd.door(); liftDoor.open = true;
      toast('лифт открыт');
      setTimeout(() => nextLevel(), 2200);
    }
  });

  // ================= СЦЕНАРИЙ =================
  let tram = null;
  W.interact.push({
    pos: new THREE.Vector3(0, 1.5, 2), r: 2.4, label: 'сесть в вагонетку',
    use: () => {
      if (W.flags.riding) return;
      W.flags.riding = true;
      P.locked = true;
      tram = Snd.tramLoop();
      W.rail = {
        points: [new THREE.Vector3(0, 1.75, 2), new THREE.Vector3(0, 1.75, -176)],
        t: 0, speed: 1 / 78,
        onArrive: () => {
          tram?.stop();
          paSay('Узел «Б». Конечная. Дальнейшее движение... дальнейшего движения нет.', 6);
          setObjective('найти лифт на горизонт 3');
        }
      };
      paSay('Отправление. Время в пути — четыре минуты. Не покидайте вагонетку.', 5);
    }
  });
  // реплики по ходу поездки — триггеры по z
  trigger(0, 1.8, -20, 8, 4, 4, () => paSay('Напоминаем: разговоры о Событии приравниваются к распространению слухов.', 6));
  trigger(0, 1.8, -46, 8, 4, 6, () => {
    subtitle(null, '— за стеклом кто-то оставил сварку включённой. людей нет —', 4.5);
  });
  trigger(0, 1.8, -66, 8, 4, 4, () => paSay('Сотрудникам горизонта 3: явка в медпункт обязательна. Повторяем. Явка обязательна. Явка. Явка.', 7));
  trigger(0, 1.8, -90, 8, 4, 6, () => {
    subtitle(null, '— на заброшенной платформе стоит фигура. она поворачивает голову вслед вагонетке —', 5);
  });
  trigger(0, 1.8, -112, 8, 4, 4, () => radioSay('...тук-тук. Это я. Не пугайся голоса. Я на твоей частоте один. Пока — один.', 6.5));
  trigger(0, 1.8, -127, 8, 4, 6, () => paSay('Гор... горизонт затоплен светом. Просьба не смотреть. Просьба не смотреть. Прось—', 6));

  // прибытие: вылезаешь — реплика
  trigger(-6, 1.8, -178, 3, 4, 6, () => {
    radioSay('Вылезай. Тут уже никто не проверяет пропуск. Найди медпункт — тебе понадобится то, что там осталось.', 7);
    setObjective('осмотреть вестибюль и медпункт');
  });
  // вент-сцена в техкоридоре
  trigger(-13, 1.5, -168, 4, 3, 3, () => {
    Snd.hitMetal();
    subtitle(null, '— решётка вентиляции падает на пол за спиной —', 3.5);
    setTimeout(() => {
      spawnCrawler(-11.5, 0, -166);
      spawnCrawler(-13, 0, -171);
      Snd.skitter();
    }, 900);
  });
  // зал: после подбора ПМ — волна ползунов
  trigger(-13, 1.5, -150, 5, 3, 4, () => {
    setTimeout(() => {
      spawnCrawler(-18, 0, -147);
      spawnCrawler(-8, 0, -156);
      spawnCrawler(-13, 0, -146);
    }, 1500);
    radioSay('Слышишь в стенах? Они любят, когда тепло и есть звук. Ты — и тепло, и звук.', 6);
  });

  W.update = (dt, t) => {
    // вагонетка едет с игроком
    if (W.flags.riding && W.rail) {
      cart.position.set(P.pos.x, P.pos.y - 1.75, P.pos.z);
    }
    // искры сварки в первой сцене
    sparkT -= dt;
    if (sparkT <= 0) {
      spark(new THREE.Vector3(-10, 1, -44), 0xcfe0ff, 4, 2.5);
      sparkT = .5 + Math.random() * 1.4;
    }
    updateFlicker(t);
  };

  spawnPlayer(0, 1.7, 6, 0);
  setObjective('сесть в вагонетку до узла «Б»');
  Snd.ambience(.03, .06, .05);
  paSay('Внимание. Дежурная смена семь. Транспортный узел «А» работает в штатном режиме.', 6);
  return { vhs: .1 };
}

/* =====================================================
   ГЛАВА 2 · «ЦЕХА» — боевой уровень
===================================================== */

function level2() {
  interiorAtmo(0x10130f + 0x000101, .018, .95);
  W.flags.hardFloor = true;
  flickers.length = 0;

  // лифтовый холл
  room(0, 0, 8, 8, 3.4, { n: { w: 2.6, h: 2.8 }, wall: mat(T.metal), floor: mat(T.floorMetal) });
  fluor(0, 3.2, 0, 2, 'x');
  sign(0, 2.8, 3.7, ['ГОРИЗОНТ 3 · ЦЕХА', 'ПОСТОРОННИМ В.'], Math.PI, { sw: 2.6, sh: .8 });
  graffiti(-3, 1.4, 3.6, 'ТУТ БЫЛ СЛАВИК', Math.PI, '#4a6a8a', 34);
  graffiti(3, 1.7, 3.6, 'СЛАВИК ХУЙ', Math.PI, '#c8483a', 34);

  // коридор к цеху А
  room(0, -11, 5, 14, 3.2, { n: { w: 3, h: 2.8 }, s: { w: 2.6, h: 2.8 }, wall: mat(T.wallStripe) });
  fluor(0, 3, -7, 1.6, 'x', { i: 9 });
  fluor(0, 3, -15, 1.6, 'x', { i: 9, flicker: 8 });
  pipes(2, 2.6, -11, 13, 'z', 3);
  poster(-2.3, 1.8, -9, 'НОРМА', 'выработка смены — закон. отстающих не ждут', Math.PI/2);
  graffiti(-2.35, 1.2, -14, 'НОРМУ В ЖОПУ', Math.PI/2, '#8b2f24', 42);

  link(0, -19, 3, 2.4, 2.8, 'z'); // коридор → цех А
  // ЦЕХ А — большая арена с укрытиями
  room(0, -30, 24, 20, 5.4, { s: { w: 3, h: 2.8 }, n: { w: 2.6, h: 3, off: -6 }, e: { w: 2, h: 2.6 }, floor: mat(T.floorConc) });
  fluor(-7, 5.1, -26, 2.6, 'x', { i: 11 });
  fluor(7, 5.1, -26, 2.6, 'x', { i: 11, flicker: 5 });
  fluor(-7, 5.1, -35, 2.6, 'x', { i: 11, flicker: 9 });
  fluor(7, 5.1, -35, 2.6, 'x', { i: 11 });
  // станки и укрытия
  const machine = (x, z) => { box(x, 1, z, 2.6, 2, 1.6, mat(T.metal)); box(x, 2.3, z, 1, .6, 1, mat(T.rust)); };
  machine(-7, -27); machine(-7, -33); machine(7, -27); machine(7, -33);
  crate(0, -25); crate(-1.6, -25); crate(-.8, -24); // стопка в центре-севере
  crate(3, -36); crate(-4, -37); barrel(10, -38); barrel(10.8, -37);
  sign(0, 4.6, -39.7, ['ЦЕХ СБОРКИ №1'], 0, { sw: 3, sh: .8, fs: 26 });
  graffiti(-11.7, 2, -30, 'ОНИ В СТЕНАХ', Math.PI/2, '#20303c', 48);
  bodyProp(2, -29, 1.2);
  item(2, .45, -28.2, 'ak');
  item(3, .45, -29, 'ammo3', 30);
  item(-7, 2.2, -33, 'medkit', 25); // на станке — заметишь если смотришь вверх

  // санузел (восток) — кафель и код
  room(16, -30, 8, 8, 3, { w: { w: 2, h: 2.6 }, wall: mat(T.tile) });
  fluor(16, 2.8, -30, 1.6, 'x', { flicker: 10, i: 8 });
  graffiti(19.6, 1.6, -30, 'ХУЙ ВСЕМУ', -Math.PI/2, '#c8483a', 50);
  graffiti(16, 1.3, -33.6, '1957 ПОМНИМ', 0, '#3a3f4a', 36);
  box(16, .5, -33, 4, 1, .8, mat(T.tile)); // раковины
  item(18.5, .6, -27, 'medkit', 30);
  note(14, .9, -27.5,
`Смена 3, для своих.
Кладовку опять закрыли. Код как год когда Петрович
устроился, он ещё всем плешь проел этим. Кто не помнит —
на стене в сортире написано. Да, ЭТО не просто так
написано.`);

  // кодовая дверь на север цеха А (off -6 → проём левее центра)
  const codeDoor = slidingDoor(-6, 1.5, -40.2, 2.6, 3, .45, 0, 3.2, 0);
  sign(-6, 3.4, -39.8, ['СКЛАД-КЛАДОВАЯ', 'КОД У ДЕЖУРНОГО'], 0, { sw: 2.2, sh: .7, fs: 15 });
  W.interact.push({
    pos: new THREE.Vector3(-6, 1.5, -39.6), r: 2, label: 'кодовый замок',
    use: () => {
      if (codeDoor.open) return;
      const code = prompt('Введите код (4 цифры):');
      if (code === '1957') {
        Snd.door(); codeDoor.open = true;
        toast('замок открыт');
        setObjective('пройти через кладовую в цех №2');
      } else if (code !== null) {
        Snd.hitMetal();
        subtitle(null, 'замок мигает красным. неверно.', 2.5);
      }
    }
  });

  // кладовая
  room(-6, -46, 8, 10, 3.2, { s: { w: 2.6, h: 3 }, n: { w: 2.4, h: 2.8 }, wall: mat(T.metal), floor: mat(T.floorMetal) });
  fluor(-6, 3, -46, 1.8, 'x', { i: 9 });
  locker(-9.5, -44); locker(-9.5, -42.8); locker(-2.5, -49);
  item(-6, .6, -46, 'armor', 60);
  item(-8, .6, -48, 'ammo3', 30);
  item(-4, .6, -48, 'ammo2', 16);
  item(-8.5, .6, -44, 'ammo4', 6);

  // ЦЕХ Б — тьма и аварийка
  room(-6, -60, 20, 16, 5, { s: { w: 2.4, h: 2.8 }, w: { w: 2.4, h: 2.8, off: -3 }, floor: mat(T.floorConc) });
  const bLights = [
    fluor(-11, 4.7, -57, 2.4, 'x', { i: 10 }),
    fluor(-1, 4.7, -57, 2.4, 'x', { i: 10 }),
    fluor(-11, 4.7, -64, 2.4, 'x', { i: 10 }),
    fluor(-1, 4.7, -64, 2.4, 'x', { i: 10 }),
  ];
  const emLamps = [];
  machine(-11, -58); machine(-1, -62);
  crate(-6, -64); crate(-7.5, -64); barrel(-13, -66); crate(-2, -55);
  graffiti(-6, 2.2, -67.7, 'СВЕТ ИХ ДЕРЖИТ', 0, '#8b2f24', 46);

  // выход на запад из цеха Б
  room(-19.5, -63, 5, 6, 3, { e: { w: 2.4, h: 2.8 }, wall: mat(T.wallStripe) });
  redLamp(-19.5, 2.7, -63, 7);
  sign(-21.7, 2.3, -63, ['К НИИ →'], Math.PI/2, { sw: 1.4, sh: .5 });
  trigger(-21, 1.5, -63, 2, 3, 4, () => nextLevel());

  // ---------- враги и сценарий ----------
  spawnGunner(-7, 0, -34, { aggroR: 18 });
  spawnGunner(8, 0, -26, { aggroR: 18 });
  const g3 = spawnGunner(0, 0, -37, { aggroR: 30, hp: 65 });

  trigger(0, 1.5, -6, 6, 3, 3, () => {
    radioSay('Горизонт три. До События здесь работали в три смены. Сейчас смена одна, и она не кончается.', 7);
  });
  trigger(0, 1.5, -21, 5, 3, 3, () => {
    subtitle(null, '— впереди в цеху кто-то ходит. шаг ровный, механический —', 4);
    setObjective('пройти цех №1');
  });
  // хореография: блэкаут в цехе Б
  let blackoutDone = false;
  trigger(-6, 1.5, -57, 6, 3, 4, () => {
    if (blackoutDone) return;
    blackoutDone = true;
    radioSay('Стой. Слышишь? Генератор ниже этажом кашляет. Если свет ляжет — не стой на месте.', 6);
    setTimeout(() => {
      // гаснет всё
      bLights.forEach(l => { l.tube.visible = false; if (l.light) l.light.intensity = 0; });
      Snd.door();
      subtitle(null, '— свет гаснет. где-то глубоко замолкает гул —', 4);
      setTimeout(() => {
        emLamps.push(redLamp(-11, 4.5, -60, 9), redLamp(-1, 4.5, -60, 9));
        const alarm = Snd.alarm();
        setTimeout(() => alarm?.stop(), 7000);
        spawnShade(-14, 0, -66, { aggroR: 40 });
        spawnShade(-1, 0, -67, { aggroR: 40 });
        spawnCrawler(-6, 0, -55, { aggroR: 40 });
        spawnCrawler(-12, 0, -56, { aggroR: 40 });
        radioSay('ОНИ ИДУТ НА КРАСНЫЙ. Держись подальше от ламп. Или наоборот. Я всегда путаю.', 6);
      }, 2500);
    }, 4000);
  });

  W.update = (dt, t) => updateFlicker(t);

  spawnPlayer(0, 1.7, 2.5, 0);
  setObjective('найти проход к цехам');
  Snd.ambience(.02, .07, .06);
  return { vhs: .14 };
}

/* =====================================================
   ГЛАВА 3 · «ПОВЕРХНОСТЬ» — сумеречная пустошь
===================================================== */

function level3() {
  skyOutdoor(0x4a4e58, .01, 0xe8e4d4);
  E.scene.add(new THREE.HemisphereLight(0x7a828e, 0x3c3a32, 1.7));
  W.flags.hardFloor = false;
  flickers.length = 0;

  const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(T.dirt));
  g.rotation.x = -Math.PI/2; psxify(g.material); E.scene.add(g);
  addCollider(0, -.5, 0, 300, 1, 300);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 300), mat(T.floorConc));
  road.rotation.x = -Math.PI/2; road.position.y = .02;
  psxify(road.material); E.scene.add(road);

  const pole = (x, z) => {
    box(x, 3.5, z, .22, 7, .22, mat(T.wood));
    decor(x, 6.6, z, 2.2, .12, .12, mat(T.wood));
  };
  for (let z = 60; z > -90; z -= 18) pole(5.5, z);

  const houseAt = (x, z, w, d, h, rotY = 0) => {
    const wall = mat(T.concrete);
    const t = .3, doorW = 1.4, doorH = 2.3;
    const place = (lx, ly, lz, sx, sy, sz, material = wall) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
      m.position.set(x + (rotY ? lz : lx), ly, z + (rotY ? -lx : lz));
      if (rotY) m.rotation.y = Math.PI/2;
      psxify(m.material); E.scene.add(m);
      addCollider(m.position.x, ly, m.position.z, rotY ? sz : sx, sy, rotY ? sx : sz);
      return m;
    };
    place(0, h/2, -d/2, w, h, t);
    place(-w/2, h/2, 0, t, h, d);
    place(w/2, h/2, 0, t, h, d);
    const side = (w - doorW) / 2;
    place(-(doorW/2 + side/2), h/2, d/2, side, h, t);
    place(doorW/2 + side/2, h/2, d/2, side, h, t);
    place(0, doorH + (h - doorH)/2, d/2, doorW, h - doorH, t);
    place(0, .05, 0, w, .1, d, mat(T.wood));
    place(0, h + .1, 0, w + .6, .2, d + .6, mat(T.metal));
  };
  houseAt(-16, 20, 8, 7, 3.4);
  houseAt(15, 2, 9, 8, 3.6, 1);
  houseAt(-20, -22, 10, 8, 3.4);
  houseAt(18, -40, 8, 7, 3.2);
  houseAt(-14, -58, 9, 9, 3.6, 1);

  // тёплый свет в одном доме — ориентир
  const wl = new THREE.PointLight(0xe0b070, 10, 12);
  wl.position.set(-14, 2, -58); E.scene.add(wl);

  const wreck = (x, z, rot) => {
    const bm = new THREE.MeshLambertMaterial({ color: 0x474d46 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, .7, 4), bm); b.position.set(x, .6, z); b.rotation.y = rot;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, .55, 1.8), bm); c.position.set(x, 1.2, z - .2); c.rotation.y = rot;
    psxify(bm); E.scene.add(b, c);
    addCollider(x, .8, z, 2.4, 1.8, 4.2);
  };
  wreck(2, -12, .3); wreck(-3, -48, -.15);

  item(-16, .5, 20, 'medkit', 30);
  note(-15, .12, 18.5,
`Тане.
Уехали к маминым, не жди. По дороге не ходи после
темноты — они стоят у столбов и смотрят. Если стоит —
не беги. Беги только когда идёт.
— В.`);
  item(15, .5, 2, 'ammo3', 30);
  item(15.8, .5, 3, 'ammo2', 8);
  note(-20, .12, -22,
`ЖЭУ-4, объявление.
В связи с СОБЫТИЕМ подача электроэнергии прекращена.
Резервный генератор — на подстанции у южного шлагбаума.
Топливо спрашивать у Севастьянова (дом у поворота).
Администрация убыла.`);
  item(18, .5, -40, 'medkit', 25);
  item(17, .5, -39, 'ammo4', 4);
  item(-14, .55, -58, 'key', 0, { keyId: 'canister', label: 'канистра с бензином', shape: 'can' });
  graffiti(14.7, 1.8, 2, 'ДИСК НЕ СОЛНЦЕ', Math.PI/2, '#c8483a', 40);

  box(8, 1.6, -86, 5, 3.2, 4, mat(T.rust));
  box(4.4, .7, -86, 1.4, 1.4, 1, mat(T.rust));
  const gate = slidingDoor(0, 1.7, -92, 10, 3.4, .5, -10.2, 0, 0, mat(T.rust));
  box(5, 2, -92, .4, 4, .8, mat(T.concrete));
  box(-5, 2, -92, .4, 4, .8, mat(T.concrete));

  W.interact.push({
    pos: new THREE.Vector3(4.4, 1, -86), r: 2.2, label: 'генератор',
    use: () => {
      if (W.flags.genOn) return;
      if (!P.keysHeld.canister) { subtitle(null, 'бак пуст. нужно топливо.', 3); return; }
      W.flags.genOn = true;
      Snd.generator?.();
      Snd.door();
      gate.open = true;
      toast('генератор запущен — ворота открыты');
      setObjective('пройти через южные ворота к станции');
      radioSay('Слышу генератор. Наверху всегда так тихо перед. Иди к станции. Быстрее.', 6);
    }
  });

  spawnShade(6, 0, -30, { aggroR: 14 });
  spawnShade(-18, 0, -70, { aggroR: 15 });
  spawnGunner(10, 0, -55, { aggroR: 24 });
  spawnGunner(-8, 0, -78, { aggroR: 22 });
  const watcher = spawnShade(5.5, 0, -6, { aggroR: -1, speed: 0 });

  trigger(0, 1.5, 40, 30, 4, 6, () => {
    radioSay('Поверхность. Дыши, пока дают. Видишь диск? Все смотрят на него в первый раз. Хватит.', 7);
    setTimeout(() => radioSay('Топливо в домах. И читай, что люди оставили. Это всё, что от них осталось.', 7), 8000);
  });
  trigger(0, 1.5, -20, 60, 4, 4, () => subtitle(null, '— посёлок молчит. у столба стоит фигура и не шевелится —', 4));
  trigger(0, 1.5, -96, 12, 4, 4, () => nextLevel());

  spawnPlayer(0, 1.7, 52, 0);
  setObjective('найти топливо для генератора и открыть южные ворота');
  Snd.ambience(.16, .05, 0);
  return { vhs: .16 };
}

/* =====================================================
   ГЛАВА 4 · «ПРОСВЕТ-ТОВАРНАЯ»
===================================================== */

function level4() {
  skyOutdoor(0x42464e, .012, 0xe8e4d4);
  E.scene.add(new THREE.HemisphereLight(0x6a727c, 0x34322a, 1.6));
  W.flags.hardFloor = true;
  flickers.length = 0;

  const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(T.dirt));
  g.rotation.x = -Math.PI/2; psxify(g.material); E.scene.add(g);
  addCollider(0, -.5, 0, 300, 1, 300);

  box(0, .2, 0, 260, .4, 8, mat(T.floorConc));
  for (let x = -120; x < 120; x += 1.2) decor(x, .45, 0, .5, .1, 5.4, mat(T.wood));
  decor(0, .55, -1.8, 260, .12, .2, mat(T.rust));
  decor(0, .55, 1.8, 260, .12, .2, mat(T.rust));

  box(0, .5, 8, 60, 1, 6, mat(T.concrete));
  // вокзал
  room(0, 16, 16, 9, 4.2, { s: { w: 1.6, h: 2.4 }, wall: mat(T.concrete) });
  fluor(0, 3.9, 16, 2.4, 'x', { flicker: 7, i: 9 });
  sign(0, 4.7, 11.6, ['ПРОСВЕТ-ТОВАРНАЯ'], Math.PI, { sw: 4, sh: .9, fs: 26 });
  graffiti(0, 1.6, 20.2, 'ПОЕЗДА НЕ БУДЕТ', 0, '#20303c', 44);

  const wagon = (x, z) => {
    const m = mat(T.rust);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 11), m); b.position.set(x, 2, z);
    psxify(m); E.scene.add(b);
    addCollider(x, 2, z, 3.2, 3.4, 11.2);
  };
  wagon(-20, 0); wagon(-33, 0); wagon(26, 0); wagon(40, 0);
  graffiti(-20, 1.8, 1.72, 'МЫ ЕЩЁ ЗДЕСЬ', 0, '#8b2f24', 40);

  // депо
  box(-6, 3, -40, .5, 6, 20, mat(T.concrete));
  box(6, 3, -40, .5, 6, 20, mat(T.concrete));
  box(0, 6.2, -40, 12.5, .5, 20, mat(T.concrete));
  const depoGate = slidingDoor(0, 2.4, -50, 11.5, 4.8, .5, 0, 5.2, 0);
  redLamp(5.4, 5.4, -49, 8);

  box(14, 1.5, 22, 4, 3, 3, mat(T.rust));
  const lever = (x, z, id) => {
    const m = decor(x, 1.4, z, .3, .8, .2, mat(T.rust));
    m.rotation.x = .4;
    W.interact.push({
      pos: new THREE.Vector3(x, 1.4, z), r: 1.8, label: `рубильник «${id}»`,
      use: () => {
        Snd.hitMetal();
        m.rotation.x *= -1;
        W.flags.seq = (W.flags.seq || '') + id;
        if (W.flags.seq === 'ВАБ') {
          Snd.door(); depoGate.open = true;
          toast('питание депо восстановлено');
          setObjective('войти в депо');
          radioSay('Депо открыто. За ним тоннель под горкой — и дальше НИИ. Там я замолчу: стены толстые. Не для звука. Для того, что внутри.', 8);
        } else if (!'ВАБ'.startsWith(W.flags.seq)) {
          W.flags.seq = '';
          subtitle(null, 'щиток гудит и сбрасывается. порядок неверный.', 3);
        }
      }
    });
  };
  lever(12.9, 20.4, 'А'); lever(14, 20.4, 'Б'); lever(15.1, 20.4, 'В');

  note(0, 1.1, 16,
`Дежурному по станции.
Порядок подачи резервного питания на депо:
сначала ВВОДНЫЙ, потом АВАРИЙНЫЙ, потом БЛОКИРОВКА.
Не перепутай, как Гришин. Гришина больше не спрашивай.`);

  item(-20, .6, 2.5, 'ammo3', 30);
  item(26, .6, -2.5, 'medkit', 30);
  item(0, .6, 14, 'shotgun');
  item(1, .6, 14, 'ammo4', 8);
  item(-33, .6, 2.5, 'armor', 40);

  spawnShade(-14, 0, -6, { aggroR: 14 });
  spawnGunner(30, 0, 4, { aggroR: 22 });
  spawnGunner(0, 0, -30, { aggroR: 24, hp: 70 });
  spawnShade(-40, 0, 0, { aggroR: 18 });
  spawnCrawler(20, 0, 10, { aggroR: 14 });

  trigger(0, 1.5, 34, 40, 4, 4, () => {
    radioSay('Станция. До События возили руду. После — возят только в одну сторону. Щитовая на платформе, порядок знает дежурный.', 8);
  });
  trigger(0, 2, -49, 10, 5, 3, () => nextLevel());

  spawnPlayer(0, 1.7, 40, 0);
  setObjective('восстановить питание депо');
  Snd.ambience(.12, .07, 0);
  return { vhs: .18 };
}

/* ---------- реестр ---------- */

export const LEVELS = [
  { id: 1, name: 'Спуск', build: level1 },
  { id: 2, name: 'Цеха', build: level2 },
  { id: 3, name: 'Поверхность', build: level3 },
  { id: 4, name: 'Просвет-Товарная', build: level4 },
  { id: 5, name: 'НИИ, проходная', build: null },
  { id: 6, name: 'Лаборатории', build: null },
  { id: 7, name: 'Тоннели', build: null },
  { id: 8, name: 'Изнанка', build: null },
  { id: 9, name: 'Антенное поле', build: null },
  { id: 10, name: 'Просвет', build: null },
];

let onLevelEnd = null;
export function setLevelEndHandler(fn) { onLevelEnd = fn; }
export function nextLevel() { onLevelEnd?.(); }
