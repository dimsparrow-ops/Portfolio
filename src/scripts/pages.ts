import { gsap, ScrollTrigger, ease, dur, stagger, reduced } from './motion';

// hover-driven effects only make sense with a real pointer (taps fire pointerenter too)
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

type Destroy = () => void;

/** Wrap every word of `el` (keeping inline children like the grey name) in a clipped mask + inner span. */
function splitWords(el: HTMLElement): HTMLElement[] {
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

/** Services (leoleo.studio): big list, hovered line shifts, preview follows cursor. */
export function initServices(root: HTMLElement, entering: boolean): Destroy {
  const list = root.querySelector<HTMLElement>('[data-svc-list]')!;
  const desc = root.querySelector<HTMLElement>('[data-svc-desc]')!;
  const typed = desc.querySelector<HTMLElement>('[data-svc-typed]')!;
  const para = typed.parentElement!;
  const type = { n: 0 };
  let target = 0;
  // the paragraph height is tweened so a new line eases the box open instead of snapping
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
  // typed live on hover; the box grows line by line with the text
  const write = (full: string) => {
    gsap.killTweensOf(type);
    const text = full.replace(/\.$/, '');
    const put = () => {
      const n = Math.round(type.n);
      typed.textContent = text.slice(0, n);
      fit();
    };
    type.n = reduced ? text.length : 0;
    gsap.killTweensOf(para);
    para.style.height = 'auto';
    target = 0;
    put();
    if (reduced) return;
    // ~170 chars/s, far quicker than reading speed, capped so long texts stay snappy
    gsap.to(type, { n: text.length, duration: Math.min(text.length / 170, 1.1), ease: 'none', delay: 0.12, onUpdate: put, onComplete: settle });
  };
  const items = Array.from(list.querySelectorAll<HTMLElement>('.svc-item'));

  const xTo = gsap.quickTo(desc, 'x', { duration: dur.base, ease: ease.out });
  const yTo = gsap.quickTo(desc, 'y', { duration: dur.base, ease: ease.out });
  const rTo = gsap.quickTo(desc, 'rotation', { duration: 0.8, ease: ease.out });
  let lastX = 0;

  items.forEach((it) => (it.style.overflow = 'hidden'));
  const spans = items.map((it) => it.querySelector<HTMLElement>('span')!);
  if (entering) {
    gsap.from(spans, { yPercent: 110, duration: 0.8, ease: ease.out, stagger: stagger.item, delay: 0.15 });
  }

  const onMove = (e: PointerEvent) => {
    // follows the pointer, kept inside the viewport
    const w = desc.offsetWidth;
    const h = desc.offsetHeight;
    xTo(gsap.utils.clamp(16, window.innerWidth - w - 16, e.clientX + 24));
    yTo(gsap.utils.clamp(16, window.innerHeight - h - 96, e.clientY - 90));
    rTo(reduced ? 0 : gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
    lastX = e.clientX;
  };
  if (!finePointer()) return () => gsap.killTweensOf(spans);
  const offs = items.map((it, i) => {
    const span = spans[i];
    const enter = () => {
      if (it.classList.contains('is-hover')) return;
      list.classList.add('is-hovering');
      it.classList.add('is-hover');
      write(it.dataset.text ?? '');
      gsap.to(span, { x: 28, duration: dur.base, ease: ease.out });
      gsap.to(desc, { opacity: 1, scale: 1, duration: 0.45, ease: ease.out });
    };
    const leave = () => {
      it.classList.remove('is-hover');
      list.classList.remove('is-hovering');
      gsap.to(span, { x: 0, duration: dur.base, ease: ease.out });
      gsap.to(desc, { opacity: 0, scale: 0.6, duration: 0.3, ease: ease.ui });
    };
    // keyboard: focusing a line shows the same preview, parked next to it (no pointer to follow)
    const link = it.querySelector<HTMLElement>('a')!;
    const onFocus = () => {
      if (!link.matches(':focus-visible')) return;
      const r = span.getBoundingClientRect();
      const w = desc.offsetWidth;
      const h = desc.offsetHeight;
      xTo(gsap.utils.clamp(16, window.innerWidth - w - 16, r.right + 24));
      yTo(gsap.utils.clamp(16, window.innerHeight - h - 96, r.top - 24));
      enter();
    };
    it.addEventListener('pointerenter', enter);
    it.addEventListener('pointerleave', leave);
    link.addEventListener('focus', onFocus);
    link.addEventListener('blur', leave);
    return () => {
      it.removeEventListener('pointerenter', enter);
      it.removeEventListener('pointerleave', leave);
      link.removeEventListener('focus', onFocus);
      link.removeEventListener('blur', leave);
    };
  });
  window.addEventListener('pointermove', onMove);
  return () => {
    window.removeEventListener('pointermove', onMove);
    offs.forEach((f) => f());
    gsap.killTweensOf([desc, type, para, ...spans]);
  };
}

/** About: timeline reveals + "Say hi" uncovered from under the content, rubber letters. */
export function initAbout(root: HTMLElement): Destroy {
  const triggers: ScrollTrigger[] = [];
  const hi = root.querySelector<HTMLElement>('.hi')!;
  const word = root.querySelector<HTMLElement>('[data-hi]')!;
  const letters = Array.from(word.querySelectorAll<HTMLElement>('span:not(.sp)'));

  // fit the word to the viewport width (soscalemedia.se)
  let fitRaf = 0;
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
  // one measure per frame while resizing (each fit() forces layout)
  const onResize = () => {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(fit);
  };
  window.addEventListener('resize', onResize);

  // letters rise as the section is uncovered
  gsap.set(letters, { yPercent: 30, scaleY: 0.4 });
  let risen = false; // dock stays idle until the rise ends, so the two never fight over scale
  triggers.push(
    ScrollTrigger.create({
      trigger: hi,
      start: 'top 70%',
      once: true,
      onEnter: () =>
        // no overwrite: 'auto' here, it would kill the dock's quickTo tweens on the same letters
        gsap.to(letters, {
          yPercent: 0, scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)', stagger: 0.04,
          onComplete: () => (risen = true),
        }),
    }),
  );

  // dock magnification (macOS Dock): letters near the pointer grow taller
  const to = letters.map((l) => ({
    sy: gsap.quickTo(l, 'scaleY', { duration: 0.35, ease: 'power3' }),
    sx: gsap.quickTo(l, 'scaleX', { duration: 0.35, ease: 'power3' }),
  }));
  const onMove = (e: PointerEvent) => {
    if (!risen) return;
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
  const dock = finePointer() && !reduced;
  if (dock) {
    hi.addEventListener('pointermove', onMove);
    hi.addEventListener('pointerleave', onLeave);
  }

  const stopSparks = initSparks(root);
  const deck = initDeck(root);

  // one reveal language for the whole page (lorenzodossi.com): words rise out of their own masks.
  // Runs after initDeck, which rewrites the track text and would wipe the masks.
  if (!reduced) {
    // one timing for everything that appears here: intro, Listening to (divider, text, record), timeline
    const RISE = { dur: 1.1, ease: ease.words, span: 0.6 };
    const intro = root.querySelector<HTMLElement>('[data-words]')!;
    const iw = splitWords(intro);
    gsap.fromTo(iw, { yPercent: 110 }, { yPercent: 0, duration: RISE.dur, ease: RISE.ease, stagger: Math.min(stagger.word, 1.2 / iw.length), delay: 0.1 });
    // blocks below start as they scroll in; long paragraphs get a tighter stagger so they never drag
    const rise = (els: HTMLElement[], at: gsap.TweenTarget) => {
      const words = els.flatMap(splitWords);
      gsap.set(words, { yPercent: 110 });
      triggers.push(
        ScrollTrigger.create({
          trigger: at as Element,
          start: 'top 92%',
          once: true,
          onEnter: () =>
            gsap.to(words, { yPercent: 0, duration: RISE.dur, ease: RISE.ease, stagger: Math.min(stagger.word, RISE.span / words.length) }),
        }),
      );
    };
    const now = root.querySelector<HTMLElement>('.now');
    if (now) {
      // divider draws left to right, the sleeve is set down, then the record slides out of it already spinning
      const words = Array.from(now.querySelectorAll<HTMLElement>('.now-label, .track p')).flatMap(splitWords);
      const line = now.querySelector<HTMLElement>('.now-line')!;
      const deckEl = now.querySelector<HTMLElement>('.deck')!;
      const vinyl = now.querySelector<HTMLElement>('.vinyl')!;
      const slot = parseFloat(getComputedStyle(deckEl).getPropertyValue('--slot')) || 48;
      gsap.set(words, { yPercent: 110 });
      gsap.set(line, { scaleX: 0 });
      gsap.set(deckEl, { opacity: 0, y: 32, rotate: -5, transformOrigin: '0% 100%' });
      gsap.set(vinyl, { opacity: 0, x: -slot, rotate: -240 });
      triggers.push(
        ScrollTrigger.create({
          trigger: now,
          start: 'top 92%',
          once: true,
          onEnter: () => {
            const tl = gsap.timeline({ defaults: { ease: RISE.ease } });
            tl.to(line, { scaleX: 1, duration: RISE.dur }, 0)
              .to(words, { yPercent: 0, duration: RISE.dur, stagger: Math.min(stagger.word, RISE.span / words.length) }, 0.1)
              .to(deckEl, { opacity: 1, y: 0, rotate: 0, duration: RISE.dur }, 0.1)
              .set(vinyl, { opacity: 1 }, 0.5) // still hidden under the sleeve here
              .to(vinyl, { x: 0, rotate: 0, duration: RISE.dur + 0.3 }, 0.5)
              .add(deck.burst, 0.5)
              .add(() => gsap.set([deckEl, vinyl], { clearProps: 'transform,opacity' })); // hover/pulled transforms are CSS
          },
        }),
      );
    }
    root.querySelectorAll<HTMLElement>('.tl-item').forEach((li) => {
      rise(Array.from(li.querySelectorAll<HTMLElement>('.tl-when, .tl-company, .tl-role, p')), li);
    });
  }

  // only while SUMMON ME is uncovered, the nav's Say hi key becomes "email me" (mailto)
  const key = document.querySelector<HTMLAnchorElement>('.nav .sayhi-btn');
  const label = key?.querySelector<HTMLElement>('.sayhi-label');
  const mail = root.querySelector<HTMLAnchorElement>('.hi-links a[href^="mailto:"]')?.href;
  const sayHi = { text: 'Say hi', href: '/about/#say-hi' };
  const setKey = (email: boolean) => {
    if (!key || !label || !mail) return;
    const text = email ? 'email me' : sayHi.text;
    if ((key.dataset.mode ?? 'hi') === (email ? 'email' : 'hi')) return;
    key.dataset.mode = email ? 'email' : 'hi';
    if (email) {
      key.href = mail;
      key.removeAttribute('data-route');
      key.title = 'Email me (Enter)';
    } else {
      key.setAttribute('href', sayHi.href);
      key.setAttribute('data-route', '');
      key.title = 'Say hi (Enter)';
    }
    if (reduced) {
      label.textContent = text;
      return;
    }
    gsap.killTweensOf(label);
    gsap.to(label, {
      opacity: 0, y: -6, duration: 0.15, ease: ease.in,
      onComplete: () => {
        label.textContent = text;
        gsap.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: ease.out });
      },
    });
  };
  const content = root.querySelector<HTMLElement>('.about-content');
  const onScroll = () => {
    if (content) setKey(content.getBoundingClientRect().bottom < window.innerHeight * 0.6);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return () => {
    stopSparks();
    deck.stop();
    window.removeEventListener('scroll', onScroll);
    if (label) gsap.killTweensOf(label);
    if (key && label && key.dataset.mode === 'email') {
      key.dataset.mode = 'hi';
      // leaving About while it reads "email me": put Say hi back at once
      label.textContent = sayHi.text;
      label.style.opacity = '';
      label.style.transform = '';
      key.setAttribute('href', sayHi.href);
      key.setAttribute('data-route', '');
      key.title = 'Say hi (Enter)';
    }
    triggers.forEach((t) => t.kill());
    hi.removeEventListener('pointermove', onMove);
    hi.removeEventListener('pointerleave', onLeave);
    cancelAnimationFrame(fitRaf);
    window.removeEventListener('resize', onResize);
    gsap.killTweensOf(letters);
    gsap.killTweensOf(items);
  };
}

/** "Listening to" deck (chrisandrews.xyz): the record turns slowly, faster on hover, faster still once the sleeve is pulled (click). */
function initDeck(root: HTMLElement): { stop: Destroy; burst: () => void } {
  const deck = root.querySelector<HTMLButtonElement>('[data-deck]');
  const disc = root.querySelector<HTMLElement>('[data-vinyl]');
  if (!deck || !disc) return { stop: () => {}, burst: () => {} };

  // a random record per visit, never the same one twice in a row
  const now = deck.closest<HTMLElement>('.now')!;
  try {
    const records: { artist: string; track: string; meta: string; sleeve: string; vinyl?: string; disc?: string; label?: string }[] = JSON.parse(now.dataset.records || '[]');
    if (records.length) {
      let last = -1;
      try { last = Number(sessionStorage.getItem('np-last') ?? -1); } catch {}
      const pool = records.map((_, i) => i).filter((i) => i !== last);
      const i = (pool.length ? pool : [0])[Math.floor(Math.random() * (pool.length || 1))];
      try { sessionStorage.setItem('np-last', String(i)); } catch {}
      const r = records[i];
      for (const k of ['artist', 'track', 'meta'] as const) now.querySelector(`[data-np="${k}"]`)!.textContent = r[k];
      now.querySelector<HTMLImageElement>('[data-np="sleeve"]')!.src = r.sleeve;
      disc.style.backgroundImage = r.vinyl ? `url(${r.vinyl})` : 'none';
      deck.style.setProperty('--disc', r.disc ?? '#121212');
      deck.style.setProperty('--label', r.label ?? '#3b0f2a');
    }
  } catch {}
  now.dataset.ready = '';

  let pulled = false;
  let hovered = false;
  // one 9s turn at rate 1; the rate is eased, so changing speed never jumps the angle
  const spin = reduced ? null : disc.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 9000, iterations: Infinity });
  const state = { rate: 1 };
  const setRate = (d = 0.8) =>
    spin && gsap.to(state, { rate: pulled ? 4.7 : hovered ? 2.8 : 1, duration: d, ease: ease.out, overwrite: true, onUpdate: () => (spin.playbackRate = state.rate) });
  // the record leaves the sleeve already spinning fast, then settles
  const burst = () => {
    if (!spin) return;
    state.rate = 6;
    spin.playbackRate = 6;
    setRate(2.4);
  };

  const onClick = () => {
    pulled = !pulled;
    deck.setAttribute('aria-pressed', String(pulled));
    setRate();
  };
  const onEnter = () => ((hovered = true), setRate());
  const onLeave = () => ((hovered = false), setRate());
  deck.addEventListener('click', onClick);
  const hover = finePointer();
  if (hover) {
    deck.addEventListener('pointerenter', onEnter);
    deck.addEventListener('pointerleave', onLeave);
  }
  const stop = () => {
    gsap.killTweensOf(state);
    spin?.cancel();
    deck.removeEventListener('click', onClick);
    if (hover) {
      deck.removeEventListener('pointerenter', onEnter);
      deck.removeEventListener('pointerleave', onLeave);
    }
  };
  return { stop, burst };
}

