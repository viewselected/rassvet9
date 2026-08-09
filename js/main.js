// ПРОСВЕТ-9 v2 · вход
import { E, initEngine, renderFrame, clearScene, lockPointer } from './engine.js';
import { buildTextures, Snd } from './assets.js';
import { W, P, updatePlayer, updateEnemies, updateSubtitles, updateHUD, clearSubtitles,
         startFire, stopFire, startReload, switchWeapon, toast,
         hidePaper, paperOpen } from './game.js';
import { LEVELS, setLevelEndHandler } from './levels.js';

const SAVE_KEY = 'prosvet9_level';
let running = false, levelVhs = 0, levelIdx = 0;

initEngine();
buildTextures();

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const fade = document.getElementById('fade');

const saved = parseInt(localStorage.getItem(SAVE_KEY) || '0', 10);
if (saved > 0 && LEVELS[saved]?.build) {
  const b = document.getElementById('btn-continue');
  b.style.display = 'block';
  b.textContent = `продолжить — глава ${LEVELS[saved].id}: «${LEVELS[saved].name}»`;
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
                  (lv.build ? '' : ' · опечатано');
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
  localStorage.setItem(SAVE_KEY, String(i));
  Snd.init(); Snd.resume();

  menu.style.display = 'none';
  hud.style.display = 'block';
  fade.style.opacity = 1;

  clearScene();
  W.reset();
  clearSubtitles();
  P.hp = Math.max(P.hp, 65); P.dead = false; P.firing = false;
  const cfg = LEVELS[i].build() || {};
  levelVhs = cfg.vhs || 0;
  updateHUD();
  toast(`глава ${LEVELS[i].id} · «${LEVELS[i].name}»`);

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
      localStorage.setItem(SAVE_KEY, String(levelIdx));
      hud.style.display = 'none';
      document.exitPointerLock();
      menu.style.display = 'flex';
      const sub = document.querySelector('#menu .sub');
      sub.textContent = 'ГЛАВЫ 1–4 ОБСЛЕДОВАНЫ · ДАЛЬШЕ — ОПЕЧАТАНО ДО СЛЕДУЮЩЕЙ СБОРКИ';
      fade.style.opacity = 0;
    }
  }, 1300);
});

document.addEventListener('mousedown', (e) => {
  if (!running || paperOpen()) return;
  if (!E.pointerLocked) { lockPointer(); Snd.resume(); return; }
  if (e.button === 0) startFire();
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) stopFire(); });

document.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.code === 'KeyE') {
    if (paperOpen()) { hidePaper(); lockPointer(); return; }
    P._interactTarget?.use();
  }
  if (e.code === 'KeyF') P.flashOn = !P.flashOn;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyG') {
    P.god = !P.god;
    toast(P.god ? 'режим наблюдателя: ВКЛ' : 'режим наблюдателя: ВЫКЛ');
    updateHUD();
  }
  if (e.code === 'Digit1') switchWeapon(1);
  if (e.code === 'Digit2') switchWeapon(2);
  if (e.code === 'Digit3') switchWeapon(3);
  if (e.code === 'Digit4') switchWeapon(4);
  if (e.code === 'Escape' && paperOpen()) hidePaper();
});

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
