// ПРОСВЕТ-9 · уровни. Каждый уровень — функция build(ctx), собирающая мир из данных.
import * as THREE from 'three';
import { E, psxify } from './engine.js';
import { T, mat, Snd } from './assets.js';
import { W, P, addCollider, spawnPlayer, spawnShade,
         radioSay, subtitle, toast, setObjective, showPaper, updateHUD } from './game.js';

/* ---------- строительные хелперы ---------- */

function box(x, y, z, sx, sy, sz, material, solid = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  psxify(m.material);
  E.scene.add(m);
  if (solid) addCollider(x, y, z, sx, sy, sz);
  return m;
}

function ground(size, material) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), material);
  g.rotation.x = -Math.PI / 2;
  psxify(g.material);
  E.scene.add(g);
  addCollider(0, -.5, 0, size, 1, size);
  return g;
}

function sky(fogColor, fogDensity, discColor = null) {
  E.scene.background = new THREE.Color(fogColor);
  E.scene.fog = new THREE.FogExp2(fogColor, fogDensity);
  if (discColor) {
    // «просвет» в небе — бледный диск, который не солнце
    const d = new THREE.Mesh(
      new THREE.CircleGeometry(26, 20),
      new THREE.MeshBasicMaterial({ color: discColor, fog: false, transparent: true, opacity: .8 })
    );
    d.position.set(60, 120, -240);
    d.lookAt(0, 0, 0);
    E.scene.add(d);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(44, 20),
      new THREE.MeshBasicMaterial({ color: discColor, fog: false, transparent: true, opacity: .16 })
    );
    halo.position.copy(d.position); halo.lookAt(0, 0, 0); halo.position.z += 1;
    E.scene.add(halo);
  }
}

function lights(skyC, groundC, i = .8) {
  E.scene.add(new THREE.HemisphereLight(skyC, groundC, i));
}

// дом с интерьером: стены с дверным проёмом, окна, крыша
function house(x, z, w, d, h, rotY = 0) {
  const g = new THREE.Group();
  const wall = mat(T.panel);
  const t = .3; // толщина стен
  const doorW = 1.4, doorH = 2.3;

  const place = (lx, ly, lz, sx, sy, sz, material = wall) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    m.position.set(lx, ly, lz);
    psxify(m.material);
    g.add(m);
    // коллайдер в мировых координатах (учёт поворота — только 0 и 90°)
    let wx = x + (rotY ? lz : lx), wz = z + (rotY ? -lx : lz);
    let wsx = rotY ? sz : sx, wsz = rotY ? sx : sz;
    addCollider(wx, ly, wz, wsx, sy, wsz);
    return m;
  };

  // задняя и боковые
  place(0, h/2, -d/2, w, h, t);
  place(-w/2, h/2, 0, t, h, d);
  place(w/2, h/2, 0, t, h, d);
  // передняя с проёмом
  const side = (w - doorW) / 2;
  place(-(doorW/2 + side/2), h/2, d/2, side, h, t);
  place(doorW/2 + side/2, h/2, d/2, side, h, t);
  place(0, doorH + (h - doorH)/2, d/2, doorW, h - doorH, t);
  // пол и крыша
  place(0, .05, 0, w, .1, d, mat(T.floor));
  place(0, h + .1, 0, w + .6, .2, d + .6, mat(T.roof));
  // окна (декор на боковых стенах)
  const wm = new THREE.MeshLambertMaterial({ map: T.window });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), wm);
    win.position.set(sx * (w/2 + .01), h * .55, 0);
    win.rotation.y = sx > 0 ? Math.PI/2 : -Math.PI/2;
    psxify(win.material);
    g.add(win);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY ? Math.PI/2 : 0;
  E.scene.add(g);
  return g;
}