/** AI timeline item: the cursor turns into a trail of 4-point sparkles, each following with its own lag. */
function initSparks(root: HTMLElement): Destroy {
  const item = root.querySelector<HTMLElement>('[data-ai]');
  if (!item || !finePointer() || reduced) return () => {};

  const star = (id: number) =>
    `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="spk${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C8DF6"/><stop offset=".55" stop-color="#9B72F2"/><stop offset="1" stop-color="#F26D90"/></linearGradient></defs><path fill="url(#spk${id})" d="M12 0c.6 6.6 4.8 10.8 12 12-7.2 1.2-11.4 5.4-12 12-.6-6.6-4.8-10.8-12-12C7.2 10.8 11.4 6.6 12 0z"/></svg>`;
  // size (4px grid), offset from the pointer, follow lag (s), twinkle period (s)
  const cfg = [
    { s: 24, x: 0, y: 0, lag: 0.12, t: 1.4 },
    { s: 16, x: 20, y: -16, lag: 0.28, t: 1.1 },
    { s: 12, x: -20, y: 16, lag: 0.42, t: 1.7 },
    { s: 12, x: 24, y: 20, lag: 0.58, t: 1.3 },
    { s: 8, x: -16, y: -20, lag: 0.74, t: 0.9 },
  ];
  const wrap = document.createElement('div');
  wrap.className = 'sparks';
  wrap.setAttribute('aria-hidden', 'true');
  const els = cfg.map((c, i) => {
    const el = document.createElement('span');
    el.className = 'spark';
    el.style.width = el.style.height = `${c.s}px`;
    el.style.margin = `${-c.s / 2 + c.y}px 0 0 ${-c.s / 2 + c.x}px`;
    el.innerHTML = star(i);
    wrap.append(el);
    return el;
  });
  document.body.append(wrap);

  const to = els.map((el, i) => ({
    x: gsap.quickTo(el, 'x', { duration: cfg[i].lag + 0.3, ease: ease.out }),
    y: gsap.quickTo(el, 'y', { duration: cfg[i].lag + 0.3, ease: ease.out }),
  }));
  const twinkles = els.map((el, i) =>
    gsap.to(el, { rotation: 90, duration: cfg[i].t * 2, ease: 'none', repeat: -1, paused: true }),
  );
  const pulses = els.map((el, i) =>
    gsap.fromTo(el, { scale: 0.6 }, { scale: 1.1, duration: cfg[i].t, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true }),
  );

  let inside = false;
  const move = (e: PointerEvent) => {
    if (!inside) {
      // first frame inside: snap to the pointer so the trail doesn't fly in from the corner
      els.forEach((el) => gsap.set(el, { x: e.clientX, y: e.clientY }));
      inside = true;
      item.classList.add('is-spark');
      els.forEach((el, i) => {
        twinkles[i].play();
        pulses[i].play();
        gsap.to(el, { opacity: 1, duration: dur.base, ease: ease.out, delay: i * stagger.item, overwrite: 'auto' });
      });
    }
    to.forEach((t) => (t.x(e.clientX), t.y(e.clientY)));
  };
  const leave = () => {
    if (!inside) return;
    inside = false;
    item.classList.remove('is-spark');
    els.forEach((el, i) => {
      gsap.to(el, {
        opacity: 0, duration: dur.micro, ease: ease.ui, delay: i * 0.02, overwrite: 'auto',
        onComplete: () => (twinkles[i].pause(), pulses[i].pause()),
      });
    });
  };
  item.addEventListener('pointermove', move);
  item.addEventListener('pointerleave', leave);

  return () => {
    item.removeEventListener('pointermove', move);
    item.removeEventListener('pointerleave', leave);
    twinkles.forEach((t) => t.kill());
    pulses.forEach((t) => t.kill());
    gsap.killTweensOf(els);
    wrap.remove();
  };
}

