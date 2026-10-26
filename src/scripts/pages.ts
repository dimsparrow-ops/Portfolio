import { gsap, ScrollTrigger, ease, dur, stagger } from './motion';

type Destroy = () => void;

/** Services (leoleo.studio): big list, hovered line shifts, preview follows cursor. */
export function initServices(root: HTMLElement, entering: boolean): Destroy {
  const list = root.querySelector<HTMLElement>('[data-svc-list]')!;
  const preview = root.querySelector<HTMLElement>('[data-svc-preview]')!;
  const ph = preview.querySelector<HTMLElement>('.ph')!;
  const items = Array.from(list.querySelectorAll<HTMLElement>('.svc-item'));
  const xTo = gsap.quickTo(preview, 'x', { duration: dur.base, ease: ease.out });
  const yTo = gsap.quickTo(preview, 'y', { duration: dur.base, ease: ease.out });
  const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.8, ease: ease.out });
  let lastX = 0;

  items.forEach((it) => (it.style.overflow = 'hidden'));
  const spans = items.map((it) => it.querySelector<HTMLElement>('span')!);
  if (entering) {
    gsap.from(spans, { yPercent: 110, duration: 0.8, ease: ease.out, stagger: stagger.item, delay: 0.15 });
    gsap.from(root.querySelectorAll('.svc-details li'), { opacity: 0, y: 8, duration: dur.base, ease: ease.out, stagger: 0.03, delay: 0.5 });
  }

  const onMove = (e: PointerEvent) => {
    xTo(e.clientX + 24);
    yTo(e.clientY - 90);
    rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
    lastX = e.clientX;
  };
  const offs = items.map((it, i) => {
    const span = spans[i];
    const enter = () => {
      list.classList.add('is-hovering');
      it.classList.add('is-hover');
      ph.style.setProperty('--h', it.dataset.hue ?? '220');
      ph.dataset.label = span.textContent ?? '';
      gsap.to(span, { x: 28, duration: dur.base, ease: ease.out });
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.45, ease: ease.out });
    };
    const leave = () => {
      it.classList.remove('is-hover');
      list.classList.remove('is-hovering');
      gsap.to(span, { x: 0, duration: dur.base, ease: ease.out });
      gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.3, ease: ease.ui });
    };
    it.addEventListener('pointerenter', enter);
    it.addEventListener('pointerleave', leave);
    return () => {
      it.removeEventListener('pointerenter', enter);
      it.removeEventListener('pointerleave', leave);
    };
  });
  window.addEventListener('pointermove', onMove);
  return () => {
    window.removeEventListener('pointermove', onMove);
    offs.forEach((f) => f());
    gsap.killTweensOf([preview, ...spans]);
  };
}

/** About: timeline reveals + "Say hi" uncovered from under the content, rubber letters. */
export function initAbout(root: HTMLElement): Destroy {
  const triggers: ScrollTrigger[] = [];
  const hi = root.querySelector<HTMLElement>('.hi')!;
  const word = root.querySelector<HTMLElement>('[data-hi]')!;
  const letters = Array.from(word.querySelectorAll<HTMLElement>('span:not(.sp)'));

  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.set(el, { y: 36, opacity: 0 });
    triggers.push(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 0.7, ease: ease.out }),
      }),
    );
  });

  // fit the word to the viewport width (soscalemedia.se)
  const fit = () => {
    word.style.fontSize = '30vw';
    const first = word.firstElementChild!.getBoundingClientRect();
    const last = word.lastElementChild!.getBoundingClientRect();
    const w = last.right - first.left;
    const target = window.innerWidth - 2 * parseFloat(getComputedStyle(hi).paddingLeft);
    word.style.fontSize = `${(30 * target) / w}vw`;
  };
  fit();
  document.fonts?.ready.then(fit);
  window.addEventListener('resize', fit);

  // letters rise as the section is uncovered
  gsap.set(letters, { yPercent: 30, scaleY: 0.4 });
  triggers.push(
    ScrollTrigger.create({
      trigger: hi,
      start: 'top 70%',
      onEnter: () =>
        gsap.to(letters, { yPercent: 0, scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)', stagger: 0.04, overwrite: 'auto' }),
    }),
  );

  // dock magnification (macOS Dock): letters near the pointer grow taller
  const to = letters.map((l) => ({
    sy: gsap.quickTo(l, 'scaleY', { duration: 0.35, ease: 'power3' }),
    sx: gsap.quickTo(l, 'scaleX', { duration: 0.35, ease: 'power3' }),
  }));
  const onMove = (e: PointerEvent) => {
    letters.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      const d = (e.clientX - (r.left + r.width / 2)) / (r.width * 1.4);
      const inf = Math.exp(-d * d);
      to[i].sy(1 + 0.4 * inf);
      to[i].sx(1 + 0.06 * inf);
    });
  };
  // return through the same quickTo tweens (overwriting them would kill the dock for good)
  const onLeave = () => to.forEach((t) => (t.sy(1), t.sx(1)));
  hi.addEventListener('pointermove', onMove);
  hi.addEventListener('pointerleave', onLeave);

  return () => {
    triggers.forEach((t) => t.kill());
    hi.removeEventListener('pointermove', onMove);
    hi.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', fit);
    gsap.killTweensOf(letters);
  };
}

/** Design Lab: the previous page hangs above as a "ceiling"; scrolling descends into the dark. */
export function initLab(root: HTMLElement, entering: boolean): Destroy {
  const triggers: ScrollTrigger[] = [];
  const ceiling = root.querySelector<HTMLElement>('[data-ceiling]')!;
  const inner = root.querySelector<HTMLElement>('[data-ceiling-inner]')!;
  const shade = root.querySelector<HTMLElement>('[data-ceiling-shade]')!;

  triggers.push(
    ScrollTrigger.create({
      trigger: ceiling,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      animation: gsap
        .timeline()
        .fromTo(inner, { yPercent: 0, scale: 1 }, { yPercent: -35, scale: 0.94, ease: 'none' }, 0)
        .fromTo(shade, { opacity: 0.4 }, { opacity: 1, ease: 'none' }, 0),
    }),
  );

  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-lab-item]'));
  gsap.set(items, { y: 50, opacity: 0 });
  triggers.push(
    ...ScrollTrigger.batch(items, {
      start: 'top 95%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.7, ease: ease.out, stagger: 0.04 }),
    }),
  );
  const head = root.querySelectorAll('.lab-head > *');
  if (entering) gsap.from(head, { y: 30, opacity: 0, duration: 0.7, ease: ease.out, stagger: stagger.item, delay: 0.3 });

  return () => triggers.forEach((t) => t.kill());
}
