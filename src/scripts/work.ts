import { gsap, ease, dur, stagger, follow, reduced, typer, hoverLabel } from './motion';
import { initDots } from './dots';
import { createStageGL, type Plate } from './stage-gl';

/**
 * Work stage — one render loop drives all four views (approach from avea.studio):
 * every card always has a target pose for the active view; switching views or
 * filters tweens each card's blend from its last pose to the new one, staggered
 * (the "cards fly into a new arrangement" feel of laurent.fyi).
 */
export type View = 'showcase' | 'grid' | 'slider' | 'spiral';
export type Filter = 'all' | 'mobile' | 'desktop';

// curl: how far the card's middle bulges out along its normal (px); lean: how much of the spiral's column lean and sway applies
type Pose = { x: number; y: number; z: number; ry: number; s: number; w: number; h: number; o: number; curl: number; lean: number };

interface Card {
  el: HTMLElement;
  i: number;
  platform: string;
  placeholder: boolean; // filler with no case page (WorkStage.astro)
  extra: boolean; // spiral-only: a placeholder or a repeat of a real case
  from: Pose;
  cur: Pose;
  blend: { v: number };
  hiddenPose?: Pose;
  w: number;
  h: number;
  tilt: { x: number; y: number; a: number }; // smoothed tilt (bencho.dev)
  warp: number; // 0..1 hover amount of the WebGL cover distortion
  tex: WebGLTexture | null; // its cover in the stage's WebGL (stage-gl.ts), uploaded once the image has loaded
  aspect: number;
  glOn: boolean; // drawn by WebGL this frame (its CSS face is see-through then)
  img: HTMLImageElement | null;
  // last values written to the DOM or drawn by WebGL, so unchanged ones aren't set again every frame
  out: { o: number; z: number; k: number; tf: string; gl: number[]; live: boolean; vis: boolean };
}

