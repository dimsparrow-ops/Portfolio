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

export const stagger = { char: 0.012, item: 0.04, card: 0.03, word: 0.05 };

/** Smoothing for things that follow input (avea / laurent). */
export const follow = { lerp: 0.11, lerpDrag: 0.16 };

export const reduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduced) gsap.globalTimeline.timeScale(6);

/** One reveal language (lorenzodossi.com): words rise out of their own masks. Same timing on About, Services and cases. */
export const RISE = { dur: 1.1, ease: ease.words, span: 0.6 };

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

/** Split an element's text into per-character spans for reveals. */
export function splitChars(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone) return Array.from(el.querySelectorAll<HTMLElement>('.ch'));
  const out: HTMLElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      const words = (node.textContent ?? '').split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        if (/^\s+$/.test(w)) {
          frag.appendChild(document.createTextNode(' '));
          continue;
        }
        const word = document.createElement('span');
        word.style.display = 'inline-block';
        word.style.whiteSpace = 'nowrap';
        for (const ch of w) {
          const wrap = document.createElement('span');
          wrap.style.display = 'inline-block';
          wrap.style.overflow = 'hidden';
          wrap.style.verticalAlign = 'top';
          wrap.style.paddingBottom = '0.08em';
          wrap.style.marginBottom = '-0.08em';
          const inner = document.createElement('span');
          inner.className = 'ch';
          inner.style.display = 'inline-block';
          inner.textContent = ch;
          wrap.appendChild(inner);
          word.appendChild(wrap);
          out.push(inner);
        }
        frag.appendChild(word);
      }
      node.parentNode?.replaceChild(frag, node);
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  walk(el);
  el.dataset.splitDone = '1';
  el.setAttribute('aria-label', el.textContent ?? '');
  return out;
}

export { gsap, ScrollTrigger };
