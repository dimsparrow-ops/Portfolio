/**
 * Polka-dot field behind the Work hero (carterogunsola.com/lab/polka-dots).
 * Dots near the cursor are pushed away and grow ("bloom"); each dot springs
 * back to its home with the tuned values from the reference.
 */
export const DOTS = {
  spacing: 48, // px between dots
  size: 1.5, // px radius at rest
  color: 'rgba(0, 0, 0, 0.16)',
  repel: 108, // px radius of influence
  push: 0.4, // how far dots are pushed, × repel
  bloom: 0.5, // extra scale at the cursor
  stiff: 0.095,
  damp: 0.54,
  mass: 0.6,
};

export function initDots(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d')!;
  let w = 0;
  let h = 0;
  let dpr = 1;
  // per dot: home x/y, offset x/y, velocity x/y, scale
  let d = new Float32Array(0);
  let n = 0;
  let mx = -1e4;
  let my = -1e4;
  let settled = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const s = DOTS.spacing;
    const cols = Math.ceil(w / s) + 1;
    const rows = Math.ceil(h / s) + 1;
    const ox = (w - (cols - 1) * s) / 2;
    const oy = (h - (rows - 1) * s) / 2;
    n = cols * rows;
    d = new Float32Array(n * 7);
    let k = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++, k += 7) {
        d[k] = ox + i * s;
        d[k + 1] = oy + j * s;
        d[k + 6] = 1;
      }
    settled = false;
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = DOTS.color;
    ctx.beginPath();
    for (let k = 0; k < n * 7; k += 7) {
      const x = d[k] + d[k + 2];
      const y = d[k + 1] + d[k + 3];
      const r = DOTS.size * d[k + 6];
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function tick(dt: number) {
    if (reduced) return;
    const R = DOTS.repel;
    const f = Math.min(dt * 60, 1); // frame-rate independent (capped for stability)
    let moving = false;
    for (let k = 0; k < n * 7; k += 7) {
      const dx = d[k] - mx;
      const dy = d[k + 1] - my;
      const dist = Math.hypot(dx, dy);
      let tx = 0;
      let ty = 0;
      let ts = 1;
      if (dist < R) {
        const p = 1 - dist / R;
        const e = p * p * (3 - 2 * p); // smoothstep
        const len = dist || 1;
        tx = (dx / len) * R * DOTS.push * e;
        ty = (dy / len) * R * DOTS.push * e;
        ts = 1 + DOTS.bloom * e;
      }
      // spring toward target offset
      const ax = (DOTS.stiff * (tx - d[k + 2]) - DOTS.damp * d[k + 4]) / DOTS.mass;
      const ay = (DOTS.stiff * (ty - d[k + 3]) - DOTS.damp * d[k + 5]) / DOTS.mass;
      d[k + 4] += ax * f;
      d[k + 5] += ay * f;
      d[k + 2] += d[k + 4] * f;
      d[k + 3] += d[k + 5] * f;
      d[k + 6] += (ts - d[k + 6]) * Math.min(0.2 * f, 1);
      if (!moving && (Math.abs(d[k + 4]) > 0.01 || Math.abs(d[k + 5]) > 0.01 || Math.abs(d[k + 6] - ts) > 0.01 || dist < R)) moving = true;
    }
    if (moving || !settled) draw();
    settled = !moving;
  }

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  };
  const onLeave = () => {
    mx = my = -1e4;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener('pointermove', onMove);
  document.documentElement.addEventListener('pointerleave', onLeave);
  resize();

  return {
    tick,
    destroy() {
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    },
  };
}