export interface WorkApi {
  setView(v: View): void;
  setFilter(f: Filter): void;
  intro(delay?: number): void;
  pause(p: boolean): void;
  // the Lab keeps the live Work page as its ceiling: it keeps drifting but ignores the pointer, wheel and keys
  ambient(on: boolean): void;
  destroy(): void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (v: number, n: number) => v - n * Math.round(v / n);
// eases v toward `to` by f and lands on it exactly once within 1e-4, so a scene at rest stops changing (and redrawing)
const approach = (v: number, to: number, f: number) => (Math.abs(to - v) < 1e-4 ? to : v + (to - v) * f);
// whether `vals` differ from `last`, which then takes them on
const changed = (last: number[], vals: number[]) => {
  if (last.length === vals.length && vals.every((v, i) => v === last[i])) return false;
  last.splice(0, last.length, ...vals);
  return true;
};

export function initWork(
  root: HTMLElement,
  opts: { view: View; filter: Filter; onOpen: (slug: string) => void },
): WorkApi {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const world = root.querySelector<HTMLElement>('[data-world]')!;
  const dotsEl = root.querySelector<HTMLCanvasElement>('[data-dots]');
  const dots = dotsEl ? initDots(dotsEl, reduced) : null;
  const sgl = createStageGL(stage);

  let view: View = opts.view;
  let filter: Filter = opts.filter;
  let offset = 0;
  let target = 0;
  let prev = 0;
  let vel = 0;
  // rubber: an underdamped spring chasing the scroll speed, so the sheets flex while they move and wobble back flat
  // when they stop
  let rub = 0;
  let rubV = 0;
  let paused = false;
  let hitTick = 0;
  let ambient = false; // the Lab's ceiling: drifting on, input off (see WorkApi.ambient)
  let onScreen = true; // the Lab's ceiling can be scrolled out of sight, and then it stops rendering
  // the hover (chips, warp, label) is the card under the pointer, or else the card focused from the keyboard once it
  // has come to the front
  let hovered: Card | null = null;
  let byFocus = false; // the hover is the focused card's: no pointer to hit-test or tilt toward
  let focused: Card | null = null; // focused from the keyboard (:focus-visible)
  let introDone = false;
  // pointer, section tilt, auto-motion
  let mx = 0;
  let my = 0;
  let inside = false;
  const world3d = { x: 0, y: 0 };
  let lastT = performance.now();
  let time = 0;
  let autoHold = 0;
  let axis = ''; // the spiral's camera axis as last written to the stage (see render)
  const drawn = { lens: 0, top: 0 }; // the camera the WebGL plates were last drawn with
  const AUTO = { showcase: 0.12, spiral: 0.12, slider: 0.16 }; // cards per second
  const GRID_TITLE_ROOM = 160; // px between grid rows: the 3-line hover title (~100px) plus air
  const GRID_GAP_X = 96; // px between grid columns
  const GRID_TOP_ROOM = 184; // px above the top row, so its hover title stays on the canvas
  const GRID_STAGE_BIAS = 30; // the stage centre sits ~30px above the viewport centre
  const GRID_BOTTOM_ROOM = 120; // px below the last row for the client line + nav
  const NO_TILT_BOTTOM = 120; // px: controls + nav strip, no section tilt there
  // one gap between neighbouring cards, shared by showcase and slider
  const cardGap = () => (dims().mobile ? 24 : 64);
  const TILT = 10; // deg, bencho.dev
  const WORLD_TILT = { x: 4, y: 6 }; // deg, whole section
  // spiral: the reference's ProjectPlane, in px. Its camera sits 8 units out at fov 35° (45° under 900px wide), so a
  // unit is vh / (16·tan(fov/2)) px; .stage.is-spiral sets the matching perspective, 8 units (global.css)
  const spiralUnit = () => {
    const { vw, vh } = dims();
    return vh / (16 * Math.tan(((vw < 900 ? 45 : 35) * Math.PI) / 360));
  };
  // where a plate faces the eye (angle π/2), counted in places from the middle of the ring
  const FRONT = Math.PI / 2 / 0.85;
  // the spiral's camera axis (perspective origin and world origin together, share of the height): it drops from the
  // stage's 46% so the plate facing the eye lands mid-screen. That plate sits (0.8 − 0.55·FRONT) units above the axis
  // and 2 units nearer, so it projects 8/6 as far; moving the axis moves the whole spiral without changing its shape
  const spiralAxis = () => 0.5 + ((0.55 * FRONT - 0.8) * spiralUnit() * 8) / 6 / dims().vh;
  // every view's plate bulges like the reference's: sin(πu)·0.2 on a 1.7-wide plate, out along the normal
  const BULGE = 0.2 / 1.7;

  const RATIO = 1.1; // card shape, near-square portrait (cappen.com/works)
  const SCALE = 0.85; // was 1.25, then 1; now another 15% smaller
  const zero: Pose = { x: 0, y: 60, z: -1800, ry: 0, s: 0.35, w: 280, h: 210, o: 0, curl: 0, lean: 0 };
  const cards: Card[] = Array.from(world.querySelectorAll<HTMLElement>('.card')).map((el, i) => ({
    el,
    i,
    platform: el.dataset.platform ?? '',
    placeholder: el.hasAttribute('data-placeholder'),
    extra: el.hasAttribute('data-placeholder') || el.hasAttribute('data-repeat'),
    from: { ...zero },
    cur: { ...zero },
    blend: { v: 0 },
    w: 0,
    h: 0,
    tilt: { x: 0, y: 0, a: 0 },
    warp: 0,
    tex: null,
    aspect: 1,
    glOn: false,
    // live starts true (the CSS default) so the first frame shuts the cards out of reach
    out: { o: -1, z: -1, k: 0, tf: '', gl: [], live: true, vis: true },
    img: el.querySelector<HTMLImageElement>('.card-face img'),
  }));
  const byDepth = [...cards]; // paint order, re-sorted every frame (it barely changes, so that is cheap)

  // only the spiral shows the filler (repeats or placeholders, see WorkStage.astro)
  const visible = () => cards.filter((c) => (filter === 'all' || c.platform === filter) && (view === 'spiral' || !c.extra));

  // ---------- layout ----------
  function dims() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 768;
    return { vw, vh, mobile };
  }

  // portrait card width for the (hidden) grid; the other views all use the spiral's plates
  function portraitW() {
    const { vw, vh, mobile } = dims();
    return mobile ? Math.min(vw * 0.75, 350) : Math.min(vw * 0.275 * SCALE, (vh * 0.62) / RATIO, 450 * SCALE);
  }

