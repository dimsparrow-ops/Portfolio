import Lenis from 'lenis';
import { gsap, ScrollTrigger, ease, dur } from './motion';
import { initWork, type WorkApi, type View, type Filter } from './work';
import { openCase, closeCase, caseIsOpen } from './case';
import { initServices, initAbout, initLab } from './pages';

/**
 * Router: keeps the shell (logo, Say hi, nav, controls) and swaps <main class="page">.
 * Pages slide sideways in nav order; Design Lab is the exception — the previous page
 * rises and stays above as a ceiling while the dark lab opens below.
 */
const ORDER = ['work', 'about', 'services', 'lab'] as const;
type PageId = (typeof ORDER)[number];

let lenis: Lenis;
let current: { id: PageId; el: HTMLElement; destroy: () => void } | null = null;
let work: WorkApi | null = null;
let busy = false;
let caseFromPush = false;

const store = {
  get view(): View { try { return (sessionStorage.getItem('view') as View) || 'showcase'; } catch { return 'showcase'; } },
  set view(v: View) { try { sessionStorage.setItem('view', v); } catch {} },
  get filter(): Filter { try { return (sessionStorage.getItem('filter') as Filter) || 'all'; } catch { return 'all'; } },
  set filter(f: Filter) { try { sessionStorage.setItem('filter', f); } catch {} },
};

// ---------- fetching ----------
const cache = new Map<string, Promise<Document>>();
const norm = (u: string) => {
  const url = new URL(u, location.href);
  let p = url.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  return p;
};
function load(path: string) {
  const key = norm(path);
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(key)
        .then((r) => r.text())
        .then((t) => new DOMParser().parseFromString(t, 'text/html'))
        .catch((e) => {
          cache.delete(key);
          throw e;
        }),
    );
  }
  return cache.get(key)!;
}
const caseSlug = (path: string) => norm(path).match(/^\/work\/([^/]+)\/$/)?.[1] ?? null;
const pageOf = (path: string): PageId => {
  const p = norm(path);
  if (p.startsWith('/services')) return 'services';
  if (p.startsWith('/about')) return 'about';
  if (p.startsWith('/lab')) return 'lab';
  return 'work';
};