function fencePost(x, z) { box(x, .9, z, .15, 1.8, .15, mat(T.wood)); }
function fenceRun(x1, z1, x2, z2, step = 2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz), n = Math.floor(len / step);
  for (let i = 0; i <= n; i++) fencePost(x1 + dx * i / n, z1 + dz * i / n);
  const rail = box((x1+x2)/2, 1.2, (z1+z2)/2, Math.abs(dx) || .1, .12, Math.abs(dz) || .1, mat(T.wood), false);
}

function pole(x, z, h = 7) {
  box(x, h/2, z, .22, h, .22, mat(T.wood));
  box(x, h - .4, z, 2.2, .12, .12, mat(T.wood), false);
}

function itemMesh(color, shape = 'box') {
  let geo;
  if (shape === 'can') geo = new THREE.CylinderGeometry(.16, .16, .42, 6);
  else geo = new THREE.BoxGeometry(.34, .22, .34);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: .12 }));
  psxify(m.material);
  E.scene.add(m);
  return m;
}

function item(x, y, z, type, amount = 0, extra = {}) {
  const colors = { medkit: 0xb5372a, ammo2: 0x8a8a5a, ammo3: 0x8a6a3a, pistol: 0x3a3d42, shotgun: 0x4a3a26, key: 0xc9b458 };
  const m = itemMesh(colors[type] || 0x888888, extra.shape);
  m.position.set(x, y, z);
  W.items.push({ mesh: m, type, amount, taken: false, ...extra });
}

function note(x, y, z, text) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.4, .5),
    new THREE.MeshLambertMaterial({ color: 0xcfc9b6, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI/2 + .1;
  m.rotation.z = Math.random();
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

function slidingGate(x, y, z, sx, sy, sz, dx, dz) {
  const m = box(x, y, z, sx, sy, sz, mat(T.rust));
  const collider = W.colliders[W.colliders.length - 1];
  const d = {
    mesh: m, open: false, t: 0,
    from: m.position.clone(),
    to: m.position.clone().add(new THREE.Vector3(dx, 0, dz)),
    collider, size: new THREE.Vector3(sx, sy, sz),
  };
  W.doors.push(d);
  return d;
}

function wreckCar(x, z, rot = 0) {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshLambertMaterial({ color: 0x51584f });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, .7, 4), bodyM); b.position.y = .6;
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, .55, 1.8), bodyM); c.position.set(0, 1.2, -.2);
  psxify(bodyM);
  g.add(b, c);
  g.position.set(x, 0, z); g.rotation.y = rot;
  E.scene.add(g);
  addCollider(x, .8, z, 2.2, 1.8, 4.2);
}

/* =====================================================
   УРОВЕНЬ 1 · «ПОДЪЕЗД»
   пустошь на краю зоны, дома, первая тень, генератор
===================================================== */

