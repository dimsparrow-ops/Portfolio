# Dim Sivetskyi — portfolio

Personal portfolio of Dim Sivetskyi, Lead Product Designer (Qubstudio, Lisbon).
Owner talks in Ukrainian; site copy is **English only**.
Brief: impress by look and motion first, cases second. Simple structure, easy case management.

## Stack & deploy
- Astro 7 (static, `build.format: directory`), GSAP 3 (CustomEase, ScrollTrigger, quickTo), Lenis.
- Hosting: Cloudflare Workers static assets (`wrangler.jsonc`, `./dist`, 404 page). Auto-deploys on every push to `main`
  → https://portfolio.defin8cut.workers.dev. Node pinned in `.node-version`.
- `npm run dev` / `npm run build` / `npm run preview`.
- `vite.build.cssMinify: false` on purpose: the minifier dropped unprefixed `backdrop-filter`.
  Always write blur as `--glass: blur(…); backdrop-filter: var(--glass); -webkit-backdrop-filter: var(--glass);`.
- Commit as Dim (`dimsparrow-ops`), small focused commits, push to `main`.

## Structure
- `src/pages`: `index` (Work), `about`, `services`, `lab` (Design Lab), `work/[slug]` (case as overlay with its own URL).
- `src/layouts/Base.astro`: loader, logo (placeholder square, smiley logo comes later), Work controls, bottom nav, Say hi keycap, case layer, card cursor.
- `src/scripts/app.ts`: client router (fetch + swap `main.page`). Pages slide horizontally in nav order;
  Design Lab is a "basement": the old page rises as a ceiling (`descend`), pull up at the top to go back (`ascend`).
- `src/scripts/work.ts`: one render loop for 3 views — showcase (3D ring, auto-rotates), grid, slider (auto-drifts).
  Levitation, per-card tilt (10°), whole-stage tilt (4–6°, bottom 120px dead zone), hover copy rides the card tilt.
- `src/scripts/case.ts`: case overlay + Input/Reasoning/Process/Outcomes accordion synced to scroll and clickable.
- `src/scripts/pages.ts`: Services hover preview, About SUMMON ME dock effect (quickTo — never `overwrite`), Lab pull-back.
- `src/scripts/motion.ts`: motion tokens (eases, durations, staggers). `dots.ts`: polka-dot cursor field, currently **off**
  (canvas commented out in `WorkStage.astro`).
- `src/data/site.ts`: site info, nav pages, socials (LinkedIn, Instagram), stats, services, timeline, lab items.

## Content
- Cases: one Markdown file per case in `src/content/cases/`, schema in `src/content.config.ts`.
  Fields: title, task (design task shown above the card on hover, 2–3 lines), client?, order, year, country, services[],
  platform, summary, cover, metrics (≤4, optional), sections {input, reasoning, process, outcomes} each {text, media[]}, link?.
  Section text: paragraphs separated by a blank line (`\n\n`). Media kinds: image, video, quote.
- Images in `public/work/<case>/` (cover.webp, m1…m6.webp). Current 5 cases were imported from the old Framer site
  (dimsi.framer.website) at 1600px WebP — swap in originals later. Copy still needs a rewrite (shorter, decision-focused).
- Add a case = add an `.md` + its images. No layout work needed.

## Design system (tokens live in `src/styles/global.css` `:root`)
- **4px grid** for every size; only exceptions are 1px hairlines and the 2px focus ring. Don't add in-between values.
- Colour: white `--bg`, `--ink` #1c1c1e, `--ink-body/-2/-3`, `--line`; dark spaces `--lab` #0d0d0e (Design Lab + SUMMON ME share it);
  `--scrim` for nav glass/backdrops; `--key` #F26D90 + `--key-edge` #C4456A = Say hi keycap only (white label).
- Type: Google Sans Flex (self-hosted, `public/fonts`, OFL) for everything; Archivo wdth 62% / 900 only for SUMMON ME.
  Scale 12 / 16 / 20 / 32 / 80 / 120 (big ones via clamp). Line heights 1 / 1.2 / 1.5.
- Radius: `--r-s` 4, `--r-m` 12, `--r-card` 16, `--r-l` 32 (white page → dark space corners), `--r-pill`. Shadows: s / m / l.
- Nav: bottom pill, dark glass (blur 80px), 4px inset on every side, white active pill (spring), items `work · about · services`, lowercase.
- Work controls: `showcase · grid · slider` bottom-left; `cases · design lab` bottom-right (design lab = link to the Lab).
- Cards: 4:3, radius 16, cover image only (no text on the card). Hover: tilt, slight brighten, task text above,
  "client • country, year" below, white 64px disc cursor with a ↗ arrow. No glare, no tags.
- Buttons: outline pill; hover = dark disc grows from bottom-centre (karim-saab.com).
- Motion: ease-out (0.16,1,0.3,1) reveals; ease-inout (0.45,0,0.15,1) layout/page; ease-ui (0.215,0.61,0.355,1) hovers/accordion;
  durations 0.2 / 0.45 / 0.75 / 0.85-in 0.5-out. Respect `prefers-reduced-motion`. Mobile = simplified effects.
- Full UI kit with component notes: https://claude.ai/artifact/CztnpuM9zBNaH4N9JhsMRQ (may lag behind the code).

## Open items
- Logo (yellow smiley "DiM"), tone of voice, real case copy and original images, timeline dates on About.
- White label on #F26D90 is ~2.9:1 contrast — darken toward #D94F75 if readability suffers.
