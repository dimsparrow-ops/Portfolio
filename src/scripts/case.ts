import Lenis from 'lenis';
import { gsap, ScrollTrigger, ease, dur, reduced, onReducedChange, RISE, rise, splitWords } from './motion';

/**
 * Case overlay (leoleo.studio): the panel rises over Work, keeps its own URL.
 * Story column (thegradient.com): Input / Approach / Outcomes open
 * as their media scrolls into view, and can also be toggled by click.
 */
const layer = () => document.querySelector<HTMLElement>('.case-layer')!;

let lenis: Lenis | null = null;
let triggers: ScrollTrigger[] = [];
let cleanup: (() => void)[] = [];
let isOpen = false;
let opener: HTMLElement | null = null; // where keyboard focus returns on close
// everything behind the dialog: made inert while it is open (focus trap + hidden from screen readers)
const BACKGROUND = ['#pages', '.shell', '.logo'];
const setBackgroundInert = (on: boolean) =>
  BACKGROUND.forEach((s) => document.querySelector<HTMLElement>(s)?.toggleAttribute('inert', on));
// the story column sits beside the media from 901px (global.css). Stacked above it, it doesn't follow the scroll: its
// panels would open and close out of sight and shift the media under the reader
const sideBySide = typeof window !== 'undefined' ? window.matchMedia('(min-width: 901px)') : null;

export const caseIsOpen = () => isOpen;

function setAcc(item: HTMLElement, open: boolean, instant = false) {
  const panel = item.querySelector<HTMLElement>('.acc-panel')!;
  const btn = item.querySelector<HTMLElement>('.acc-btn')!;
  if (item.classList.contains('is-open') === open && !instant) return;
  item.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  panel.inert = !open; // collapsed text is not read out
  gsap.killTweensOf(panel);
  if (instant) {
    gsap.set(panel, { height: open ? 'auto' : 0 });
    return;
  }
  gsap.to(panel, { height: open ? 'auto' : 0, duration: dur.base, ease: ease.ui });
  const ps = panel.querySelectorAll('p, .metric'); // the Outcomes panel also carries the metric rows
  if (open && ps.length) gsap.fromTo(ps, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: dur.base, ease: ease.out, delay: 0.08, stagger: 0.04 });
}

function wire(article: HTMLElement, scroller: HTMLElement) {
  const items = Array.from(article.querySelectorAll<HTMLElement>('.acc-item'));
  items.forEach((it) => (it.querySelector<HTMLElement>('.acc-panel')!.inert = !it.classList.contains('is-open')));
  const openOnly = (key: string) => items.forEach((it) => setAcc(it, it.dataset.acc === key));

  items.forEach((it) => {
    const btn = it.querySelector<HTMLElement>('.acc-btn')!;
    const on = () => setAcc(it, !it.classList.contains('is-open'));
    btn.addEventListener('click', on);
    cleanup.push(() => btn.removeEventListener('click', on));
  });

  // one deterministic rule instead of enter/leave events per group: the open item is the last group whose top has
  // crossed the reading line. Top of the case = Input; the very bottom = the last group (it may be too short to ever reach the line).
  const groups = Array.from(article.querySelectorAll<HTMLElement>('.media-group')).filter((g) => g.dataset.section);
  let current = groups[0]?.dataset.section ?? 'input';
  const sync = () => {
    if (!groups.length || !sideBySide?.matches) return;
    const visible = groups.filter((g) => g.offsetHeight > 0);
    if (!visible.length) return;
    const top = scroller.getBoundingClientRect().top;
    const line = top + scroller.clientHeight * 0.62;
    let key = visible[0].dataset.section!;
    if (scroller.scrollTop >= 8) {
      for (const g of visible) if (g.getBoundingClientRect().top <= line) key = g.dataset.section!;
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) key = visible[visible.length - 1].dataset.section!;
    }
    if (key === current) return;
    current = key;
    openOnly(key);
  };
  triggers.push(ScrollTrigger.create({ scroller, start: 0, end: 'max', onUpdate: sync, onRefresh: sync }));

  // lazy images change the group heights as they load: re-measure so the open item always matches the zone on screen
  let measure = 0;
  const remeasure = () => {
    clearTimeout(measure);
    measure = window.setTimeout(() => {
      ScrollTrigger.refresh();
      sync();
    }, 60);
  };
  article.querySelectorAll<HTMLImageElement>('img').forEach((img) => !img.complete && img.addEventListener('load', remeasure, { once: true }));
  cleanup.push(() => clearTimeout(measure));

  // media fade-up as it enters
  article.querySelectorAll<HTMLElement>('.media-group > *').forEach((m) => {
    gsap.set(m, { y: 40, opacity: 0 });
    triggers.push(
      ScrollTrigger.create({
        trigger: m,
        scroller,
        start: 'top 92%',
        once: true,
        onEnter: () => gsap.to(m, { y: 0, opacity: 1, duration: RISE.dur, ease: RISE.ease }),
      }),
    );
  });
}