function level1() {
  sky(0x8a9088, .017, 0xe8e4d4);
  lights(0xb8bdb2, 0x3a3830, .95);
  ground(300, mat(T.dirt));

  // дорога
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 300), mat(T.asphalt));
  road.rotation.x = -Math.PI/2; road.position.y = .02;
  psxify(road.material); E.scene.add(road);

  // столбы вдоль дороги
  for (let z = 60; z > -90; z -= 18) pole(5.5, z);

  // дома по сторонам
  house(-16, 20, 8, 7, 3.4);
  house(15, 2, 9, 8, 3.6, 1);
  house(-20, -22, 10, 8, 3.4);
  house(18, -40, 8, 7, 3.2);
  house(-14, -58, 9, 9, 3.6, 1);

  fenceRun(-24, 30, -8, 30);
  fenceRun(10, 12, 24, 12);
  wreckCar(2, -12, .3);
  wreckCar(-3, -48, -.15);

  // лут по домам
  item(-16, .5, 20, 'medkit', 30);
  note(-15, .12, 18.5,
`Тане.
Уехали к маминым, не жди. По дороге не ходи после
темноты — они стоят у столбов и смотрят. Если стоит —
не беги. Беги только когда идёт.
— В.`);
  item(15, .5, 2, 'pistol');
  item(15.8, .5, 3, 'ammo2', 16);
  note(-20, .12, -22,
`ЖЭУ-4, объявление.
В связи с СОБЫТИЕМ подача электроэнергии прекращена.
Резервный генератор — на подстанции у южного шлагбаума.
Топливо спрашивать у Севастьянова (дом у поворота).
Администрация убыла.`);
  item(18, .5, -40, 'medkit', 25);
  item(17, .5, -39, 'ammo2', 8);
  // канистра — у «Севастьянова»
  item(-14, .55, -58, 'key', 0, { keyId: 'canister', label: 'канистра с бензином', shape: 'can' });

  // подстанция и шлагбаум-ворота на юге
  box(8, 1.6, -86, 5, 3.2, 4, mat(T.rust));          // будка подстанции
  const gen = box(4.4, .7, -86, 1.4, 1.4, 1, mat(T.rust)); // генератор
  const gate = slidingGate(0, 1.7, -92, 10, 3.4, .5, -10.2, 0);
  fenceRun(5, -92, 40, -92); fenceRun(-5, -92, -40, -92);
  box(5, 2, -92, .4, 4, .8, mat(T.concrete));
  box(-5, 2, -92, .4, 4, .8, mat(T.concrete));

  let genSound = null;
  W.interact.push({
    pos: new THREE.Vector3(4.4, 1, -86), r: 2.2, label: 'генератор',
    use: () => {
      if (W.flags.genOn) return;
      if (!P.keysHeld.canister) { subtitle(null, 'бак пуст. нужно топливо.', 3); return; }
      W.flags.genOn = true;
      genSound = Snd.generator();
      Snd.door();
      gate.open = true;
      toast('генератор запущен — ворота открыты');
      setObjective('пройти через южные ворота');
      radioSay('...слышу тебя. Слышу генератор. Значит, живой. Иди на юг, к станции. Не оглядывайся на диск.', 7);
    }
  });

  // тени
  spawnShade(6, 0, -30, { aggroR: 13 });
  spawnShade(-18, 0, -70, { aggroR: 15 });
  const watcher = spawnShade(5.5, 0, -6, { aggroR: 9999, speed: 0 }); // стоит у столба и только смотрит
  watcher.state = 'idle'; watcher.aggroR = -1;

  // сценарий
  trigger(0, 1.5, 40, 30, 4, 6, () => {
    radioSay('Приём. Если ты меня слышишь — ты вошёл в полосу. Назад дороги уже нет, она закрыта. Прости.', 7);
    setTimeout(() => radioSay('Ищи топливо в домах. Без света ворота не открыть. И... в домах смотри под ноги, там записки. Люди успели написать.', 8), 8000);
  });
  trigger(0, 1.5, -20, 60, 4, 4, () => {
    subtitle(null, '— тихо. слишком тихо для деревни —', 3.5);
  }, true);

  // выход
  trigger(0, 1.5, -96, 12, 4, 4, () => {
    nextLevel();
  });

  spawnPlayer(0, 1.7, 52, 0);
  setObjective('найти топливо для генератора и открыть южные ворота');
  Snd.ambience(.14, .04);
  return { vhs: .15 };
}

/* =====================================================
   УРОВЕНЬ 2 · «ПРОСВЕТ-ТОВАРНАЯ»
   жд станция, загадка с рубильниками, обрез
===================================================== */

