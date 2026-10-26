import { gsap, ease, dur, stagger, follow, reduced } from './motion';

/**
 * Work stage — one render loop drives all three views (approach from avea.studio):
 * every card always has a target pose for the active view; switching views or
 * filters tweens each card's blend from its last pose to the new one, staggered
 * (the "cards fly into a new arrangement" feel of laurent.fyi).
 */
export type View = 'showcase' | 'grid' | 'slider';
export type Filter = 'all' | 'mobile' | 'desktop';

type Pose = { x: number; y: number; z: number; ry: number; s: number; w: number; h: number; o: number };

interface Card {
  el: HTMLAnchorElement;
  i: number;
  platform: string;
  from: Pose;
  cur: Pose;
  blend: { v: number };
  hiddenPose?: Pose;
  w: number;
  h: number;
  sheen: HTMLElement | null;
  tilt: { x: number; y: number; a: number }; // smoothed tilt (bencho.dev)
}

export interface WorkApi {
  setView(v: View): void;
  setFilter(f: Filter): void;
  intro(delay?: number): void;
  pause(p: boolean): void;
  destroy(): void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (v: number, n: number) => v - n * Math.round(v / n);

export function initWork(
  root: HTMLElement,
  opts: { view: View; filter: Filter; onOpen: (slug: string) => void },
): WorkApi {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const world = root.querySelector<HTMLElement>('[data-world]')!;
  const sliderLabel = root.querySelector<HTMLElement>('[data-slider-label]')!;
  const slA = root.querySelector<HTMLElement>('[data-sl-a]')!;
  const slB = root.querySelector<HTMLElement>('[data-sl-b]')!;
  const tag = document.querySelector<HTMLElement>('.tag')!;
  const tagA = tag.querySelector<HTMLElement>('.tag-a')!;
  const tagB = tag.querySelector<HTMLElement>('.tag-b')!;

  let view: View = opts.view;
  let filter: Filter = opts.filter;
  let offset = 0;
  let target = 0;
  let prev = 0;
  let vel = 0;
  let paused = false;
  let hovered: Card | null = null;
  let introDone = false;
  // pointer, section tilt, auto-motion
  let mx = 0;
  let my = 0;
  let inside = false;
  const world3d = { x: 0, y: 0 };
  let lastT = performance.now();
  let time = 0;
  let autoHold = 0;
  const AUTO = { showcase: 0.12, slider: 0.16 }; // cards per second
  const TILT = 10; // deg, bencho.dev
  const WORLD_TILT = { x: 4, y: 6 }; // deg, whole section

  const zero: Pose = { x: 0, y: 60, z: -1800, ry: 0, s: 0.35, w: 280, h: 280, o: 0 };
  const cards: Card[] = Array.from(world.querySelectorAll<HTMLAnchorElement>('.card')).map((el, i) => ({
    el,
    i,
    platform: el.dataset.platform ?? '',
    from: { ...zero },
    cur: { ...zero },
    blend: { v: 0 },
    w: 0,
    h: 0,
    sheen: el.querySelector<HTMLElement>('.card-sheen'),
    tilt: { x: 0, y: 0, a: 0 },
  }));

  const visible = () => cards.filter((c) => filter === 'all' || c.platform === filter);

  // ---------- layout ----------
  function dims() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 768;
    return { vw, vh, mobile };
  }

  function sizes(v: View) {
    const { vw, vh, mobile } = dims();
    if (v === 'showcase') {
      const w = mobile ? Math.min(vw * 0.5, 240) : Math.min(vw * 0.2, vh * 0.36, 320);
      return { w, h: w * 1.0, gap: 0 };
    }
    if (v === 'slider') {
      const w = mobile ? vw * 0.64 : Math.min(vw * 0.22, vh * 0.38, 340);
      return { w, h: w, gap: 6 };
    }
    // grid
    const n = Math.max(1, visible().length);
    const cols = mobile ? 2 : n <= 3 ? n : n === 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const gap = mobile ? 10 : 18;
    const availW = vw - (mobile ? 32 : 220);
    const availH = vh - (mobile ? 220 : 210);
    let w = (availW - gap * (cols - 1)) / cols;
    let h = w * 0.78;
    if (h * rows + gap * (rows - 1) > availH) {
      h = (availH - gap * (rows - 1)) / rows;
      w = h / 0.78;
    }
    return { w: Math.min(w, 420), h: Math.min(h, 420 * 0.78), gap, cols, rows };
  }

