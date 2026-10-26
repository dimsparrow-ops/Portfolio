# Portfolio — каркас

Astro + GSAP + Lenis. Статичний сайт: збирається в папку `dist/`, хоститься безкоштовно (Cloudflare Pages / Netlify).

## Запуск локально
```
npm install
npm run dev      # http://localhost:4321
npm run build    # готовий сайт у dist/
```

## Як додати або змінити кейс
Один кейс = один файл у `src/content/cases/`. Скопіюй `project-01.md`, перейменуй (назва файлу = адреса `/work/<назва>/`) і заповни поля:

| Поле | Що це |
| --- | --- |
| `title`, `client` | Заголовок кейсу |
| `order` | Порядок на головній |
| `year`, `country`, `services` | Рядок під заголовком |
| `platform` | `mobile` або `desktop` — для фільтра |
| `summary` | Одне речення |
| `cover` | Шлях до обкладинки в `public/` (порожньо = плейсхолдер) |
| `metrics` | До 4 цифр імпакту, можна прибрати зовсім |
| `sections.input / reasoning / process / outcomes` | `text` + список `media` (image / video / quote) |
| `link` | Посилання на продукт, опційно |

Зображення та відео клади в `public/cases/<назва>/` і вказуй шлях `/cases/<назва>/file.jpg`.
Пізніше сюди підключимо візуальну адмінку (Keystatic) — вона редагуватиме ці самі файли.

## Де що лежить
- `src/scripts/motion.ts` — токени руху (easing, тривалості, stagger). Змінив тут → змінилось усюди.
- `src/scripts/work.ts` — головна: showcase / grid / slider, фільтр, ховер.
- `src/scripts/case.ts` — кейс-оверлей і акордеон, синхронізований зі скролом.
- `src/scripts/app.ts` — роутер, переходи між сторінками, вхід у Design Lab, лоадер.
- `src/scripts/pages.ts` — Services, About (Say hi), Design Lab.
- `src/data/site.ts` — тексти About, список послуг, експерименти Lab, email.
- `src/styles/global.css` — кольори, типографіка, верстка.
