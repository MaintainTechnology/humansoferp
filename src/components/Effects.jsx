'use client';

// The behaviours the original site got from jQuery + Elementor Pro + GSAP,
// reimplemented with plain browser APIs. Replaces ~700 kB of vendor script.
//
//  1. sticky header       - Elementor Pro sticky ("elementor-sticky--effects")
//  2. side-menu popup     - Elementor Pro popup (elementor-141)
//  3. scroll reveal       - GSAP ScrollTrigger fade-ins
//  4. split-type headings - SplitType word animation on `.pretty` headings

import { useEffect } from 'react';

export default function Effects() {
  useEffect(() => {
    const cleanups = [];

    // --- 1. sticky header ---------------------------------------------------
    const sticky = document.querySelector('.elementor-location-header .header');
    if (sticky) {
      const offset = 100;
      const onScroll = () => {
        sticky.classList.toggle('elementor-sticky--effects', window.scrollY > offset);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    // --- 2. popup / off-canvas triggers -------------------------------------
    // Elementor encodes these as `#elementor-action:action=popup:open&settings=<b64>`.
    // One delegated handler covers every trigger on the page, including ones
    // rendered inside the panels themselves.
    const popup = document.querySelector('.elementor-location-popup');

    const setPopup = (isOpen) => {
      if (!popup) return;
      popup.classList.toggle('is-open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    const setOffCanvas = (id, isOpen) => {
      const el = id
        ? document.getElementById(`off-canvas-${id}`)
        : document.querySelector('.e-off-canvas');
      if (!el) return;
      el.classList.toggle('is-open', isOpen);
      el.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (isOpen) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    const onActionClick = (e) => {
      const a = e.target.closest?.('a[href^="#elementor-action"]');
      if (!a) return;
      const href = decodeURIComponent(a.getAttribute('href') || '');
      const m = href.match(/action=([a-z_]+):([a-z]+)/i);
      if (!m) return;
      e.preventDefault();

      const [, kind, mode] = m;
      let settings = {};
      const sm = href.match(/settings=([A-Za-z0-9+/=]+)/);
      if (sm) { try { settings = JSON.parse(atob(sm[1])); } catch { /* leave empty */ } }

      if (kind === 'popup') setPopup(mode !== 'close');
      else if (kind === 'off_canvas') setOffCanvas(settings.id, mode !== 'close');
    };

    document.addEventListener('click', onActionClick);
    cleanups.push(() => document.removeEventListener('click', onActionClick));

    if (popup) {
      // Navigating away from inside the panel should dismiss it.
      const closers = popup.querySelectorAll('a[href^="/"], a[href^="http"]');
      closers.forEach((c) => {
        const h = () => setPopup(false);
        c.addEventListener('click', h);
        cleanups.push(() => c.removeEventListener('click', h));
      });

      const onKey = (e) => { if (e.key === 'Escape') { setPopup(false); setOffCanvas(null, false); } };
      document.addEventListener('keydown', onKey);
      cleanups.push(() => document.removeEventListener('keydown', onKey));
    }

    // --- 3. word-split reveal on [text-split] -------------------------------
    // Mirrors the original SplitType + ScrollTrigger snippet. Only [text-split]
    // is animated; `.pretty` is an unstyled marker class and must be left alone.
    const targets = document.querySelectorAll('[text-split]');

    targets.forEach((el) => {
      if (el.dataset.split) return;
      el.dataset.split = '';
      // Wrap top-level text nodes word-by-word, leaving inline markup intact.
      [...el.childNodes].forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        for (const chunk of node.textContent.split(/(\s+)/)) {
          if (!chunk) continue;
          if (!chunk.trim()) { frag.appendChild(document.createTextNode(chunk)); continue; }
          const w = document.createElement('span');
          w.className = 'word';
          w.textContent = chunk;
          frag.appendChild(w);
        }
        node.replaceWith(frag);
      });
    });

    const reveal = (el) => el.classList.add('is-revealed');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (targets.length && 'IntersectionObserver' in window && !reducedMotion) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            reveal(e.target);
            io.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
      );
      targets.forEach((t) => io.observe(t));
      cleanups.push(() => io.disconnect());
    } else {
      targets.forEach(reveal);
    }

    // --- 4. scroll reveal for content (fade-up, staggered per container) ----
    // The CSS only hides `.reveal` under `html.js`, so no-JS renders stay
    // visible. Anything inside the moving marquee is excluded — revealing
    // items on a track that is already animating reads as a glitch.
    const revealAll = [...document.querySelectorAll(
      [
        'main .elementor-widget-heading',
        'main .elementor-widget-text-editor',
        'main .elementor-widget-button',
        'main .elementor-widget-image',
        'main .elementor-widget-form',
        'main .elementor-widget-theme-post-content figure',
        'main .elementor-widget-theme-post-featured-image',
        'main .e-loop-item',
      ].join(',')
    )];
    const revealSet = new Set(revealAll);
    const revealTargets = revealAll.filter((el) => {
      if (el.closest('.jet-listing-grid__slider')) return false;
      for (let p = el.parentElement; p; p = p.parentElement) if (revealSet.has(p)) return false;
      return true;
    });

    const perParent = new Map();
    revealTargets.forEach((el) => {
      const n = perParent.get(el.parentElement) || 0;
      perParent.set(el.parentElement, n + 1);
      el.style.setProperty('--reveal-delay', `${Math.min(n, 6) * 60}ms`);
      el.classList.add('reveal');
    });

    const show = (el) => el.classList.add('is-inview');
    if (revealTargets.length && 'IntersectionObserver' in window && !reducedMotion) {
      const io2 = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            show(e.target);
            io2.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
      );
      revealTargets.forEach((t) => io2.observe(t));
      cleanups.push(() => io2.disconnect());
    } else {
      revealTargets.forEach(show);
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
