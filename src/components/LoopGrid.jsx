'use client';

// Replaces Elementor Pro's loop-grid widget, including its "load more +
// infinite scroll" pagination and the taxonomy filter that drives it.
//
// The whole collection is prerendered into the page (63 stories is small), so
// filtering and paging are instant and work without a round trip. The markup
// matches Elementor's — elementor-loop-container / elementor-grid /
// e-loop-item — so the generated grid CSS applies unchanged.

import { useEffect, useMemo, useRef, useState } from 'react';

export default function LoopGrid({
  id,
  perPage = 12,
  loadMoreLabel = 'Load More',
  noMoreLabel = 'No more posts to show',
  notFoundLabel = 'It seems we can’t find what you’re looking for.',
  // Each item is { id, terms, node } — `node` is already-rendered markup from
  // the server. A render *function* cannot cross the server/client boundary,
  // so the loop-item template is expanded before it gets here.
  items = [],
  infinite = true,
}) {
  const [filter, setFilter] = useState('__all');
  const [shown, setShown] = useState(perPage);
  const sentinelRef = useRef(null);

  // The taxonomy-filter widget is a sibling in the DOM, so it talks to us
  // through the same custom event Elementor uses to link the two by id.
  useEffect(() => {
    const onFilter = (e) => {
      if (e.detail?.target && e.detail.target !== id) return;
      setFilter(e.detail?.filter ?? '__all');
      setShown(perPage);
    };
    document.addEventListener('e-filter:change', onFilter);
    return () => document.removeEventListener('e-filter:change', onFilter);
  }, [id, perPage]);

  const filtered = useMemo(
    () =>
      filter === '__all'
        ? items
        : items.filter((it) => it.terms?.some((t) => t.slug === filter)),
    [items, filter]
  );

  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  // Infinite scroll, but only once the reader has actually scrolled.
  //
  // Without that gate a wide viewport shows the whole first page above the
  // fold, so the sentinel is immediately in view and the grid pages itself all
  // the way to the end on load — every story at once. Waiting for a real scroll
  // keeps the first paint at one page, with the button as the other way in.
  const [userScrolled, setUserScrolled] = useState(false);
  useEffect(() => {
    if (userScrolled) return;
    const onScroll = () => setUserScrolled(true);
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [userScrolled]);

  useEffect(() => {
    if (!infinite || !hasMore || !userScrolled) return;
    const el = sentinelRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + perPage);
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [infinite, hasMore, perPage, filtered.length, userScrolled]);

  if (!filtered.length) {
    return <div className="elementor-loop-container elementor-grid"><p>{notFoundLabel}</p></div>;
  }

  return (
    <>
      <div className="elementor-loop-container elementor-grid" role="list">
        {visible.map((item, i) => (
          <div
            key={item.id ?? i}
            role="listitem"
            className={`e-loop-item e-loop-item-${item.id}`}
            data-custom-edit-handle="1"
          >
            {item.node}
          </div>
        ))}
      </div>

      <div className="elementor-button-wrapper e-load-more-anchor" ref={sentinelRef}>
        {hasMore ? (
          <button
            type="button"
            className="elementor-button elementor-button-link elementor-size-sm e-load-more-spinner"
            onClick={() => setShown((n) => n + perPage)}
          >
            <span className="elementor-button-content-wrapper">
              <span className="elementor-button-text">{loadMoreLabel}</span>
            </span>
          </button>
        ) : (
          <p className="e-load-more-message">{noMoreLabel}</p>
        )}
      </div>
    </>
  );
}
