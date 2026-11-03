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
  Work into the Lab is never torn down: its live page becomes the ceiling (`parked` in app.ts, `WorkApi.ambient(true)`: keeps drifting, ignores pointer/wheel/keys), and climbing back brings that same page down again (no fetch, no intro, same view and position). Leaving the Lab for another page destroys it.
- `src/scripts/work.ts`: one render loop for 4 views — showcase (3D ring, auto-rotates), grid, slider (auto-drifts), spiral (a port of pacomepertant.com's ProjectPlane, in "units" of vh/(16·tan(fov/2)) px: camera 8 units out at fov 35°, 45° under 900px, set as the `.stage-world` perspective under `.stage.is-spiral`; its axis (perspective origin + world top, set from JS) drops so the plate facing the eye sits mid-screen; plates on a ring of radius 2, 0.85 rad apart, 0.55 up the column per plate, facing out from the axis; the column leans right by 0.1·y²; plates bulge 0.2/1.7 of their width; a plate blurs in gradually as it turns its back to the eye (by the cosine between its normal and the line to the camera, through perspective: sharp above 0.25, full light blur — a 5×5 tent 0.75% of the card apart — at −0.35), and its back shows the cover mirrored like a real sheet (the WebGL plate never flips; only the CSS card mirrors so its chips read); ours are 1.61 units wide instead of 1.7 so neighbours keep a gap, and 15% taller than the 1.7:1 shape; the strip flows top to bottom at 0.12 plates/s; the ring needs 16 plates or its seam shows, so `WorkStage.astro` runs the real cases round again (`FILL = 'repeat'`, like the reference's ten; `'placeholder'` swaps in placeholder projects) and only the spiral shows the filler; the seam sits half a ring from the front plate). Showcase uses the spiral's landscape plates at the size the spiral's front plate shows at (×8/6, it sits 2 units nearer the camera) with the same gradual back blur; in both only the three cards at the front (the front one and its ring neighbours, counted along the ring: |wrap(index − offset − front)| < 1.5, not by facing angle, since the spiral's other turns also hold plates facing the eye) take hover and clicks; chips undo each card's depth scale (`--chip-k` = (perspective − z)/perspective, set in work.ts) so they read at one size everywhere; in every view hover shows the chips and a label that rides the pointer (no headline above the card, no cursor disc) (`.spiral-tag` in `WorkStage.astro`: the cursor's white arrow disc, then the case's task), dressed and animated exactly like the Services hover block (light glass pill, spinning rainbow edge and glow, follows and tilts with the pointer, sitting 24px right of it with its middle level with the pointer, scales in/out, text typed live with a caret via `typer` in `motion.ts`, shared with Services); clicking the card opens the case; cards slide under a still pointer without any pointerleave, so every 6 frames the render loop checks `elementFromPoint` and drops a hover the pointer no longer covers (else the hover, the drift pause and the label stick; a card sliding under a still pointer is not picked up, so the drift never halts on its own); slider uses the same plates in a row; only the hidden grid keeps the portrait card (`portraitW`). All covers are drawn by ONE WebGL canvas behind the stage (`createStageGL`, `.stage-gl`), the CSS cards above it see-through (img hidden, chips/hover/clicks stay CSS): each plate is a 16×18 quad grid carried through the card's exact CSS transform string (`new DOMMatrix(tf)`), bulged along its normal, leaned/swayed in world space and projected like CSS (perspective about the axis: mid-width, world's live top), with a depth buffer and back-to-front blending. So plates stay bent at any angle, edge-on too, and intersect correctly; one context instead of one per card. Never read layout in the draw path (stage size comes from a ResizeObserver, the world's perspective/top are read once at frame start); faded-out cards are skipped. The chips' backdrop blur must see the WebGL cover under the card, so a card is never a backdrop root: no `will-change: opacity`, opacity snaps to exactly 1 once shown, and `.card` stays `transform-style: flat`.
  Spiral, showcase and slider cards look and move the same and share one hover: the same plate and bulge (`BULGE`), levitation, and rubber: an underdamped spring (`rub`) chases the scroll speed, so moving plates bulge further, skew, squeeze and their middle leads their edges (the reference's sway), then wobble back flat. On the spiral (`packed`: plates almost edge to edge) the rubber keeps their footprint: no skew, a 0.3× swell instead of 1.6×, and a sway of 0.08 of the width instead of 0.12, or neighbours pile onto each other.
  Depth: `.stage-world` is a 0×0 point at the axis holding the perspective, and stays flat (no preserve-3d): the CSS cards paint in z-index order (they only carry chips and hit areas now; the WebGL depth buffer does the real sorting). The pointer lean of the whole stage is folded into each card's transform (transform-origin 0 0, about the axis), which the WebGL plate reuses.
  SUMMON ME carries the same grid in white at 6% (`.hi::before`).
  Work and Services background: #F8F8F8 with a barely-there 40px grid (ink at 6%, `.page--work::before, .page--services::before`), centred and fading out toward the edges by a radial mask.
  Levitation, per-card tilt (10°), whole-stage tilt (4–6°, bottom 120px dead zone), hover copy rides the card tilt.
- `src/scripts/case.ts`: case overlay + Input/Approach/Outcomes accordion synced to scroll and clickable.
  Layout (Figma V0 · B, white sheet): media LEFT, story column RIGHT (solid dark hug-width "Visit" CTA on top, then the accordion;
  the Outcomes panel carries the short text + metric rows with 48px numbers). No footer, no counter.
- `src/scripts/pages.ts`: Services hover preview, About SUMMON ME dock effect (quickTo — never `overwrite`; the letter under the pointer +75% tall, a tight falloff of 0.7 letter widths lifts neighbours ~10%), Lab pull-back.
- `src/scripts/motion.ts`: motion tokens (eases, durations, staggers). `dots.ts`: polka-dot cursor field, currently **off**
  (canvas commented out in `WorkStage.astro`).
- `src/data/site.ts`: site info, nav pages, socials (LinkedIn; Instagram removed from SUMMON ME), stats, services, timeline, lab items.

## Content
- Cases: one Markdown file per case in `src/content/cases/`, schema in `src/content.config.ts`.
  Fields: title, task (design task shown above the card on hover, 2–3 lines), client?, order, year, country, services[],
  platform, product?, role?, team?, mine?, summary, cover, metrics (≤4, optional; value, label, before?, when?, note?), sections {input, approach, outcomes} each {text, media[]}, link?.
  Section text: paragraphs separated by a blank line (`\n\n`). Media kinds: image, video, quote.
- Images in `public/work/<case>/` (cover.webp, m1…m6.webp). Current 5 cases were imported from the old Framer site
  (dimsi.framer.website) at 1600px WebP — swap in originals later. Copy still needs a rewrite (shorter, decision-focused).
- Add a case = add an `.md` + its images. No layout work needed.
- Honu AI and Sidekick are content-pending: placeholder copy (like Centegix), year 2026 and platform desktop as stand-ins,
  generated gradient covers with the name (`public/work/<case>/cover.svg`) until real media arrive.
- About "Listening to" deck: list `records` in `src/data/site.ts` (artist, track, meta, sleeve in `public/player/`, optional `vinyl` texture or `disc` colour, `label` colour).
  One is picked at random per visit (never the same twice in a row), see `initDeck` in `pages.ts`. Add a record = add an entry + its sleeve image.

## Design system (tokens live in `src/styles/global.css` `:root`)
- **4px grid** for every size; only exceptions are 1px hairlines and the 2px focus ring. Don't add in-between values.
- Colour: white `--bg`, `--ink` #1c1c1e, `--ink-body/-2/-3`, `--line`; dark spaces `--lab` #0d0d0e (Design Lab + SUMMON ME share it);
  `--scrim` for nav glass/backdrops; `--key` #F26D90 + `--key-edge` #C4456A = Say hi keycap only (white label).
- Type: Geist (UI + text) and Geist Mono (captions, labels), both OFL via `@fontsource-variable`; Archivo wdth 62% / 900 only for SUMMON ME.
  Scale 12 / 16 / 20 / 32 / 80 / 120 (big ones via clamp); About intro is 40 (set apart on purpose). Line heights 1 / 1.2 / 1.5.
- About: two-tone intro (name in grey `#6b6b70`), then a 560px timeline centred under the 800px intro; local greys `--about-sub` / `--about-body`.
- Radius: `--r-s` 4, `--r-m` 12, `--r-card` 8, `--r-l` 32 (white page → dark space corners), `--r-pill`. Shadows: s / m / l.
- Theme: light by default; a toggle top-right (`.theme-switch` in `Base.astro`: one icon showing the theme it switches TO — moon on light, sun on dark — grey at rest; hover lays a grey disc under it and inks it; the icons swap with a turn and fade) sets `html[data-theme=dark]`, stored in localStorage and applied by an inline head script before first paint. The dark theme only overrides `:root` tokens (`--bg`, `--ink*`, `--page`, `--grid-line`, `--nav-*`, `--button*`, `--glass-light`, …); Design Lab and SUMMON ME stay `--lab`. New colours go in as tokens with a dark value, never hard-coded. Switching adds `html.theme-fade` for 450ms so colours ease over.
- Nav: bottom pill, dark glass (blur 80px), 4px inset on every side, white active pill (spring), items `work · about · services`, lowercase.
- Work controls: `spiral · circle · slider` bottom-left (circle is the showcase view, `data-view="showcase"` in code), spiral is the default (grid is hidden for now: its button is commented out in `Base.astro`, a stored grid falls back to spiral) (on phones the views stack above the filter); `cases · design lab` bottom-right (design lab = link to the Lab).
- Cards: 10:11 near-square portrait (RATIO 1.1, like cappen.com/works), radius 8, sizes ×1.25, cover image only at rest. Hover: tilt, slight brighten, glass chips on the cover (discipline · platform · year, dark glass, blur only while hovered; no dark overlay on the cover),
  and the pointer label (`.spiral-tag`, see work.ts above); the old headline above the card (`.card-task`) stays in the markup only as the label's text source. No glare. Chosen from the Figma variations (V3c); card proportion still open.
- Buttons: outline pill; hover = dark disc grows from bottom-centre (karim-saab.com).
- Motion: ease-out (0.16,1,0.3,1) reveals; ease-inout (0.45,0,0.15,1) layout/page; ease-ui (0.215,0.61,0.355,1) hovers/accordion;
  durations 0.2 / 0.45 / 0.75 / 0.85-in 0.5-out. Respect `prefers-reduced-motion`. Mobile = simplified effects.
- Full UI kit with component notes: https://claude.ai/artifact/CztnpuM9zBNaH4N9JhsMRQ (may lag behind the code).

## Open items
- Logo (yellow smiley "DiM"), tone of voice, real case copy and original images, timeline dates on About.
- White label on #F26D90 is ~2.9:1 contrast — darken toward #D94F75 if readability suffers.