// ---------- page modules ----------
function mount(id: PageId, el: HTMLElement, entering: boolean) {
  let destroy = () => {};
  if (id === 'work') {
    work = initWork(el, { view: store.view, filter: store.filter, onOpen: (slug) => go(`/work/${slug}/`) });
    destroy = () => {
      work?.destroy();
      work = null;
    };
  } else if (id === 'services') destroy = initServices(el, entering);
  else if (id === 'about') destroy = initAbout(el);
  else if (id === 'lab') destroy = initLab(el, entering);
  current = { id, el, destroy };
  document.body.dataset.page = id;
  ORDER.forEach((p) => document.body.classList.toggle(`is-${p}`, p === id));
  updateNav(id, entering);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

// ---------- nav indicator ----------
function updateNav(id: PageId, animate: boolean) {
  const nav = document.querySelector<HTMLElement>('.nav')!;
  const ind = nav.querySelector<HTMLElement>('.nav-indicator')!;
  const link = nav.querySelector<HTMLElement>(`[data-nav="${id}"]`)!;
  nav.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
  link.setAttribute('aria-current', 'page');
  const props = { x: link.offsetLeft, width: link.offsetWidth };
  if (animate) gsap.to(ind, { ...props, duration: 0.7, ease: ease.spring });
  else gsap.set(ind, props);
}

// ---------- transitions ----------
function slide(oldEl: HTMLElement, newEl: HTMLElement, dir: 1 | -1) {
  const y = window.scrollY;
  oldEl.classList.add('is-transit');
  oldEl.scrollTop = y;
  oldEl.style.zIndex = '1';
  newEl.classList.add('is-transit');
  newEl.style.zIndex = '2';
  document.getElementById('pages')!.appendChild(newEl);
  lenis.scrollTo(0, { immediate: true, force: true });
  return gsap
    .timeline()
    .fromTo(newEl, { xPercent: 100 * dir }, { xPercent: 0, duration: dur.page, ease: ease.inOut }, 0)
    .to(oldEl, { xPercent: -30 * dir, filter: 'brightness(0.72)', duration: dur.page, ease: ease.inOut }, 0)
    .add(() => {
      oldEl.remove();
      newEl.classList.remove('is-transit');
      gsap.set(newEl, { clearProps: 'transform,zIndex' });
    });
}

function descend(oldEl: HTMLElement, labEl: HTMLElement) {
  const y = window.scrollY;
  oldEl.classList.add('is-transit');
  oldEl.scrollTop = y;
  oldEl.style.zIndex = '2';
  labEl.classList.add('is-transit');
  labEl.style.zIndex = '1';
  document.getElementById('pages')!.appendChild(labEl);
  lenis.scrollTo(0, { immediate: true, force: true });
  const body = labEl.querySelector<HTMLElement>('.lab-body')!;
  const inner = labEl.querySelector<HTMLElement>('[data-ceiling-inner]')!;
  return gsap
    .timeline()
    .to(oldEl, { yPercent: -50, duration: dur.page, ease: ease.inOut }, 0)
    .fromTo(body, { y: 120 }, { y: 0, duration: dur.page * 1.1, ease: ease.out }, 0.15)
    .add(() => {
      // the old page becomes the ceiling (its lower half stays visible above the lab)
      oldEl.classList.remove('is-transit');
      gsap.set(oldEl, { clearProps: 'transform,zIndex' });
      oldEl.classList.add('is-ceiling');
      inner.innerHTML = '';
      inner.appendChild(oldEl);
      oldEl.scrollTop = y;
      labEl.classList.remove('is-transit');
      gsap.set(labEl, { clearProps: 'transform,zIndex' });
    });
}

async function go(href: string, push = true) {
  const url = new URL(href, location.href);
  const path = norm(url.pathname);
  const slug = caseSlug(path);
  const target = pageOf(path);
  if (busy) return;

  // case overlay over Work
  if (slug && current?.id === 'work') {
    if (caseIsOpen()) await closeCase(false);
    busy = true;
    const doc = await load(path);
    const html = doc.querySelector('.case-slot')?.innerHTML ?? '';
    if (push) history.pushState({ case: slug }, '', path);
    caseFromPush = push;
    work?.pause(true);
    lenis.stop();
    openCase({ html, onClose: () => back() });
    busy = false;
    return;
  }

  // closing a case back to Work
  if (!slug && target === 'work' && current?.id === 'work') {
    if (caseIsOpen()) {
      if (push) history.pushState({}, '', '/');
      await closeCase();
      document.title = 'Dim — Lead Product Designer';
      work?.pause(false);
      lenis.start();
    }
    return;
  }

  // same page: only handle the Say hi anchor
  if (target === current?.id && !slug) {
    if (url.hash === '#say-hi') scrollToHi(1.6);
    return;
  }

  busy = true;
  if (caseIsOpen()) {
    await closeCase();
    work?.pause(false);
    lenis.start();
  }
  const doc = await load(path);
  const fresh = doc.querySelector<HTMLElement>('main.page');
  if (!fresh || !current) {
    location.href = href;
    return;
  }
  const newEl = document.importNode(fresh, true);
  const oldEl = current.el;
  const from = current.id;
  current.destroy();
  if (push) history.pushState({}, '', path + url.hash);
  document.title = doc.title;

  const dir: 1 | -1 = ORDER.indexOf(target) > ORDER.indexOf(from) ? 1 : -1;
  ORDER.forEach((p) => document.body.classList.toggle(`is-${p}`, p === target));
  updateNav(target, true);
  const tl = target === 'lab' ? descend(oldEl, newEl) : slide(oldEl, newEl, dir);
  mount(target, newEl, true);
  if (target === 'work') work?.intro(0.35);
  await tl.then();
  ScrollTrigger.refresh();
  busy = false;

  if (slug) go(path, false);
  if (url.hash === '#say-hi') setTimeout(() => scrollToHi(1.8), 150);
}

function scrollToHi(duration: number) {
  lenis.resize();
  ScrollTrigger.refresh();
  lenis.scrollTo(document.documentElement.scrollHeight - window.innerHeight, { duration, force: true });
}

function back() {
  if (caseFromPush) history.back();
  else go('/', true);
}

// ---------- loader ----------
function runLoader(): Promise<void> {
  const html = document.documentElement;
  if (html.classList.contains('is-loaded')) return Promise.resolve();
  const loader = document.querySelector<HTMLElement>('.loader')!;
  const pct = loader.querySelector<HTMLElement>('.loader-pct')!;
  const bar = loader.querySelector<HTMLElement>('.loader-bar')!;
  const mark = loader.querySelector<HTMLElement>('.loader-mark')!;
  const meta = loader.querySelectorAll<HTMLElement>('.loader-meta > span');
  const ready = Promise.all([
    document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', r, { once: true })),
    document.fonts?.ready ?? Promise.resolve(),
  ]);
  const p = { v: 0 };
  return new Promise((resolve) => {
    const show = () => {
      pct.textContent = `${Math.round(p.v)}%`;
      bar.style.transform = `scaleX(${p.v / 100})`;
    };
    // count to 90 while loading, finish once everything is ready (min ~1.4s total)
    const first = gsap.to(p, { v: 90, duration: 0.8, ease: ease.inOut, onUpdate: show });
    Promise.all([ready, first.then()]).then(() => {
      gsap
        .timeline({ onComplete: () => html.classList.add('is-loaded') })
        .to(p, { v: 100, duration: 0.35, ease: ease.ui, onUpdate: show })
        .to(meta, { yPercent: -120, duration: 0.5, ease: ease.in, stagger: 0.05 }, '+=0.1')
        .to(mark, { scale: 0, rotateY: 180, duration: 0.6, ease: ease.inOut }, '<')
        .to(bar, { scaleY: 0, transformOrigin: 'bottom', duration: 0.3, ease: ease.ui }, '<')
        .fromTo(loader, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: ease.inOut }, '-=0.15')
        .add(() => resolve(), '-=0.75');
      try { sessionStorage.setItem('seen', '1'); } catch {}
    });
  });
}

