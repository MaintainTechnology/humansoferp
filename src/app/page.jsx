import { notFound } from 'next/navigation';
import { ElementorDocument } from '../lib/elementor/render.jsx';
import { pageBySlug } from '../lib/content.js';
import { renderCtx } from '../lib/render-ctx.jsx';

const home = pageBySlug('home');

export const metadata = {
  title: home?.seo.title || home?.title,
  description: home?.seo.description || undefined,
  alternates: { canonical: '/' },
};

export default function HomePage() {
  if (!home) notFound();
  return (
    <div className={`elementor-page elementor-page-${home.id}`}>
      <ElementorDocument
        id={home.id}
        tree={home.tree}
        kind="wp-page"
        ctx={renderCtx({ page: home })}
      />
    </div>
  );
}

