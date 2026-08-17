'use client';

// Runs the scripts belonging to third-party embeds kept from the original page
// (currently the Zoho Recruit job board on /careers).
//
// Order matters and is the whole reason this isn't <Script> tags: the embed's
// external library must finish loading before its inline initialiser runs.
//
// Only code that survived HtmlWidget's filter reaches here — the vendor
// libraries we replaced (jQuery, GSAP, SplitType) are dropped upstream.

import { useEffect, useRef } from 'react';

export default function ExternalScripts({ srcs = [], inline = [] }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode double-invoke guard
    done.current = true;

    let cancelled = false;
    const added = [];

    const loadSrc = (src) =>
      new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${CSS.escape(src)}"]`);
        if (existing) return resolve();
        const el = document.createElement('script');
        el.src = src;
        el.async = false;
        el.onload = resolve;
        el.onerror = () => resolve(); // a dead embed must not block the rest
        document.body.appendChild(el);
        added.push(el);
      });

    (async () => {
      for (const src of srcs) {
        if (cancelled) return;
        await loadSrc(src);
      }
      if (cancelled) return;
      for (const code of inline) {
        const el = document.createElement('script');
        el.textContent = code;
        document.body.appendChild(el);
        added.push(el);
      }
    })();

    return () => {
      cancelled = true;
      added.forEach((el) => el.remove());
    };
  }, [srcs, inline]);

  return null;
}
