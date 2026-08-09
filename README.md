# ПРОСВЕТ-9

Тревожный ретро-FPS в духе Half-Life 1 и PSX-хорроров. Браузер, мышь+WASD, полностью на русском. Все ассеты — процедурные, внешних файлов нет.

## Как запустить у себя (2 минуты, бесплатно, навсегда)

1. Зайди на github.com → кнопка **New repository** → имя `prosvet9` → Create
2. На странице репозитория: **uploading an existing file** → перетащи мышкой ВСЁ содержимое этой папки (index.html, папки js и libs, README) → Commit
3. **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main`, папка `/ (root)` → Save
4. Через минуту игра живёт по адресу `https://ТВОЙ_НИК.github.io/prosvet9/` — шли ссылку кому угодно

Запасной вариант: itch.io → Upload new project → тип HTML → загрузить zip этой папки → "This file will be played in the browser".

## Управление
WASD + мышь · SHIFT бег · SPACE прыжок · E взаимодействие · F фонарь · ЛКМ атака · R перезарядка · 1/2/3 оружие · **G — бессмертие (режим наблюдателя, для тестов уровней)**

## Структура
- `js/engine.js` — PSX-рендер: низкое разрешение, дрожь вершин, дизеринг, VHS-помехи
- `js/assets.js` — процедурные текстуры (canvas) и звук (WebAudio)
- `js/game.js` — игрок, коллизии, оружие, враги, интерактив
- `js/levels.js` — уровни как данные; собраны участки 1–2 из 10
- `js/main.js` — меню, цикл, сохранение (localStorage)