  function poseFor(c: Card, v: View): Pose {
    const vis = visible();
    const idx = vis.indexOf(c);
    if (idx < 0) {
      const base = c.hiddenPose ?? c.cur;
      return { ...base, z: base.z - 220, s: base.s * 0.7, o: 0 };
    }
    const n = vis.length;
    const sz = sizes(v);
    if (v === 'showcase') {
      const step = 360 / Math.max(n, 3);
      const { vw, mobile } = dims();
      const R = mobile ? sz.w * 1.25 : Math.max(sz.w * 1.8, vw * 0.42);
      const rel = wrap(idx - offset, n);
      const a = rel * step;
      const rad = (a * Math.PI) / 180;
      const back = Math.abs(a);
      const o = 1;
      return { x: Math.sin(rad) * R, y: 0, z: Math.cos(rad) * R - R, ry: a, s: 1, w: sz.w, h: sz.h, o };
    }
    if (v === 'slider') {
      // infinite like avea.studio when the row is wider than the screen, otherwise clamped
      const rel = sliderWraps() ? wrap(idx - offset, n) : idx - offset;
      return { x: rel * (sz.w + sz.gap), y: 0, z: 0, ry: 0, s: 1, w: sz.w, h: sz.h, o: 1 };
    }
    const cols = sz.cols!;
    const rows = sz.rows!;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols; // centre a short last row
    const x = (col - (inRow - 1) / 2) * (sz.w + sz.gap);
    const y = (row - (rows - 1) / 2) * (sz.h + sz.gap) + 10;
    return { x, y, z: 0, ry: 0, s: 1, w: sz.w, h: sz.h, o: 1 };
  }

  function sliderWraps() {
    const sz = sizes('slider');
    return visible().length * (sz.w + sz.gap) > dims().vw + sz.w * 1.2;
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
    const n = visible().length;
    // keep the same project in front when moving between views
    const front = ((Math.round(offset) % n) + n) % n;
    const fromGrid = view === 'grid';
    offset = target = v === 'grid' ? 0 : fromGrid ? 0 : front;
    view = v;
    stage.classList.remove('is-showcase', 'is-grid', 'is-slider');
    stage.classList.add(`is-${v}`);
    retarget(dur.layout, ease.inOut);
  }

  function setFilter(f: Filter) {
    if (f === filter) return;
    filter = f;
    offset = target = view === 'slider' && !sliderWraps() ? Math.floor((visible().length - 1) / 2) : 0;
    retarget(0.9, ease.inOut);
  }

  function intro(delay = 0) {
    cards.forEach((c, i) => {
      c.from = { ...zero, ry: (i - 2.5) * 14 };
      c.cur = { ...c.from };
      c.blend.v = 0;
      const k = visible().indexOf(c);
      gsap.to(c.blend, {
        v: 1,
        duration: dur.intro,
        ease: ease.out,
        delay: delay + Math.abs(k - (visible().length - 1) / 2) * 0.05,
        onComplete: () => (introDone = true),
      });
    });
  }

