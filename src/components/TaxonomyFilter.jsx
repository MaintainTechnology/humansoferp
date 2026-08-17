'use client';

// Replaces Elementor Pro's taxonomy-filter widget. Emits the same
// <search class="e-filter"> / <button class="e-filter-item"> markup, and
// notifies the loop-grid it targets (`selected_element`) via a custom event.

import { useState } from 'react';

export default function TaxonomyFilter({ settings = {}, terms = [], baseUrl = '/' }) {
  const [active, setActive] = useState('__all');
  const target = settings.selected_element;

  const pick = (slug) => {
    setActive(slug);
    document.dispatchEvent(
      new CustomEvent('e-filter:change', { detail: { filter: slug, target } })
    );
  };

  return (
    <search
      className={`e-filter${settings.horizontal_scroll === 'enable' ? ' e-filter--horizontal-scroll' : ''}`}
      role="search"
      data-base-url={baseUrl}
      data-page-num="1"
    >
      <button
        type="button"
        className="e-filter-item"
        data-filter="__all"
        aria-pressed={active === '__all'}
        onClick={() => pick('__all')}
      >
        {settings.first_item_title || 'All Posts'}
      </button>
      {terms.map((t) => (
        <button
          key={t.slug}
          type="button"
          className="e-filter-item"
          data-filter={t.slug}
          aria-pressed={active === t.slug}
          onClick={() => pick(t.slug)}
        >
          {t.name}
        </button>
      ))}
    </search>
  );
}