// ---------- boot ----------
export function boot() {
  lenis = new Lenis({ lerp: 0.1 });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  history.scrollRestoration = 'manual';

  const el = document.querySelector<HTMLElement>('main.page')!;
  const id = (el.dataset.page as PageId) || 'work';
  const slug = caseSlug(location.pathname);
  const skipIntro = document.documentElement.classList.contains('skip-intro');
  if (id === 'work') lenis.stop();
  mount(id, el, false);
  if (slug) {
    work?.pause(true);
    lenis.stop();
  }

  runLoader().then(() => {
    if (id === 'work') work?.intro(skipIntro ? 0 : 0.1);
    if (id === 'work' && !slug) lenis.start();
    if (slug) {
      caseFromPush = false;
      openCase({ animate: true, onClose: () => back() });
    }
    if (location.hash === '#say-hi') setTimeout(() => scrollToHi(1.8), 300);
  });

  // links
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-route]');
    if (!a || a.target === '_blank') return;
    e.preventDefault();
    go(a.href);
  });
  // prefetch on intent
  document.addEventListener('pointerover', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-route], a.card');
    if (a) load(a.href).catch(() => {});
  });
  window.addEventListener('popstate', () => go(location.href, false));

  // work controls
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.view === store.view);
    b.addEventListener('click', () => {
      const v = b.dataset.view as View;
      store.view = v;
      document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('is-active', x === b));
      work?.setView(v);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.filter === store.filter);
    b.addEventListener('click', () => {
      const f = b.dataset.filter as Filter;
      store.filter = f;
      document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('is-active', x === b));
      work?.setFilter(f);
    });
  });

  window.addEventListener('resize', () => updateNav(current?.id ?? 'work', false));

  // the ↳ on the Say hi keycap is the Enter key: pressing Enter presses the button
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || caseIsOpen()) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && a.closest('a, button, input, textarea, select, [contenteditable]')) return;
    const key = document.querySelector<HTMLAnchorElement>('.nav .sayhi-btn');
    if (!key) return;
    e.preventDefault();
    key.classList.add('is-pressed');
    setTimeout(() => {
      key.classList.remove('is-pressed');
      go(key.href);
    }, 140);
  });
}