  // ---------- render ----------
  function render() {
    if (paused) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    time += dt;
    // slow endless drift until a project is hovered (showcase ring / infinite slider)
    const canAuto = !reduced && introDone && !hovered && !dragging && now > autoHold;
    if (canAuto && view === 'showcase') target += AUTO.showcase * dt;
    if (canAuto && view === 'slider' && sliderWraps()) target += AUTO.slider * dt;
    if (view !== 'grid') {
      const n = visible().length;
      if (view === 'slider' && !sliderWraps()) target = clamp(target, 0, Math.max(0, n - 1));
      offset += (target - offset) * (dragging ? follow.lerpDrag : follow.lerp);
      if (Math.abs(target - offset) < 1e-4) offset = target;
    }
    const d = offset - prev;
    prev = offset;
    vel += (d - vel) * 0.25;
    const skew = view === 'showcase' ? clamp(vel * 55, -12, 12) : 0;
    const squeeze = view === 'showcase' ? 1 - Math.min(Math.abs(vel) * 1.4, 0.1) : 1;

    for (const c of cards) {
      const to = poseFor(c, view);
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
      if (hovered === c) {
        const r = c.el.getBoundingClientRect();
        gx = clamp(((mx - r.left) / r.width) * 2 - 1, -1, 1);
        gy = clamp(((my - r.top) / r.height) * 2 - 1, -1, 1);
        ga = 1;
      }
      tt.x += (gx - tt.x) * 0.14;
      tt.y += (gy - tt.y) * 0.14;
      tt.a += (ga - tt.a) * 0.14;
      const tiltStr =
        tt.a > 0.002 ? ` translateZ(${-14 * tt.a}px) rotateX(${-tt.y * TILT * tt.a}deg) rotateY(${tt.x * TILT * tt.a}deg)` : '';
      if (c.sheen) {
        if (tt.a > 0.002) {
          const ox = ((tt.x + 1) / 2) * 100;
          const oy = ((tt.y + 1) / 2) * 100;
          c.sheen.style.backgroundImage =
            `radial-gradient(42% 34% at ${ox}% ${oy}%, rgba(9,14,28,${0.33 * tt.a}) 0%, rgba(9,14,28,0) 100%),` +
            `radial-gradient(52% 42% at ${100 - ox}% ${100 - oy}%, rgba(255,255,255,${0.2 * tt.a}) 0%, rgba(255,255,255,0) 100%)`;
        } else if (c.sheen.style.backgroundImage) c.sheen.style.backgroundImage = '';
      }

      c.el.style.transform =
        `translate3d(${p.x - p.w / 2}px, ${p.y - p.h / 2 + fy}px, ${p.z}px) rotateY(${p.ry}deg) rotateZ(${fz}deg)` +
        tiltStr +
        ` scale(${p.s * squeeze}) skewX(${sk}deg)` +
        (Math.abs(((p.ry % 360) + 540) % 360 - 180) > 90 ? ' scaleX(-1)' : '');
      const vis = visible().includes(c);
      c.el.style.opacity = String(p.o);
      c.el.style.zIndex = String(Math.round(1000 + p.z));
      c.el.style.pointerEvents = vis && p.o > 0.3 ? 'auto' : 'none';
      c.el.tabIndex = vis ? 0 : -1;
    }

    // the whole section leans toward the pointer too
    const wtx = inside && !reduced ? (mx / window.innerWidth) * 2 - 1 : 0;
    const wty = inside && !reduced ? (my / window.innerHeight) * 2 - 1 : 0;
    world3d.x += (wtx - world3d.x) * 0.06;
    world3d.y += (wty - world3d.y) * 0.06;
    world.style.transform = `rotateX(${-world3d.y * WORLD_TILT.x}deg) rotateY(${world3d.x * WORLD_TILT.y}deg)`;

    // slider label above the centred card (avea.studio)
    if (view === 'slider') {
      const vis = visible();
      const k = ((Math.round(offset) % vis.length) + vis.length) % vis.length;
      const c = vis[k];
      if (c) {
        const sz = sizes('slider');
        const r = world.getBoundingClientRect();
        sliderLabel.style.width = `${sz.w}px`;
        sliderLabel.style.transform = `translate(${-sz.w / 2}px, ${r.top - sz.h / 2 - 20}px)`;
        if (slA.textContent !== c.el.dataset.index) {
          slA.textContent = c.el.dataset.index ?? '';
          slB.textContent = c.el.dataset.title ?? '';
        }
      }
    }

    // hover tag follows the card's top-left corner (laurent.fyi)
    if (hovered) {
      const r = hovered.el.getBoundingClientRect();
      tag.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top - 44)}px)`;
    }
  }
  gsap.ticker.add(render);

  // ---------- input ----------
  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startTarget = 0;
  let idle: number | undefined;

  const spacing = () => {
    const sz = sizes(view);
    return view === 'slider' ? sz.w + sz.gap : sz.w * 0.95;
  };
  const snap = (ms = 140) => {
    clearTimeout(idle);
    idle = window.setTimeout(() => (target = Math.round(target)), ms);
  };

  const onWheel = (e: WheelEvent) => {
    if (paused || view === 'grid') return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target += delta * 0.0016;
    autoHold = performance.now() + 2500;
    snap();
  };
  const onDown = (e: PointerEvent) => {
    if (paused || view === 'grid' || e.button !== 0) return;
    dragging = true;
    dragged = false;
    startX = e.clientX;
    startTarget = target;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6 && !dragged) {
      dragged = true;
      stage.classList.add('is-dragging');
    }
    if (dragged) target = startTarget - dx / spacing();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    autoHold = performance.now() + 2500;
    stage.classList.remove('is-dragging');
    target = Math.round(target - vel * 6);
  };
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('.card');
    if (!a) return;
    e.preventDefault();
    if (dragged) {
      dragged = false;
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      window.open(a.href, '_blank');
      return;
    }
    opts.onOpen(a.dataset.case!);
  };
  const onKey = (e: KeyboardEvent) => {
    if (paused || view === 'grid') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') autoHold = performance.now() + 2500;
    if (e.key === 'ArrowRight') target = Math.round(target) + 1;
    if (e.key === 'ArrowLeft') target = Math.round(target) - 1;
  };

  const showTag = (c: Card) => {
    hovered = c;
    stage.classList.add('is-hovering');
    c.el.classList.add('is-hover');
    const d = c.el.dataset;
    tagA.textContent = `${d.title} · ${d.platform}`;
    tagB.textContent = `${d.country} · ${d.year}`;
    gsap.to(tag, { opacity: 1, duration: dur.micro, ease: ease.ui, overwrite: true });
  };
  const hideTag = (c: Card) => {
    if (hovered !== c) return;
    hovered = null;
    autoHold = performance.now() + 600;
    stage.classList.remove('is-hovering');
    c.el.classList.remove('is-hover');
    gsap.to(tag, { opacity: 0, duration: 0.15, ease: ease.ui, overwrite: true });
  };
  const enters = cards.map((c) => {
    const on = () => !dragging && showTag(c);
    const off = () => hideTag(c);
    c.el.addEventListener('pointerenter', on);
    c.el.addEventListener('pointerleave', off);
    c.el.addEventListener('focus', on);
    c.el.addEventListener('blur', off);
    return () => {
      c.el.removeEventListener('pointerenter', on);
      c.el.removeEventListener('pointerleave', off);
      c.el.removeEventListener('focus', on);
      c.el.removeEventListener('blur', off);
    };
  });

  const onPointer = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
    inside = true;
  };
  const onOut = () => (inside = false);
  stage.addEventListener('pointermove', onPointer);
  stage.addEventListener('pointerleave', onOut);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);

  stage.classList.remove('is-showcase', 'is-grid', 'is-slider');
  stage.classList.add(`is-${view}`);

  return {
    setView,
    setFilter,
    intro,
    pause(p) {
      paused = p;
      if (p && hovered) hideTag(hovered);
    },
    destroy() {
      gsap.ticker.remove(render);
      cards.forEach((c) => gsap.killTweensOf(c.blend));
      enters.forEach((off) => off());
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointermove', onPointer);
      stage.removeEventListener('pointerleave', onOut);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      stage.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      gsap.set(tag, { opacity: 0 });
      void introDone;
    },
  };
}
