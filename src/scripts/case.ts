import Lenis from 'lenis';
import { gsap, ScrollTrigger, ease, dur, stagger, splitChars } from './motion';

/**
 * Case overlay (leoleo.studio): the panel rises over Work, keeps its own URL.
 * Story column (thegradient.com): Input / Reasoning / Process / Outcomes open
 * as their media scrolls into view, and can also be toggled by click.
 */
const layer = () => document.querySelector<HTMLElement>('.case-layer')!;

let lenis: Lenis | null = null;
let triggers: ScrollTrigger[] = [];
let cleanup: (() => void)[] = [];
let isOpen = false;

export const caseIsOpen = () => isOpen;

function setAcc(item: HTMLElement, open: boolean, instant = false) {
  const panel = item.querySelector<HTMLElement>('.acc-panel')!;
  const btn = item.querySelector<HTMLElement>('.acc-btn')!;
  if (item.classList.contains('is-open') === open && !instant) return;
  item.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  gsap.killTweensOf(panel);
  if (instant) {
    gsap.set(panel, { height: open ? 'auto' : 0 });
    return;
  }
  gsap.to(panel, { height: open ? 'auto' : 0, duration: dur.base, ease: ease.ui });
  const ps = panel.querySelectorAll('p');
  if (open && ps.length) gsap.fromTo(ps, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: dur.base, ease: ease.out, delay: 0.08, stagger: 0.04 });
}

function wire(article: HTMLElement, scroller: HTMLElement) {
  const items = Array.from(article.querySelectorAll<HTMLElement>('.acc-item'));
  const openOnly = (key: string) => items.forEach((it) => setAcc(it, it.dataset.acc === key));

  items.forEach((it) => {
    const btn = it.querySelector<HTMLElement>('.acc-btn')!;
    const on = () => setAcc(it, !it.classList.contains('is-open'));
    btn.addEventListener('click', on);
    cleanup.push(() => btn.removeEventListener('click', on));
  });

  article.querySelectorAll<HTMLElement>('.media-group').forEach((g) => {
    triggers.push(
      ScrollTrigger.create({
        trigger: g,
        scroller,
        start: 'top 62%',
        end: 'bottom 62%',
        onEnter: () => openOnly(g.dataset.section!),
        onEnterBack: () => openOnly(g.dataset.section!),
      }),
    );
  });

  // media fade-up as it enters
  article.querySelectorAll<HTMLElement>('.media-group > *').forEach((m) => {
    gsap.set(m, { y: 40, opacity: 0 });
    triggers.push(
      ScrollTrigger.create({
        trigger: m,
        scroller,
        start: 'top 92%',
        once: true,
        onEnter: () => gsap.to(m, { y: 0, opacity: 1, duration: 0.7, ease: ease.out }),
      }),
    );
  });
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
  L.classList.add('is-open');
  L.setAttribute('aria-hidden', 'false');
  scroller.scrollTop = 0;

  lenis = new Lenis({ wrapper: scroller, content: slot, lerp: 0.1 });
  const raf = (t: number) => lenis?.raf(t * 1000);
  gsap.ticker.add(raf);
  lenis.on('scroll', ScrollTrigger.update);
  cleanup.push(() => gsap.ticker.remove(raf));

  const closeEls = L.querySelectorAll<HTMLElement>('[data-case-close]');
  const onClose = () => opts.onClose();
  closeEls.forEach((el) => el.addEventListener('click', onClose));
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && opts.onClose();
  window.addEventListener('keydown', onKey);
  cleanup.push(() => {
    closeEls.forEach((el) => el.removeEventListener('click', onClose));
    window.removeEventListener('keydown', onKey);
  });

  const title = article.querySelector<HTMLElement>('[data-split]');
  const chars = title ? splitChars(title) : [];
  const rest = article.querySelectorAll<HTMLElement>('.case-meta, .case-link, .metric');

  const tl = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() });
  if (opts.animate === false) {
    gsap.set(backdrop, { opacity: 1 });
    gsap.set(scroller, { y: 0 });
  } else {
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: dur.base, ease: ease.ui }, 0)
      .fromTo(scroller, { y: '105%' }, { y: 0, duration: dur.overlayIn, ease: ease.out }, 0)
      .from(chars, { yPercent: 105, duration: 0.65, ease: ease.out, stagger: stagger.char }, 0.2)
      .from(rest, { y: 18, opacity: 0, duration: 0.6, ease: ease.out, stagger: stagger.item }, 0.3);
  }
  wire(article, scroller);
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
      L.classList.remove('is-open');
      L.setAttribute('aria-hidden', 'true');
      resolve();
    };
    if (!animate) return done();
    gsap
      .timeline({ onComplete: done })
      .to(scroller, { y: '105%', duration: dur.overlayOut, ease: ease.inOut }, 0)
      .to(backdrop, { opacity: 0, duration: dur.overlayOut * 0.8, ease: ease.ui }, 0.1);
  });
}
