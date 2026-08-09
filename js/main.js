// ПРОСВЕТ-9 · вход
import * as THREE from 'three';
import { E, initEngine, renderFrame, clearScene, lockPointer } from './engine.js';
import { buildTextures, Snd } from './assets.js';
import { W, P, updatePlayer, updateEnemies, updateSubtitles, updateHUD,
         attack, switchWeapon, damage, spawnPlayer, toast, subtitle,
         showPaper, hidePaper, paperOpen } from './game.js';
import { LEVELS, setLevelEndHandler, setCurrentLevel } from './levels.js';

const SAVE_KEY = 'prosvet9_level';
let running = false, levelVhs = 0, levelIdx = 0;

initEngine();
buildTextures();

/* ---------- меню ---------- */

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const fade = document.getElementById('fade');

const saved = parseInt(localStorage.getItem(SAVE_KEY) || '0', 10);
if (saved > 0 && LEVELS[saved]?.build) {
  const b = document.getElementById('btn-continue');
  b.style.display = 'block';
  b.textContent = `продолжить обследование — участок ${LEVELS[saved].id}: «${LEVELS[saved].name}»`;
}

document.getElementById('btn-new').onclick = () => startLevel(0);
document.getElementById('btn-continue').onclick = () => startLevel(saved);
document.getElementById('btn-levels').onclick = () => {
  const box = document.getElementById('levels');
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'btn lv';
    b.dataset.locked = lv.build ? '0' : '1';
    b.innerHTML = `<span class="n">${String(lv.id).padStart(2, '0')}</span>${lv.name}` +
                  (lv.build ? '' : ' · в разработке');
    if (lv.build) b.onclick = () => startLevel(i);
    box.appendChild(b);
  });
};
document.getElementById('btn-respawn').onclick = () => {
  document.getElementById('deathscreen').style.display = 'none';
  startLevel(levelIdx);
};

function startLevel(i) {
  levelIdx = i;
  setCurrentLevel(i);
  localStorage.setItem(SAVE_KEY, String(i));
  Snd.init(); Snd.resume();

  menu.style.display = 'none';
  hud.style.display = 'block';
  fade.style.opacity = 1;

  clearScene();
  W.reset();
  P.hp = Math.max(P.hp, 60); P.dead = false;
  const cfg = LEVELS[i].build() || {};
  levelVhs = cfg.vhs || 0;
  updateHUD();
  toast(`участок ${LEVELS[i].id} · «${LEVELS[i].name}»`);

  running = true;
  setTimeout(() => { fade.style.opacity = 0; }, 100);
  lockPointer();
}

setLevelEndHandler(() => {
  running = false;
  fade.style.opacity = 1;
  setTimeout(() => {
    const next = levelIdx + 1;
    if (LEVELS[next]?.build) startLevel(next);
    else {
      // конец собранного участка
      localStorage.setItem(SAVE_KEY, String(levelIdx));
      hud.style.display = 'none';
      document.exitPointerLock();
      menu.style.display = 'flex';
      const sub = document.querySelector('#menu .sub');
      sub.textContent = 'УЧАСТКИ 1–2 ОБСЛЕДОВАНЫ · ОСТАЛЬНЫЕ ОПЕЧАТАНЫ ДО СЛЕДУЮЩЕЙ СБОРКИ';
      fade.style.opacity = 0;
    }
  }, 1300);
});

/* ---------- ввод ---------- */

document.addEventListener('mousedown', (e) => {
  if (!running) return;
  if (paperOpen()) return;
  if (!E.pointerLocked) { lockPointer(); Snd.resume(); return; }
  if (e.button === 0) attack();
});

document.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.code === 'KeyE') {
    if (paperOpen()) { hidePaper(); lockPointer(); return; }
    P._interactTarget?.use();
  }
  if (e.code === 'KeyF') { P.flashOn = !P.flashOn; }
  if (e.code === 'KeyG') {
    P.god = !P.god;
    toast(P.god ? 'режим наблюдателя: ВКЛ' : 'режим наблюдателя: ВЫКЛ');
    updateHUD();
  }
  if (e.code === 'KeyR' && P.weapon > 1) {
    // перезарядка через атаку при пустом магазине тоже работает
    const w = P.weapon;
    if (P.clip[w] < P.clipSize[w] && P.ammo[w] > 0) {
      const need = P.clipSize[w] - P.clip[w];
      const take = Math.min(need, P.ammo[w]);
      P.clip[w] += take; P.ammo[w] -= take;
      updateHUD();
    }
  }
  if (e.code === 'Digit1') switchWeapon(1);
  if (e.code === 'Digit2') switchWeapon(2);
  if (e.code === 'Digit3') switchWeapon(3);
  if (e.code === 'Escape' && paperOpen()) hidePaper();
});

/* ---------- цикл ---------- */

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (running) {
    if (!paperOpen()) {
      updatePlayer(dt);
      updateEnemies(dt);
      W.update?.(dt, t);
    }
    updateSubtitles(dt);
  }
  renderFrame(t, levelVhs);
}
requestAnimationFrame(loop);