/** Case videos: no autoplay under reduced motion (controls instead); otherwise only the visible ones play. */
function wireVideos(slot: HTMLElement, scroller: HTMLElement) {
  const videos = Array.from(slot.querySelectorAll<HTMLVideoElement>('video'));
  if (!videos.length) return;
  if (reduced) {
    videos.forEach((v) => {
      v.removeAttribute('autoplay');
      v.pause();
      v.controls = true;
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? (e.target as HTMLVideoElement).play().catch(() => {}) : (e.target as HTMLVideoElement).pause())),
    { root: scroller, threshold: 0.1 },
  );
  videos.forEach((v) => io.observe(v));
  cleanup.push(() => io.disconnect());
}

/** Same masked word rise as About: head words ride the sheet in, the story column rises as it scrolls into view. */
function wireText(article: HTMLElement, scroller: HTMLElement) {
  const onScroll = (els: HTMLElement[], at: Element) => {
    const words = els.flatMap(splitWords);
    if (!words.length) return;
    gsap.set(words, { yPercent: 110 });
    triggers.push(ScrollTrigger.create({ trigger: at, scroller, start: 'top 92%', once: true, onEnter: () => gsap.to(words, rise(words)) }));
  };
  const acc = article.querySelector<HTMLElement>('.acc');
  if (acc) onScroll(Array.from(acc.querySelectorAll<HTMLElement>('.acc-btn .mono, .acc-item.is-open .acc-panel p')), acc);
}

export function openCase(opts: { html?: string; animate?: boolean; onClose: () => void }) {
  const L = layer();
  const scroller = L.querySelector<HTMLElement>('.case-scroller')!;
  const slot = L.querySelector<HTMLElement>('.case-slot')!;
  const backdrop = L.querySelector<HTMLElement>('.case-backdrop')!;
  if (opts.html != null) slot.innerHTML = opts.html;
  const article = slot.querySelector<HTMLElement>('.case');
  if (!article) return;

  isOpen = true;
  const active = document.activeElement as HTMLElement | null;
  opener = active && active !== document.body && active.matches(':focus-visible') ? active : null;
  setBackgroundInert(true);
  L.classList.add('is-open');
  L.setAttribute('aria-hidden', 'false');
  scroller.scrollTop = 0;

  lenis = new Lenis({ wrapper: scroller, content: slot, lerp: 0.1, smoothWheel: !reduced });
  const raf = (t: number) => lenis?.raf(t * 1000);
  gsap.ticker.add(raf);
  lenis.on('scroll', ScrollTrigger.update);
  const unwatch = onReducedChange((r) => lenis && (lenis.options.smoothWheel = !r));
  cleanup.push(() => gsap.ticker.remove(raf), unwatch);

  const closeEls = L.querySelectorAll<HTMLElement>('[data-case-close]');
  const onClose = () => opts.onClose();
  closeEls.forEach((el) => el.addEventListener('click', onClose));
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && opts.onClose();
  window.addEventListener('keydown', onKey);
  cleanup.push(() => {
    closeEls.forEach((el) => el.removeEventListener('click', onClose));
    window.removeEventListener('keydown', onKey);
  });

  const tl = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() });
  if (opts.animate === false) {
    gsap.set(backdrop, { opacity: 1 });
    gsap.set(scroller, { y: 0 });
  } else {
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: dur.base, ease: ease.ui }, 0)
      .fromTo(scroller, { y: '105%' }, { y: 0, duration: dur.overlayIn, ease: ease.out }, 0);
    if (!reduced) {
      const meta = article.querySelector<HTMLElement>('.case-meta');
      const titleWords = splitWords(article.querySelector<HTMLElement>('.case-title')!);
      const headWords = Array.from(article.querySelectorAll<HTMLElement>('.case-meta, .case-link')).flatMap(splitWords);
      gsap.set([...titleWords, ...headWords], { yPercent: 110 });
      if (meta) gsap.set(meta, { opacity: 0 }); // its "·" separators are pseudo-elements, so the row fades in with the words
      tl.to(titleWords, rise(titleWords), 0.25)
        .to(headWords, rise(headWords), 0.35)
        .to(meta ?? [], { opacity: 1, duration: dur.base, ease: ease.ui }, 0.35);
      wireText(article, scroller);
    }
  }
  wire(article, scroller);
  wireVideos(slot, scroller);
  document.title = `${article.dataset.title} — Dim`;
  setTimeout(() => scroller.querySelector<HTMLElement>('.case-close')?.focus({ preventScroll: true, focusVisible: false } as FocusOptions), 50);
}

export function closeCase(animate = true): Promise<void> {
  if (!isOpen) return Promise.resolve();
  isOpen = false;
  const L = layer();
  const scroller = L.querySelector<HTMLElement>('.case-scroller')!;
  const backdrop = L.querySelector<HTMLElement>('.case-backdrop')!;
  const slot = L.querySelector<HTMLElement>('.case-slot')!;
  return new Promise((resolve) => {
    const done = () => {
      triggers.forEach((t) => t.kill());
      triggers = [];
      cleanup.forEach((f) => f());
      cleanup = [];
      lenis?.destroy();
      lenis = null;
      slot.innerHTML = '';
      setBackgroundInert(false);
      L.classList.remove('is-open');
      L.setAttribute('aria-hidden', 'true');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
      resolve();
    };
    if (!animate) return done();
    gsap
      .timeline({ onComplete: done })
      .to(scroller, { y: '105%', duration: dur.overlayOut, ease: ease.inOut }, 0)
      .to(backdrop, { opacity: 0, duration: dur.overlayOut * 0.8, ease: ease.ui }, 0.1);
  });
}
