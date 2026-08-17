'use client';

// Replaces Elementor Pro's off-canvas widget (which shipped its own JS).
// Markup matches the original — e-off-canvas / __overlay / __main / __content —
// so widget-off-canvas.min.css and the entrance animation apply unchanged.
//
// Opened by any element carrying an `#off-canvas-<id>` link or an
// `elementor-action` popup/off-canvas trigger, which is how the header buttons
// reference it.

import { useEffect, useId, useRef, useState } from 'react';

export default function OffCanvas({ id, settings = {}, children }) {
  const [open, setOpen] = useState(false);
  const asideRef = useRef(null);
  const domId = `off-canvas-${id}`;
  const labelId = useId();

  const preventScroll = settings.prevent_scroll === 'yes';
  const closeOnOverlay = settings.is_not_close_on_overlay !== 'yes';
  const closeOnEsc = settings.is_not_close_on_esc_overlay !== 'yes';

  useEffect(() => {
    const openIt = (e) => { e?.preventDefault?.(); setOpen(true); };

    // Anything that points at this off-canvas, in any of the forms Elementor
    // emits for triggers.
    const selector = [
      `a[href="#${domId}"]`,
      `[data-off-canvas="${id}"]`,
      `a[href*="off_canvas:open"][href*="${id}"]`,
      '.e-off-canvas-trigger',
      '.menu-toggle',
    ].join(',');

    const triggers = [...document.querySelectorAll(selector)];
    triggers.forEach((t) => t.addEventListener('click', openIt));

    const onKey = (e) => { if (e.key === 'Escape' && closeOnEsc) setOpen(false); };
    document.addEventListener('keydown', onKey);

    return () => {
      triggers.forEach((t) => t.removeEventListener('click', openIt));
      document.removeEventListener('keydown', onKey);
    };
  }, [domId, id, closeOnEsc]);

  useEffect(() => {
    if (!preventScroll) return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open, preventScroll]);

  // Move focus in on open so keyboard users are not left behind the overlay.
  useEffect(() => {
    if (!open) return;
    const first = asideRef.current?.querySelector('a[href], button, [tabindex]:not([tabindex="-1"])');
    first?.focus?.();
  }, [open]);

  // Close when a link inside navigates away.
  const onContentClick = (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && !a.getAttribute('href')?.startsWith('#')) setOpen(false);
  };

  return (
    <aside
      ref={asideRef}
      id={domId}
      className={`e-off-canvas${open ? ' is-open' : ''}`}
      role="dialog"
      aria-hidden={open ? 'false' : 'true'}
      aria-label={settings.off_canvas_name || 'Off-Canvas'}
      aria-modal="true"
      aria-labelledby={labelId}
      inert={!open}
      data-delay-child-handlers="true"
    >
      <div
        className="e-off-canvas__overlay"
        onClick={closeOnOverlay ? () => setOpen(false) : undefined}
      />
      <div className="e-off-canvas__main">
        <button
          type="button"
          className="e-off-canvas__close-button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="e-off-canvas__content" onClick={onContentClick}>
          {children}
        </div>
      </div>
    </aside>
  );
}