  function sizes(v: View) {
    const { vw, vh, mobile } = dims();
    if (v === 'showcase') {
      // the spiral's landscape plates at the size they show at: its front plate sits 2 units nearer a camera 8 units
      // out, so it looks 8/6 of its own size, while the showcase's front card sits at z 0
      const sp = sizes('spiral');
      const w = (sp.w * 8) / 6;
      const h = (sp.h * 8) / 6;
      return { w, h, gap: 0, radius: mobile ? w : Math.max(w * 1.4, vw * 0.45) };
    }
    if (v === 'spiral') {
      // the reference's plates are 1.7 × 1 units and touch along the ring; ours are 1.61 wide, so neighbours keep a gap,
      // and 15% taller than the reference's shape
      const w = 1.61 * spiralUnit();
      return { w, h: (w / 1.7) * 1.15, gap: 0 };
    }
    if (v === 'slider') {
      const { w, h } = sizes('showcase'); // the same landscape card as the showcase and the spiral
      return { w, h, gap: cardGap() };
    }
    // grid: desktop scrolls vertically (see gridMax); mobile fits everything on one screen
    const n = Math.max(1, visible().length);
    if (!mobile) {
      // desktop: three columns of near-showcase-sized cards that scroll vertically; the row gap holds the hover title
      const cols = Math.min(3, n);
      const gap = GRID_GAP_X;
      const w = Math.min(portraitW() * 0.8, (vw - 120 - gap * (cols - 1)) / cols);
      return { w, h: w * RATIO, gap, gapY: GRID_TITLE_ROOM, cols, rows: Math.ceil(n / 3) };
    }
    const cols = 2;
    const rows = Math.ceil(n / cols);
    const gap = cardGap();
    const availW = vw - 32;
    const availH = vh - 220;
    let w = (availW - gap * (cols - 1)) / cols;
    let h = w * RATIO;
    if (h * rows + gap * (rows - 1) > availH) {
      h = (availH - gap * (rows - 1)) / rows;
      w = h / RATIO;
    }
    return { w: Math.min(w, 500 * SCALE), h: Math.min(h, 500 * SCALE * RATIO), gap, gapY: gap, cols, rows };
  }

  // everything poseFor needs that is the same for all cards, computed once per frame
  interface Frame {
    vis: Card[];
    sz: ReturnType<typeof sizes>;
    wraps: boolean;
    vh: number;
    mobile: boolean;
    unit: number; // spiralUnit()
    axis: number; // spiralAxis()
  }
  function frameFor(v: View): Frame {
    const vis = visible();
    const { vw, vh, mobile } = dims();
    const sz = sizes(v);
    return { vis, sz, wraps: v === 'slider' && wrapsFor(vis.length, sz, vw), vh, mobile, unit: spiralUnit(), axis: spiralAxis() };
  }

  // idx: the card's place among the visible ones (-1: filtered out)
  function poseFor(c: Card, idx: number, v: View, f: Frame): Pose {
    const { vis, sz, wraps, mobile } = f;
    if (idx < 0) {
      const base = c.hiddenPose ?? c.cur;
      return { ...base, z: base.z - 220, s: base.s * 0.7, o: 0 };
    }
    const n = vis.length;
    if (v === 'showcase') {
      const step = 360 / Math.max(n, 3);
      // wide, airy ring (back cards stay visible); slider uses cardGap()
      const R = sz.radius!;
      const rel = wrap(idx - offset, n);
      const a = rel * step;
      const rad = (a * Math.PI) / 180;
      return { x: Math.sin(rad) * R, y: 0, z: Math.cos(rad) * R - R, ry: a, s: 1, w: sz.w, h: sz.h, o: 1, curl: sz.w * BULGE, lean: 0 };
    }
    if (v === 'spiral') {
      // the reference's ProjectPlane: a plate B places from the middle of the ring sits at angle 0.85·B on a ring of
      // radius 2 and 0.5·B up the column (0.55 here: our turns sit a little further apart, so the bands never
      // cover each other), turned to face out from the axis; the whole column then leans right with height (0.1·y²
      // in view space). The seam is half the ring away from the plate facing the eye (FRONT), so a short ring still
      // spreads evenly above and below it, and the strip fades out at the top and bottom
      const u = f.unit;
      const rel = wrap(idx - offset - FRONT, n) + FRONT;
      const a = rel * 0.85;
      const y = (0.8 - 0.55 * rel) * u;
      const z = Math.sin(a) * 2 * u;
      const sy = f.axis * f.vh + (y * 8) / (8 - z / u); // its centre on screen
      const room = Math.min(sy, f.vh - sy);
      return {
        x: Math.cos(a) * 2 * u + (0.1 * y * y) / u,
        y,
        z,
        ry: ((((Math.PI / 2 - a) * 180) / Math.PI) % 360 + 540) % 360 - 180,
        s: 1,
        w: sz.w,
        h: sz.h,
        o: clamp((room + 0.08 * f.vh) / (0.16 * f.vh), 0, 1),
        curl: sz.w * BULGE,
        lean: 1,
      };
    }
    if (v === 'slider') {
      // infinite like avea.studio when the row is wider than the screen, otherwise clamped
      const rel = wraps ? wrap(idx - offset, n) : idx - offset;
      return { x: rel * (sz.w + sz.gap), y: 0, z: 0, ry: 0, s: 1, w: sz.w, h: sz.h, o: 1, curl: sz.w * BULGE, lean: 0 };
    }
    const cols = sz.cols!;
    const rows = sz.rows!;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols; // centre a short last row
    const x = (col - (inRow - 1) / 2) * (sz.w + sz.gap);
    const y = mobile
      ? (row - (rows - 1) / 2) * (sz.h + sz.gapY!) + 10
      : GRID_TOP_ROOM - f.vh / 2 + GRID_STAGE_BIAS + sz.h / 2 + row * (sz.h + sz.gapY!) - offset;
    return { x, y, z: 0, ry: 0, s: 1, w: sz.w, h: sz.h, o: 1, curl: 0, lean: 0 };
  }

