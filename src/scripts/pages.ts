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
    gsap.from(spans, { yPercent: 110, duration: 1.1, ease: ease.out, stagger: stagger.item, delay: 0.25 });
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
        onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: ease.out }),
      }),
    );
  });

  // letters rise as the section is uncovered
  gsap.set(letters, { yPercent: 40, scaleY: 0.7 });
  triggers.push(
    ScrollTrigger.create({
      trigger: hi,
      start: 'top 75%',
      onEnter: () =>
        gsap.to(letters, { yPercent: 0, scaleY: 1, duration: 1.4, ease: 'elastic.out(1, 0.45)', stagger: 0.06, overwrite: 'auto' }),
    }),
  );
  // slight parallax while the content slides away
  triggers.push(
    ScrollTrigger.create({
      trigger: hi,
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: true,
      animation: gsap.fromTo(word, { y: -140, scale: 0.92 }, { y: 0, scale: 1, ease: 'none' }),
    }),
  );

  // rubber interaction: letters stretch toward the pointer, spring back on leave
  const to = letters.map((l) => ({
    sx: gsap.quickTo(l, 'scaleX', { duration: 0.5, ease: 'power3' }),
    sy: gsap.quickTo(l, 'scaleY', { duration: 0.5, ease: 'power3' }),
    y: gsap.quickTo(l, 'y', { duration: 0.5, ease: 'power3' }),
  }));
  const onMove = (e: PointerEvent) => {
    letters.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const dist = Math.abs(e.clientX - cx);
      const inf = Math.max(0, 1 - dist / (r.width * 1.6));
      const up = e.clientY < r.top + r.height * 0.5 ? 1 : 0.4;
      to[i].sy(1 + 0.32 * inf * up);
      to[i].sx(1 - 0.1 * inf);
      to[i].y(-18 * inf * up);
    });
  };
  const onLeave = () => {
    gsap.to(letters, { scaleX: 1, scaleY: 1, y: 0, duration: 1.4, ease: 'elastic.out(1, 0.28)', overwrite: true });
  };
  const onClick = (e: MouseEvent) => {
    const l = (e.target as HTMLElement).closest<HTMLElement>('[data-hi] span');
    if (!l || l.classList.contains('sp')) return;
    gsap
      .timeline({ overwrite: true })
      .to(l, { scaleY: 0.62, scaleX: 1.22, y: 0, duration: 0.12, ease: 'power2.in' })
      .to(l, { scaleY: 1, scaleX: 1, duration: 1.3, ease: 'elastic.out(1, 0.25)' });
  };
  word.addEventListener('pointermove', onMove);
  word.addEventListener('pointerleave', onLeave);
  word.addEventListener('click', onClick);

  return () => {
    triggers.forEach((t) => t.kill());
    word.removeEventListener('pointermove', onMove);
    word.removeEventListener('pointerleave', onLeave);
    word.removeEventListener('click', onClick);
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
      onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1, ease: ease.out, stagger: 0.06 }),
    }),
  );
  const head = root.querySelectorAll('.lab-head > *');
  if (entering) gsap.from(head, { y: 30, opacity: 0, duration: 1, ease: ease.out, stagger: stagger.item, delay: 0.5 });

  return () => triggers.forEach((t) => t.kill());
}