/** Design Lab: the previous page hangs above as a "ceiling"; scrolling descends into the dark. */
export function initLab(root: HTMLElement, entering: boolean, onAscend: () => void): Destroy {
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

  // pull up at the very top to climb back to the page you came from
  const PULL = 260;
  let pull = 0;
  let done = false;
  let idle: number | undefined;
  const show = () => {
    const k = Math.min(pull / PULL, 1);
    gsap.to(ceiling, { y: k * 70, duration: 0.25, ease: ease.ui, overwrite: true });
  };
  const release = () => {
    pull = 0;
    gsap.to(ceiling, { y: 0, duration: 0.6, ease: reduced ? 'power2.out' : 'elastic.out(1, 0.6)', overwrite: true });
  };
  const add = (d: number) => {
    if (done) return;
    pull += d;
    show();
    clearTimeout(idle);
    if (pull >= PULL) {
      done = true;
      onAscend();
      return;
    }
    idle = window.setTimeout(release, 220);
  };
  const atTop = () => window.scrollY <= 2;
  // armed only after a pause at the top, so momentum from scrolling up doesn't eject you
  let armed = atTop();
  let lastWheel = 0;
  const onWheel = (e: WheelEvent) => {
    const now = performance.now();
    if (!atTop()) armed = false;
    else if (!armed && now - lastWheel > 280) armed = true;
    lastWheel = now;
    if (e.deltaY < 0 && armed) add(-e.deltaY);
    else if (e.deltaY > 0 && pull > 0) release();
  };
  let ty = 0;
  let tracking = false;
  const onTouchStart = (e: TouchEvent) => {
    tracking = atTop();
    ty = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    if (y > ty) add((y - ty) * 1.6);
    ty = y;
  };
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  return () => {
    triggers.forEach((t) => t.kill());
    clearTimeout(idle);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
  };
}