  function wrapsFor(n: number, sz: { w: number; gap: number }, vw: number) {
    return n * (sz.w + sz.gap) > vw + sz.w * 1.2;
  }
  // desktop grid: how far (px) the page can scroll; 0 when it all fits
  function gridMax() {
    const { vh, mobile } = dims();
    if (mobile) return 0;
    const sz = sizes('grid');
    return Math.max(0, GRID_TOP_ROOM + sz.rows! * sz.h + (sz.rows! - 1) * sz.gapY! + GRID_BOTTOM_ROOM - vh);
  }
  function sliderWraps() {
    return wrapsFor(visible().length, sizes('slider'), dims().vw);
  }

  // ---------- transitions ----------
  function retarget(duration: number, easing: string | gsap.EaseFunction, baseDelay = 0) {
    const vis = visible();
    const center = view === 'grid' ? (vis.length - 1) / 2 : offset;
    cards.forEach((c) => {
      gsap.killTweensOf(c.blend);
      c.from = { ...c.cur };
      c.hiddenPose = { ...c.cur };
      c.blend.v = 0;
      const k = vis.indexOf(c);
      const order = k < 0 ? 0 : Math.abs(k - center);
      gsap.to(c.blend, { v: 1, duration, ease: easing, delay: baseDelay + order * stagger.card });
    });
  }

  function setView(v: View) {
    if (v === view) return;
    if (hovered) hoverOff(hovered);
    // keep the same project in front when moving between views: track the card, the list can change
    const before = visible();
    const front = before[((Math.round(offset) % before.length) + before.length) % before.length];
    const fromGrid = view === 'grid';
    view = v;
    stage.classList.remove('is-showcase', 'is-grid', 'is-slider', 'is-spiral');
    stage.classList.add(`is-${v}`);
    const at = visible().indexOf(front);
    offset = target = v === 'grid' || fromGrid ? 0 : Math.max(0, at);
    retarget(dur.layout, ease.inOut);
  }

  function setFilter(f: Filter) {
    if (f === filter) return;
    filter = f;
    offset = target = view === 'slider' && !sliderWraps() ? Math.floor((visible().length - 1) / 2) : 0;
    retarget(0.9, ease.inOut);
  }

  function intro(delay = 0) {
    const vis = visible();
    cards.forEach((c, i) => {
      c.from = { ...zero, ry: (i - 2.5) * 14 };
      c.cur = { ...c.from };
      c.blend.v = 0;
      gsap.to(c.blend, {
        v: 1,
        duration: dur.intro,
        ease: ease.out,
        delay: delay + Math.abs(vis.indexOf(c) - (vis.length - 1) / 2) * 0.05,
        onComplete: () => (introDone = true),
      });
    });
  }