function level2() {
  sky(0x6d7570, .02, 0xe8e4d4);
  lights(0x9aa39a, 0x2c2a24, .8);
  ground(300, mat(T.dirt));

  // насыпь и пути
  const emb = box(0, .2, 0, 260, .4, 8, mat(T.asphalt));
  for (let x = -120; x < 120; x += 1.2) box(x, .45, 0, .5, .1, 5.4, mat(T.wood), false);
  box(0, .55, -1.8, 260, .12, .2, mat(T.rust), false);
  box(0, .55, 1.8, 260, .12, .2, mat(T.rust), false);

  // платформа
  box(0, .5, 8, 60, 1, 6, mat(T.concrete));
  // здание вокзала
  house(0, 16, 16, 9, 4.2);
  const sign = box(0, 4.7, 11.6, 8, .9, .2, mat(T.concrete), false);

  // вагоны
  const wagon = (x, z, rot = 0) => {
    const g = new THREE.Group();
    const m = mat(T.rust);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 11), m); b.position.y = 2;
    psxify(m); g.add(b);
    g.position.set(x, 0, z); g.rotation.y = rot;
    E.scene.add(g);
    addCollider(x, 2, z, rot ? 11 : 3.2, 3.4, rot ? 3.2 : 11.2);
  };
  wagon(-20, 0); wagon(-33, 0); wagon(26, 0); wagon(40, .4);

  // депо с воротами (выход)
  box(-6, 3, -40, .5, 6, 20, mat(T.concrete));
  box(6, 3, -40, .5, 6, 20, mat(T.concrete));
  box(0, 6.2, -40, 12.5, .5, 20, mat(T.concrete));
  const depoGate = slidingGate(0, 2.4, -50, 11.5, 4.8, .5, 0, 0);
  depoGate.to.y += 5.2; // ворота уходят вверх

  // щитовая: три рубильника
  box(14, 1.5, 22, 4, 3, 3, mat(T.rust));
  const lever = (x, z, id) => {
    const m = box(x, 1.4, z, .3, .8, .2, mat(T.rust), false);
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
          radioSay('Депо открыто. Дальше — тоннель под горкой. Я буду вести, пока хватит батарей.', 6);
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

  // лут
  item(-20, .6, 2.5, 'ammo2', 12);
  item(26, .6, -2.5, 'medkit', 30);
  item(0, .6, 14, 'shotgun');
  item(1, .6, 14, 'ammo3', 8);
  item(-33, .6, 2.5, 'ammo3', 4);

  // враги — здесь их больше
  spawnShade(-14, 0, -6, { aggroR: 14 });
  spawnShade(30, 0, 4, { aggroR: 14 });
  spawnShade(0, 0, -30, { aggroR: 12, hp: 90, speed: 3.6 });
  spawnShade(-40, 0, 0, { aggroR: 18 });

  trigger(0, 1.5, 34, 40, 4, 4, () => {
    radioSay('Станция. До События отсюда возили руду. После — возят только в одну сторону. Найди щитовую, открой депо.', 7);
    setTimeout(() => subtitle(null, '— на путях стоят вагоны. в них тоже кто-то писал —', 4), 8000);
  });

  trigger(0, 2, -49, 10, 5, 3, () => nextLevel());

  spawnPlayer(0, 1.7, 40, 0);
  setObjective('восстановить питание депо (щитовая где-то на платформе)');
  Snd.ambience(.1, .07);
  return { vhs: .2 };
}

/* ---------- реестр уровней ---------- */

export const LEVELS = [
  { id: 1, name: 'Подъезд', build: level1 },
  { id: 2, name: 'Просвет-Товарная', build: level2 },
  { id: 3, name: 'Городок', build: null },
  { id: 4, name: 'НИИ, проходная', build: null },
  { id: 5, name: 'Лаборатории', build: null },
  { id: 6, name: 'Тоннели', build: null },
  { id: 7, name: 'Изнанка', build: null },
  { id: 8, name: 'Антенное поле', build: null },
  { id: 9, name: 'Резонатор', build: null },
  { id: 10, name: 'Просвет', build: null },
];

export let currentLevel = 0;
let onLevelEnd = null;
export function setLevelEndHandler(fn) { onLevelEnd = fn; }
export function nextLevel() { onLevelEnd?.(); }
export function setCurrentLevel(i) { currentLevel = i; }
