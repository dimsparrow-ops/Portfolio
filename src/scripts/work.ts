import { gsap, ease, dur, stagger, follow, reduced } from './motion';
import { initDots } from './dots';

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
  tilt: { x: number; y: number; a: number }; // smoothed tilt (bencho.dev)
  warp: number; // 0..1 hover amount of the WebGL cover distortion
  gl: CoverGL | null;
  glTried: boolean; // createCoverGL runs once per card (it can legitimately return null)
  img: HTMLImageElement | null;
  // last values written to the DOM, so unchanged styles aren't re-set every frame
  out: { o: number; z: number; live: boolean; vis: boolean };
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

const VERT = `attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
// same falloff as cappen.com/works: uv is pulled toward the cursor by 1/(1+(d/r)^4 * k)
const FRAG = `precision highp float;uniform sampler2D t;uniform vec2 m;uniform vec2 ratio;uniform float k;uniform float z;varying vec2 vUv;
void main(){vec2 uv=vUv-m;float d=length(uv)/.8;uv*=1./(1.+pow(d,4.)*k);uv+=m;
uv=(uv-.5)*z+.5;uv=vec2(uv.x*ratio.x+(1.-ratio.x)*.5,uv.y*ratio.y+(1.-ratio.y)*.5);
gl_FragColor=vec4(texture2D(t,vec2(uv.x,1.-uv.y)).rgb,1.);}`;

interface CoverGL {
  draw(a: number, u: number, v: number): void;
  hide(): void;
}

// one small WebGL canvas per card, created on first hover, sits over the cover <img>
function createCoverGL(img: HTMLImageElement): CoverGL | null {
  const face = img.parentElement;
  if (!face || !img.complete || !img.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'card-gl';
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  const U = (n: string) => gl.getUniformLocation(pr, n);
  const uM = U('m');
  const uK = U('k');
  const uZ = U('z');
  const uR = U('ratio');
  let w = 0;
  let h = 0;
  face.append(canvas);
  return {
    draw(a, u, v) {
      const cw = face.clientWidth;
      const ch = face.clientHeight;
      if (cw !== w || ch !== h) {
        w = cw;
        h = ch;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        const ia = img.naturalWidth / img.naturalHeight;
        const ca = w / h;
        gl.uniform2f(uR, Math.min(ca / ia, 1), Math.min(ia / ca, 1));
      }
      gl.uniform2f(uM, u, v);
      gl.uniform1f(uK, a);
      gl.uniform1f(uZ, 1 - 0.14 * a); // slight push-in so stretched edges never show the border
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      canvas.style.opacity = String(Math.min(1, a * 4));
    },
    hide() {
      if (canvas.style.opacity !== '0') canvas.style.opacity = '0';
    },
  };
}

export function initWork(
  root: HTMLElement,
  opts: { view: View; filter: Filter; onOpen: (slug: string) => void },
): WorkApi {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const world = root.querySelector<HTMLElement>('[data-world]')!;
  const cursor = document.querySelector<HTMLElement>('[data-case-cursor]');
  const cx = cursor ? gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' }) : null;
  const cy = cursor ? gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' }) : null;
  const dotsEl = root.querySelector<HTMLCanvasElement>('[data-dots]');
  const dots = dotsEl ? initDots(dotsEl, reduced) : null;

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
  const NO_TILT_BOTTOM = 120; // px: controls + nav strip, no section tilt there
  // one gap between neighbouring cards, shared by showcase and slider
  const cardGap = () => (dims().mobile ? 24 : 64);
  const TILT = 10; // deg, bencho.dev
  const WORLD_TILT = { x: 4, y: 6 }; // deg, whole section

  const RATIO = 1.1; // card shape, near-square portrait (cappen.com/works)
  const SCALE = 1; // was 1.25; cards 20% smaller
  const zero: Pose = { x: 0, y: 60, z: -1800, ry: 0, s: 0.35, w: 280, h: 210, o: 0 };
  const cards: Card[] = Array.from(world.querySelectorAll<HTMLAnchorElement>('.card')).map((el, i) => ({
    el,
    i,
    platform: el.dataset.platform ?? '',
    from: { ...zero },
    cur: { ...zero },
    blend: { v: 0 },
    w: 0,
    h: 0,
    tilt: { x: 0, y: 0, a: 0 },
    warp: 0,
    gl: null,
    glTried: false,
    out: { o: -1, z: NaN, live: false, vis: true },
    img: el.querySelector<HTMLImageElement>('.card-face img'),
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
      const w = mobile ? Math.min(vw * 0.75, 350) : Math.min(vw * 0.275 * SCALE, (vh * 0.62) / RATIO, 450 * SCALE);
      return { w, h: w * RATIO, gap: 0 };
    }
    if (v === 'slider') {
      const w = mobile ? vw * 0.86 : Math.min(vw * 0.325 * SCALE, (vh * 0.66) / RATIO, 500 * SCALE);
      return { w, h: w * RATIO, gap: cardGap() };
    }
    // grid
    const n = Math.max(1, visible().length);
    const cols = mobile ? 2 : n <= 3 ? n : n === 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const gap = cardGap(); // same rhythm as the slider
    const availW = vw - (mobile ? 32 : 120);
    const availH = vh - (mobile ? 220 : 240);
    let w = (availW - gap * (cols - 1)) / cols;
    let h = w * RATIO;
    if (h * rows + gap * (rows - 1) > availH) {
      h = (availH - gap * (rows - 1)) / rows;
      w = h / RATIO;
    }
    return { w: Math.min(w, 500 * SCALE), h: Math.min(h, 500 * SCALE * RATIO), gap, cols, rows };
  }

  // everything poseFor needs that is the same for all cards, computed once per frame
  interface Frame {
    vis: Card[];
    sz: ReturnType<typeof sizes>;
    wraps: boolean;
    vw: number;
    mobile: boolean;
  }
  function frameFor(v: View): Frame {
    const vis = visible();
    const { vw, mobile } = dims();
    const sz = sizes(v);
    return { vis, sz, wraps: v === 'slider' && wrapsFor(vis.length, sz, vw), vw, mobile };
  }

  function poseFor(c: Card, v: View, f: Frame): Pose {
    const { vis, sz, wraps, vw, mobile } = f;
    const idx = vis.indexOf(c);
    if (idx < 0) {
      const base = c.hiddenPose ?? c.cur;
      return { ...base, z: base.z - 220, s: base.s * 0.7, o: 0 };
    }
    const n = vis.length;
    if (v === 'showcase') {
      const step = 360 / Math.max(n, 3);
      // wide, airy ring (back cards stay visible); slider uses cardGap()
      const R = mobile ? sz.w * 1.25 : Math.max(sz.w * 1.8, vw * 0.6);
      const rel = wrap(idx - offset, n);
      const a = rel * step;
      const rad = (a * Math.PI) / 180;
      return { x: Math.sin(rad) * R, y: 0, z: Math.cos(rad) * R - R, ry: a, s: 1, w: sz.w, h: sz.h, o: 1 };
    }
    if (v === 'slider') {
      // infinite like avea.studio when the row is wider than the screen, otherwise clamped
      const rel = wraps ? wrap(idx - offset, n) : idx - offset;
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

  function wrapsFor(n: number, sz: { w: number; gap: number }, vw: number) {
    return n * (sz.w + sz.gap) > vw + sz.w * 1.2;
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
    // smoothing factors were tuned at 60fps; this keeps them identical on 120Hz screens
    const k = (r: number) => 1 - Math.pow(1 - r, dt * 60);
    const frame = frameFor(view);
    dots?.tick(dt);
    // slow endless drift until a project is hovered (showcase ring / infinite slider)
    const canAuto = !reduced && introDone && !hovered && !dragging && now > autoHold;
    if (canAuto && view === 'showcase') target += AUTO.showcase * dt;
    if (canAuto && view === 'slider' && frame.wraps) target += AUTO.slider * dt;
    if (view !== 'grid') {
      const n = visible().length;
      if (view === 'slider' && !frame.wraps) target = clamp(target, 0, Math.max(0, n - 1));
      offset += (target - offset) * k(dragging ? follow.lerpDrag : follow.lerp);
      if (Math.abs(target - offset) < 1e-4) offset = target;
    }
    const d = offset - prev;
    prev = offset;
    vel += (d - vel) * k(0.25);
    const skew = view === 'showcase' ? clamp(vel * 55, -12, 12) : 0;
    const squeeze = view === 'showcase' ? 1 - Math.min(Math.abs(vel) * 1.4, 0.1) : 1;

    for (const c of cards) {
      const to = poseFor(c, view, frame);
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
      if (hovered === c && !reduced) {
        const r = c.el.getBoundingClientRect();
        gx = clamp(((mx - r.left) / r.width) * 2 - 1, -1, 1);
        gy = clamp(((my - r.top) / r.height) * 2 - 1, -1, 1);
        ga = 1;
      }
      tt.x += (gx - tt.x) * k(0.14);
      tt.y += (gy - tt.y) * k(0.14);
      tt.a += (ga - tt.a) * k(0.14);
      const tiltStr =
        tt.a > 0.002 ? ` translateZ(${-14 * tt.a}px) rotateX(${-tt.y * TILT * tt.a}deg) rotateY(${tt.x * TILT * tt.a}deg)` : '';
      // cover distortion (cappen.com/works): calm at the cursor, strong toward the far edges
      c.warp += ((hovered === c ? 1 : 0) - c.warp) * k(0.12);
      if (c.img && !reduced) {
        if (c.warp > 0.004) {
          if (!c.glTried) {
            c.glTried = true;
            c.gl = createCoverGL(c.img);
          }
          c.gl?.draw(c.warp, (tt.x + 1) / 2, 1 - (tt.y + 1) / 2);
        } else c.gl?.hide();
      }

      c.el.style.transform =
        `translate3d(${p.x - p.w / 2}px, ${p.y - p.h / 2 + fy}px, ${p.z}px) rotateY(${p.ry}deg) rotateZ(${fz}deg)` +
        tiltStr +
        ` scale(${p.s * squeeze}) skewX(${sk}deg)` +
        (Math.abs(((p.ry % 360) + 540) % 360 - 180) > 90 ? ' scaleX(-1)' : '');
      const isVis = frame.vis.includes(c);
      const o = c.out;
      if (Math.abs(p.o - o.o) > 0.002) {
        o.o = p.o;
        c.el.style.opacity = String(p.o);
      }
      const z = Math.round(1000 + p.z);
      if (z !== o.z) {
        o.z = z;
        c.el.style.zIndex = String(z);
      }
      const live = isVis && p.o > 0.3;
      if (live !== o.live) {
        o.live = live;
        c.el.style.pointerEvents = live ? 'auto' : 'none';
      }
      // filtered-out cards leave the tab order and the accessibility tree
      if (isVis !== o.vis) {
        o.vis = isVis;
        c.el.tabIndex = isVis ? 0 : -1;
        c.el.toggleAttribute('inert', !isVis);
      }
    }

    // the whole section leans toward the pointer too
    const wtx = inside && !reduced ? (mx / window.innerWidth) * 2 - 1 : 0;
    const wty = inside && !reduced ? (my / window.innerHeight) * 2 - 1 : 0;
    world3d.x += (wtx - world3d.x) * k(0.06);
    world3d.y += (wty - world3d.y) * k(0.06);
    world.style.transform = `rotateX(${-world3d.y * WORLD_TILT.x}deg) rotateY(${world3d.x * WORLD_TILT.y}deg)`;
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
    if (cursor && !reduced) {
      gsap.set(cursor, { x: mx, y: my });
      cursor.classList.add('is-on');
    }
  };
  const hideTag = (c: Card) => {
    if (hovered !== c) return;
    hovered = null;
    autoHold = performance.now() + 600;
    stage.classList.remove('is-hovering');
    c.el.classList.remove('is-hover');
    cursor?.classList.remove('is-on');
  };
  const enters = cards.map((c) => {
    // touch has no hover: a tap just opens the case (no tilt, WebGL warp or cursor disc)
    const onPtr = (e: PointerEvent) => e.pointerType !== 'touch' && !dragging && showTag(c);
    const on = () => !dragging && showTag(c);
    const off = () => hideTag(c);
    c.el.addEventListener('pointerenter', onPtr);
    c.el.addEventListener('pointerleave', off);
    // tabbing to a card brings it to the front of the ring / row
    const onFocus = () => {
      if (view !== 'grid' && !paused && c.el.matches(':focus-visible')) {
        const idx = visible().indexOf(c);
        const base = Math.round(target);
        if (idx >= 0) target = base + (view === 'slider' && !sliderWraps() ? idx - base : wrap(idx - base, visible().length));
        autoHold = performance.now() + 2500;
      }
      on();
    };
    c.el.addEventListener('focus', onFocus);
    c.el.addEventListener('blur', off);
    return () => {
      c.el.removeEventListener('pointerenter', onPtr);
      c.el.removeEventListener('pointerleave', off);
      c.el.removeEventListener('focus', onFocus);
      c.el.removeEventListener('blur', off);
    };
  });

  const onPointer = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
    cx?.(mx);
    cy?.(my);
    inside = e.pointerType !== 'touch' && my < window.innerHeight - NO_TILT_BOTTOM;
  };
  const onOut = () => (inside = false);
  window.addEventListener('pointermove', onPointer);
  document.documentElement.addEventListener('pointerleave', onOut);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
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
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onOut);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      dots?.destroy();
      cursor?.classList.remove('is-on');
    },
  };
}