  // ---------- render ----------
  function render() {
    if (paused || (ambient && !onScreen)) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    time += dt;
    // smoothing factors were tuned at 60fps; this keeps them identical on 120Hz screens
    const k = (r: number) => 1 - Math.pow(1 - r, dt * 60);
    const frame = frameFor(view);
    const { vis } = frame;
    // layout is read first, before this frame writes any style: the world's lens and top (both ease between views)
    const wcs = getComputedStyle(world);
    const lens = parseFloat(wcs.perspective) || 1500;
    const worldTop = parseFloat(wcs.top) || 0;
    // the cards slide under a still pointer, and no pointerleave comes until it moves: every few frames make sure the
    // hovered card is still the one under it, or the hover (and with it the drift's pause and the label) would stick
    if (hovered && !byFocus && !dragging && ++hitTick % 6 === 0 && document.elementFromPoint(mx, my)?.closest('.card') !== hovered.el)
      hoverOff(hovered);
    // keyboard focus shows the same hover once the focused card is at the front (live), and drops it when it leaves
    if (!hovered || byFocus) {
      const want = focused?.out.live ? focused : null;
      if (want !== hovered) {
        if (hovered) hoverOff(hovered);
        if (want) hoverOn(want, true);
      }
    }
    const box = hovered?.el.getBoundingClientRect(); // the pointer's tilt is measured on it; a focus hover's label sits by it
    if (box && byFocus) label?.follow(box.right, box.top + box.height / 2);
    dots?.tick(dt);
    // slow endless drift until a project is hovered (showcase ring, spiral / infinite slider)
    // WCAG 2.2.2: the drift stops for anyone navigating by keyboard (focus inside the stage) and under reduced motion
    const canAuto = !reduced && introDone && !hovered && !dragging && now > autoHold && !stage.contains(document.activeElement);
    if (canAuto && view === 'showcase') target += AUTO.showcase * dt;
    // spiral: as on the reference, the strip flows top to bottom (0.002 plates a frame)
    if (canAuto && view === 'spiral') target += AUTO.spiral * dt;
    if (canAuto && view === 'slider' && frame.wraps) target += AUTO.slider * dt;
    if (view === 'grid') target = clamp(target, 0, gridMax());
    if (view === 'slider' && !frame.wraps) target = clamp(target, 0, Math.max(0, vis.length - 1));
    // reduced motion: the ring and the row jump straight to where they are sent (keys, focus, snap) instead of gliding
    offset = reduced ? target : approach(offset, target, k(dragging ? follow.lerpDrag : follow.lerp));
    const d = offset - prev;
    prev = offset;
    vel = approach(vel, d, k(0.25));
    const plates: Plate[] = [];
    // the whole section leans toward the pointer too; the world is flat (see .stage-world), so each card carries the lean
    const wtx = inside && !reduced ? (mx / window.innerWidth) * 2 - 1 : 0;
    const wty = inside && !reduced ? (my / window.innerHeight) * 2 - 1 : 0;
    world3d.x = approach(world3d.x, wtx, k(0.06));
    world3d.y = approach(world3d.y, wty, k(0.06));
    const unit = frame.unit; // px per reference unit, for the spiral's lean and sway
    // rubber, the same in every view but the grid (its offset is in px): the plates skew, squeeze and their middle
    // leads their edges (the spiral reference's sway) with the speed, then wobble back flat
    const rubbery = view !== 'grid' && !reduced;
    const rubTo = rubbery ? clamp(vel * 12, -1, 1) : 0;
    rubV += (-(rub - rubTo) * 160 - rubV * 9) * dt;
    rub += rubV * dt;
    if (Math.abs(rub - rubTo) < 1e-4 && Math.abs(rubV) < 1e-3) {
      rub = rubTo;
      rubV = 0;
    }
    // the spiral's plates sit almost edge to edge (a 1.61-wide plate on a 1.65 chord), so there the rubber must not
    // grow their footprint: no skew and only a little extra bulge, or neighbours pile onto each other
    const packed = view === 'spiral';
    const skew = rubbery && !packed ? clamp(rub * 7, -10, 10) : 0;
    const swell = packed ? 0.3 : 1.6;
    const sway = packed ? 0.08 : 0.12; // of the plate's width; the spiral's matches the reference's capped 0.16 units
    const squeeze = rubbery ? 1 - Math.min(Math.abs(vel) * 1.4, 0.1) : 1;
    // the same speed moves the spiral's plates right on screen but the ring's and the slider's left
    const lead = view === 'spiral' ? 1 : -1;
    // showcase and spiral: only the three cards at the front (the front one and its two neighbours on the ring) take
    // hover and clicks. Counted along the ring, not by facing angle: the spiral's turns above and below hold plates
    // that face the eye too
    const ringed = view === 'showcase' || view === 'spiral';
    const front = view === 'spiral' ? FRONT : 0;
    // nothing moved (reduced motion, a settled scene): the canvas keeps its last frame
    let dirty = !!sgl?.stale || lens !== drawn.lens || worldTop !== drawn.top;

    for (const c of cards) {
      const idx = vis.indexOf(c);
      const to = poseFor(c, idx, view, frame);
      const t = c.blend.v;
      const p = c.cur;
      p.x = lerp(c.from.x, to.x, t);
      p.y = lerp(c.from.y, to.y, t);
      p.z = lerp(c.from.z, to.z, t);
      p.ry = lerp(c.from.ry, to.ry, t);
      p.s = lerp(c.from.s, to.s, t);
      p.w = lerp(c.from.w, to.w, t);
      p.h = lerp(c.from.h, to.h, t);
      p.o = lerp(c.from.o, to.o, t);
      p.curl = lerp(c.from.curl, to.curl, t);
      p.lean = lerp(c.from.lean, to.lean, t);

      if (Math.abs(p.w - c.w) > 0.3 || Math.abs(p.h - c.h) > 0.3) {
        c.w = p.w;
        c.h = p.h;
        c.el.style.width = `${p.w}px`;
        c.el.style.height = `${p.h}px`;
      }
      const sk = t > 0.98 ? skew : skew * t;

      // levitation: gentle bob + sway, off in grid
      const lev = view === 'grid' || reduced ? 0 : t;
      const fy = Math.sin(time * 0.9 + c.i * 1.7) * 7 * lev;
      const fz = Math.sin(time * 0.6 + c.i * 1.1) * 1.2 * lev;

      // tilt toward the pointer on the hovered card
      const tt = c.tilt;
      let gx = 0;
      let gy = 0;
      let ga = 0;
      if (hovered === c && !byFocus && box && !reduced) {
        gx = clamp(((mx - box.left) / box.width) * 2 - 1, -1, 1);
        gy = clamp(((my - box.top) / box.height) * 2 - 1, -1, 1);
        ga = 1;
      }
      tt.x = approach(tt.x, gx, k(0.14));
      tt.y = approach(tt.y, gy, k(0.14));
      tt.a = approach(tt.a, ga, k(0.14));
      // cover distortion (cappen.com/works): calm at the cursor, strong toward the far edges
      c.warp = approach(c.warp, hovered === c ? 1 : 0, k(0.12));
      const flipped = Math.abs((((p.ry % 360) + 540) % 360) - 180) > 90; // seen from behind: mirrored to read right
      // one matrix for both: the CSS card takes it as its transform and the WebGL plate is drawn through it. About the
      // axis (transform-origin 0 0 at the world point): the stage lean, then out to the card's centre
      const m = new DOMMatrix()
        .rotateSelf(-world3d.y * WORLD_TILT.x, 0, 0)
        .rotateSelf(0, world3d.x * WORLD_TILT.y, 0)
        .translateSelf(p.x, p.y + fy, p.z)
        .rotateSelf(0, p.ry, 0)
        .rotateSelf(0, 0, fz);
      if (tt.a > 0.002) m.translateSelf(0, 0, -14 * tt.a).rotateSelf(-tt.y * TILT * tt.a, 0, 0).rotateSelf(0, tt.x * TILT * tt.a, 0);
      m.scaleSelf(p.s * squeeze).skewXSelf(sk);
      const plateM = m.translate(-p.w / 2, -p.h / 2);
      // the CSS card mirrors on its back so its chips read; the WebGL plate does not (see FRAG)
      const tf = (flipped ? m.scaleSelf(-1, 1, 1).translateSelf(-p.w / 2, -p.h / 2) : plateM).toString();
      const o = c.out;
      if (tf !== o.tf) {
        o.tf = tf;
        c.el.style.transform = tf;
        dirty = true;
      }

      // the cover goes through WebGL while it is curled (every view but the grid) or warped under the cursor
      const warp = reduced ? 0 : c.warp;
      if (sgl && c.img && !c.tex && c.img.complete && c.img.naturalWidth) {
        c.tex = sgl.texture(c.img);
        c.aspect = c.img.naturalWidth / c.img.naturalHeight;
      }
      const glOn = !!c.tex && (Math.abs(p.curl) > 0.05 || warp > 0.004);
      if (glOn !== c.glOn) {
        c.glOn = glOn;
        // the CSS face turns see-through while WebGL draws the cover under it
        if (c.img) c.img.style.visibility = glOn ? 'hidden' : '';
        const face = c.img?.parentElement;
        if (face) face.style.boxShadow = glOn ? 'none' : '';
      }
      if (glOn && p.o > 0.01) {
        const sc = p.s * squeeze;
        const plate: Plate = {
          tex: c.tex!,
          aspect: c.aspect,
          m: plateM,
          w: p.w,
          h: p.h,
          z: p.z,
          // the plate bulges further and its middle leads its edges while it moves
          bend: p.curl * sc * (1 + swell * Math.abs(rub) * t),
          warpK: (p.lean * 0.1) / unit,
          // rub is capped: a key press or a fling moves the offset far faster than the reference's wheel ever does
          swirl: lead * rub * t * p.w * sc * sway,
          cy: p.y + fy,
          op: p.o,
          warp,
          u: (tt.x + 1) / 2,
          v: 1 - (tt.y + 1) / 2,
        };
        plates.push(plate);
        // the rest of what it is drawn with (its matrix is in tf)
        if (changed(o.gl, [plate.bend, plate.warpK, plate.swirl, plate.op, warp, plate.u, plate.v])) dirty = true;
      } else if (changed(o.gl, [])) dirty = true;
      if (Math.abs(p.o - o.o) > 0.002) {
        o.o = p.o;
        // a fully shown card snaps to exactly 1: below 1 it becomes a backdrop root and the chips stop blurring
        c.el.style.opacity = p.o > 0.995 ? '1' : String(p.o);
      }
      const isVis = idx >= 0;
      const facing = !ringed || (isVis && Math.abs(wrap(idx - offset - front, vis.length)) < 1.5);
      const live = isVis && p.o > 0.3 && facing;
      if (live !== o.live) {
        o.live = live;
        c.el.style.pointerEvents = live ? 'auto' : 'none';
        if (!live) hoverOff(c); // a hovered card that turns away drops its hover at once
      }
      // chips undo the depth scale, so they read at one size on every card (the showcase's front card, at z 0). Only
      // the cards that can be hovered show chips, so only theirs is kept current: each change restyles the chip row
      if (live) {
        const ck = Math.round(clamp((lens - p.z) / lens, 0.5, 2) * 200) / 200;
        if (ck !== o.k) {
          o.k = ck;
          c.el.style.setProperty('--chip-k', String(ck));
        }
      }
      // filtered-out cards leave the tab order and the accessibility tree
      if (isVis !== o.vis) {
        o.vis = isVis;
        c.el.tabIndex = isVis && !c.extra ? 0 : -1;
        c.el.toggleAttribute('inert', !isVis);
      }
    }

    // the CSS cards (chips and hit areas; WebGL's depth buffer sorts the covers) paint back to front. Only their order
    // is written, which changes far less often than their depth
    byDepth.sort((a, b) => a.cur.z - b.cur.z);
    byDepth.forEach((c, r) => {
      if (c.out.z !== r) {
        c.out.z = r;
        c.el.style.zIndex = String(r + 1);
      }
    });

    // the world is a 0×0 point at the axis: left 50%, top as CSS has it this frame (it eases between views)
    if (sgl && dirty) {
      sgl.draw(plates, lens, worldTop);
      drawn.lens = lens;
      drawn.top = worldTop;
    }

    // the spiral's camera axis sits lower than the other views' (spiralAxis); CSS eases it in and out
    const nextAxis = view === 'spiral' ? `${(frame.axis * 100).toFixed(2)}%` : '';
    if (nextAxis !== axis) {
      axis = nextAxis;
      world.style.top = axis;
    }
  }

