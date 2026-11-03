import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, CustomEase);

/**
 * Motion language — one source of truth (see brief → "Мова руху: токени").
 * Values were read from the reference sites' code.
 */
export const ease = {
  out: CustomEase.create('m-out', '0.16,1,0.3,1'), // expo-out: reveals, entrances (avea, leoleo)
  inOut: CustomEase.create('m-inout', '0.45,0,0.15,1'), // layout + page switches (avea)
  in: CustomEase.create('m-in', '0.7,0,0.84,0'), // exits
  ui: CustomEase.create('m-ui', '0.215,0.61,0.355,1'), // accordion, hovers (thegradient)
  words: CustomEase.create('m-words', '0.73,0,0,1'), // masked word reveal (lorenzodossi.com)
  spring: 'back.out(1.6)', // nav indicator, taps (laurent spring 480/30 approximated)
};

export const dur = {
  micro: 0.2,
  base: 0.45,
  layout: 0.75, // faster than avea's 0.9, closer to laurent's springs
  page: 0.75,
  overlayIn: 0.85,
  overlayOut: 0.5,
  intro: 1.0,
};

export const stagger = { item: 0.04, card: 0.03, word: 0.05 };

/** Smoothing for things that follow input (avea / laurent). */
export const follow = { lerp: 0.11, lerpDrag: 0.16 };

// live binding: importers see the value change if the setting is toggled while the site is open
export let reduced = false;
const reducedWatchers = new Set<(r: boolean) => void>();
/** Calls `fn` whenever the reduced-motion setting changes (for what is set up once, like Lenis); returns the unsubscribe. */
export function onReducedChange(fn: (r: boolean) => void) {
  reducedWatchers.add(fn);
  return () => void reducedWatchers.delete(fn);
}

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    reduced = mq.matches;
    // reduced motion = no visible movement: every tween finishes within a frame or two (callbacks and order still run)
    gsap.globalTimeline.timeScale(reduced ? 100 : 1);
    reducedWatchers.forEach((fn) => fn(reduced));
  };
  apply();
  mq.addEventListener('change', apply);
}

/** One reveal language (lorenzodossi.com): words rise out of their own masks. Same timing on About, Services and cases. */
export const RISE = { dur: 1.1, ease: ease.words, span: 0.6 };

/** Tween vars for the rise: the words come up out of their masks, the stagger tightening so `span` seconds cover them all. */
export const rise = (words: HTMLElement[], span = RISE.span): gsap.TweenVars => ({
  yPercent: 0,
  duration: RISE.dur,
  ease: RISE.ease,
  stagger: Math.min(stagger.word, span / words.length),
});

/** Wrap every word of `el` (keeping inline children like the grey name) in a clipped mask + inner span. */
export function splitWords(el: HTMLElement): HTMLElement[] {
  const inner: HTMLElement[] = [];
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) return walk(n);
      if (n.nodeType !== Node.TEXT_NODE || !n.textContent) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(part);
        const mask = document.createElement('span');
        const word = document.createElement('span');
        mask.className = 'w';
        word.className = 'wi';
        word.textContent = part;
        mask.append(word);
        frag.append(mask);
        inner.push(word);
      });
      n.replaceWith(frag);
    });
  };
  walk(el);
  return inner;
}

/**
 * Hover copy typed live (Services and the spiral label): `typed` fills at ~170 chars/s and its paragraph's height is
 * tweened, so a new line eases the box open instead of snapping. `write` restarts with new text, `kill` stops it.
 */
export function typer(typed: HTMLElement) {
  const para = typed.parentElement!;
  const type = { n: 0 };
  let target = 0;
  const fit = () => {
    const cur = para.offsetHeight;
    para.style.height = 'auto';
    const h = para.offsetHeight;
    para.style.height = `${cur}px`;
    if (h === target) return;
    target = h;
    gsap.to(para, { height: h, duration: 0.4, ease: ease.out, overwrite: true });
  };
  // once typing ends, hand the height back to the content so nothing can stay clipped
  const settle = () => {
    const cur = para.offsetHeight;
    gsap.killTweensOf(para);
    para.style.height = 'auto';
    const h = para.offsetHeight;
    gsap.fromTo(para, { height: cur }, { height: h, duration: 0.3, ease: ease.out, onComplete: () => { para.style.height = 'auto'; } });
  };
  const write = (full: string) => {
    gsap.killTweensOf(type);
    const text = full.replace(/\.$/, '');
    const put = () => {
      typed.textContent = text.slice(0, Math.round(type.n));
      fit();
    };
    type.n = reduced ? text.length : 0;
    gsap.killTweensOf(para);
    para.style.height = 'auto';
    target = 0;
    put();
    if (reduced) return;
    // far quicker than reading speed, capped so long texts stay snappy
    gsap.to(type, { n: text.length, duration: Math.min(text.length / 170, 1.1), ease: 'none', delay: 0.12, onUpdate: put, onComplete: settle });
  };
  return { write, kill: () => gsap.killTweensOf([type, para]) };
}

/**
 * The hover box that rides the pointer (the Services description, the Work label): 24px right of the point, at the
 * height `anchorY` gives, kept inside the viewport and off the nav; it tilts with the pointer's speed and scales in
 * and out. `.is-on` while shown (CSS spins its rainbow edge only then). It grows as `typer` types into it: on every
 * resize it re-measures and takes its place again, so its anchor stays put on a still pointer.
 */
export function hoverLabel(el: HTMLElement, anchorY: (y: number, h: number) => number) {
  const xTo = gsap.quickTo(el, 'x', { duration: dur.base, ease: ease.out });
  const yTo = gsap.quickTo(el, 'y', { duration: dur.base, ease: ease.out });
  const rTo = gsap.quickTo(el, 'rotation', { duration: 0.8, ease: ease.out });
  gsap.set(el, { scale: 0.6, opacity: 0 });
  let w = el.offsetWidth;
  let h = el.offsetHeight;
  let px = 0; // the point it last followed
  let py = 0;
  const follow = (x: number, y: number, snap = false) => {
    const tx = gsap.utils.clamp(16, window.innerWidth - w - 16, x + 24);
    const ty = gsap.utils.clamp(16, window.innerHeight - h - 96, anchorY(y, h));
    if (snap) gsap.set(el, { x: tx, y: ty, rotation: 0 });
    xTo(tx);
    yTo(ty);
    rTo(reduced || snap ? 0 : gsap.utils.clamp(-10, 10, (x - px) * 0.6));
    px = x;
    py = y;
  };
  const ro = new ResizeObserver(() => {
    w = el.offsetWidth;
    h = el.offsetHeight;
    if (el.classList.contains('is-on')) follow(px, py);
  });
  ro.observe(el);
  return {
    follow,
    get on() {
      return el.classList.contains('is-on');
    },
    /** Shown and nearly faded out: it appears at the point instead of flying in from where it last hid. */
    get gone() {
      return !el.classList.contains('is-on') && Number(gsap.getProperty(el, 'opacity')) < 0.05;
    },
    show() {
      el.classList.add('is-on');
      // overwrite: a quick flick in and out would otherwise leave the longer show tween running past the hide
      gsap.to(el, { opacity: 1, scale: 1, duration: 0.45, ease: ease.out, overwrite: 'auto' });
    },
    hide() {
      el.classList.remove('is-on');
      gsap.to(el, { opacity: 0, scale: 0.6, duration: 0.3, ease: ease.ui, overwrite: 'auto' });
    },
    kill() {
      ro.disconnect();
      gsap.killTweensOf(el);
    },
  };
}

export { gsap, ScrollTrigger };
