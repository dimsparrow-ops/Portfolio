# Portfolio — каркас

Astro + GSAP + Lenis. Статичний сайт: збирається в папку `dist/`, хоститься на Cloudflare Workers (static assets) і сам деплоїться з кожного пушу в `main`.

## Запуск локально
```
npm install
npm run dev      # http://localhost:4321
npm run build    # готовий сайт у dist/
```

## Як додати або змінити кейс
Один кейс = один файл у `src/content/cases/`. Скопіюй будь-який наявний (напр. `centegix.md`), перейменуй (назва файлу = адреса `/work/<назва>/`) і заповни поля (повна схема — `src/content.config.ts`):

| Поле | Що це |
| --- | --- |
| `title`, `client` | Заголовок кейсу |
| `task` | Задача, 2–3 рядки: друкується в підказці біля картки при наведенні |
| `order` | Порядок на головній |
| `year`, `country`, `services` | Рядок під заголовком |
| `platform` | `mobile` або `desktop` — для фільтра |
| `summary` | Одне речення (опис сторінки кейсу) |
| `cover` | Шлях до обкладинки в `public/` (порожньо = плейсхолдер) |
| `metrics` | До 4 цифр імпакту, можна прибрати зовсім |
| `sections.input / approach / outcomes` | `text` + список `media` (image / video / quote) |
| `link` | Посилання на продукт, опційно |

Зображення та відео клади в `public/work/<назва>/` і вказуй шлях `/work/<назва>/file.webp`.
Пізніше сюди підключимо візуальну адмінку (Keystatic) — вона редагуватиме ці самі файли.

## Де що лежить
- `src/scripts/motion.ts` — токени руху (easing, тривалості, stagger) і спільні хелпери (поява слів, підказка біля курсора). Змінив тут → змінилось усюди.
- `src/scripts/work.ts` — головна: spiral / circle / slider (grid поки схований), фільтр, ховер, клавіатура.
- `src/scripts/stage-gl.ts` — WebGL, що малює обкладинки карток на головній.
- `src/scripts/case.ts` — кейс-оверлей і акордеон, синхронізований зі скролом (на телефоні — лише по тапу).
- `src/scripts/app.ts` — роутер, переходи між сторінками, вхід у Design Lab, лоадер.
- `src/scripts/pages.ts` — Services, About (SUMMON ME, плеєр, Say hi), Design Lab.
- `src/data/site.ts` — тексти About, список послуг, експерименти Lab, email.
- `src/styles/global.css` — кольори, типографіка, верстка.