  // ---------- input ----------
  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startY = 0;
  let startTarget = 0;
  let idle: number | undefined;

  const spacing = () => {
    const sz = sizes(view);
    return view === 'slider' ? sz.w + sz.gap : sz.w * 0.95;
  };
  const snap = (ms = 140) => {
    clearTimeout(idle);
    if (view === 'grid') return;
    idle = window.setTimeout(() => (target = Math.round(target)), ms);
  };

  const onWheel = (e: WheelEvent) => {
    if (paused || ambient || (view === 'grid' && !gridMax())) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target += view === 'grid' ? delta : delta * 0.0016;
    autoHold = performance.now() + 2500;
    snap();
  };
  const onDown = (e: PointerEvent) => {
    if (paused || ambient || (view === 'grid' && !gridMax()) || e.button !== 0) return;
    dragging = true;
    dragged = false;
    startX = e.clientX;
    startY = e.clientY;
    startTarget = target;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = view === 'grid' ? e.clientY - startY : e.clientX - startX;
    if (Math.abs(dx) > 6 && !dragged) {
      dragged = true;
      stage.classList.add('is-dragging');
    }
    if (dragged) target = startTarget - (view === 'grid' ? dx : dx / spacing());
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    autoHold = performance.now() + 2500;
    stage.classList.remove('is-dragging');
    target = view === 'grid' ? target - vel * 6 : Math.round(target - vel * 6); // grid: px, free
  };
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (!a) return;
    e.preventDefault();
    if (dragged) {
      dragged = false;
      return;
    }
    if (a.hasAttribute('data-placeholder')) return; // filler has no case page yet
    if (e.metaKey || e.ctrlKey) {
      window.open((a as HTMLAnchorElement).href, '_blank');
      return;
    }
    opts.onOpen(a.dataset.case!);
  };
  const onKey = (e: KeyboardEvent) => {
    if (paused || ambient || view === 'grid' || e.altKey || e.metaKey || e.ctrlKey) return;
    if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    autoHold = performance.now() + 2500;
    // on a card focused from the keyboard the arrows move the focus to its neighbour, which then comes to the front
    if (focused) {
      const order = visible().filter((c) => !c.extra);
      order[(order.indexOf(focused) + step + order.length) % order.length]?.el.focus({ preventScroll: true });
    } else target = Math.round(target) + step;
  };

  // every view: the hovered project's label (pacomepertant.com), dressed and moving like the Services hover box
  // (motion.ts hoverLabel), its middle level with the pointer and the case's task typed in live
  const labelEl = stage.parentElement?.querySelector<HTMLElement>('[data-spiral-tag]') ?? null;
  const label = labelEl ? hoverLabel(labelEl, (y, h) => y - h / 2) : null;
  const tagType = labelEl ? typer(labelEl.querySelector<HTMLElement>('[data-tag-typed]')!) : null;
  const onTagMove = (e: PointerEvent) => {
    if (hovered && !byFocus) label?.follow(e.clientX, e.clientY);
  };
  // x, y: where it shows up, if it shows up from nothing
  const labelOn = (c: Card, x: number, y: number) => {
    if (!label || !labelEl || c.placeholder) return;
    if (labelEl.dataset.case !== c.el.dataset.case || !label.on) tagType!.write(c.el.dataset.task ?? '');
    labelEl.dataset.case = c.el.dataset.case;
    if (label.gone) label.follow(x, y, true);
    label.show();
  };

  const hoverOn = (c: Card, keys: boolean) => {
    if (ambient) return;
    if (hovered && hovered !== c) hoverOff(hovered);
    hovered = c;
    byFocus = keys;
    c.el.classList.add('is-hover');
    // the pointer's label sits by the pointer, a focused card's beside the card
    const r = keys ? c.el.getBoundingClientRect() : null;
    labelOn(c, r ? r.right : mx, r ? r.top + r.height / 2 : my);
  };
  const hoverOff = (c: Card) => {
    if (hovered !== c) return;
    hovered = null;
    byFocus = false;
    autoHold = performance.now() + 600;
    c.el.classList.remove('is-hover');
    label?.hide();
  };
  const offs = cards.map((c) => {
    // touch has no hover: a tap just opens the case (no tilt, WebGL warp or label)
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || dragging) return;
      // pointerenter comes before the pointermove that would update these: the label shows up at the pointer
      mx = e.clientX;
      my = e.clientY;
      hoverOn(c, false);
    };
    const leave = () => hoverOff(c);
    // tabbing to a card brings it to the front of the ring / row; render shows its hover once it is there
    const onFocus = () => {
      if (!c.el.matches(':focus-visible')) return;
      focused = c;
      const vis = visible();
      const idx = vis.indexOf(c);
      if (view !== 'grid' && !paused && idx >= 0) {
        const base = Math.round(target);
        // the spiral's plate facing the eye sits FRONT places on: two, at rest
        const front = view === 'spiral' ? Math.round(FRONT) : 0;
        target = base + (view === 'slider' && !sliderWraps() ? idx - base : wrap(idx - front - base, vis.length));
        autoHold = performance.now() + 2500;
      }
    };
    const onBlur = () => {
      if (focused === c) focused = null;
    };
    c.el.addEventListener('pointerenter', enter);
    c.el.addEventListener('pointerleave', leave);
    c.el.addEventListener('focus', onFocus);
    c.el.addEventListener('blur', onBlur);
    return () => {
      c.el.removeEventListener('pointerenter', enter);
      c.el.removeEventListener('pointerleave', leave);
      c.el.removeEventListener('focus', onFocus);
      c.el.removeEventListener('blur', onBlur);
    };
  });

  const onPointer = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
    inside = !ambient && e.pointerType !== 'touch' && my < window.innerHeight - NO_TILT_BOTTOM;
  };
  const onOut = () => (inside = false);
  // as the Lab's ceiling: whether any of it is on screen
  const seen = new IntersectionObserver((es) => (onScreen = es[es.length - 1].isIntersecting));
  window.addEventListener('pointermove', onPointer);
  window.addEventListener('pointermove', onTagMove);
  document.documentElement.addEventListener('pointerleave', onOut);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  stage.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);

  stage.classList.remove('is-showcase', 'is-grid', 'is-slider', 'is-spiral');
  stage.classList.add(`is-${view}`);
  gsap.ticker.add(render);

  return {
    setView,
    setFilter,
    intro,
    pause(p) {
      paused = p;
      if (p && hovered) hoverOff(hovered);
    },
    ambient(on) {
      ambient = on;
      if (on) {
        if (hovered) hoverOff(hovered);
        focused = null;
        inside = false;
        seen.observe(root);
      } else {
        seen.disconnect();
        onScreen = true;
      }
    },
    destroy() {
      gsap.ticker.remove(render);
      clearTimeout(idle);
      seen.disconnect();
      cards.forEach((c) => gsap.killTweensOf(c.blend));
      sgl?.dispose();
      offs.forEach((off) => off());
      stage.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointermove', onTagMove);
      document.documentElement.removeEventListener('pointerleave', onOut);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      dots?.destroy();
      tagType?.kill();
      label?.kill();
    },
  };
}
