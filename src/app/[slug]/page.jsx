import { notFound } from 'next/navigation';
import { ElementorDocument } from '../../lib/elementor/render.jsx';
import { publishedPages, pageBySlug } from '../../lib/content.js';
import { renderCtx } from '../../lib/render-ctx.jsx';

export function generateStaticParams() {
  return publishedPages.filter((p) => p.slug !== 'home').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page) return {};
  return {
    title: page.seo.title || page.title,
    description: page.seo.description || undefined,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.seo.title || page.title,
      description: page.seo.description || undefined,
      images: page.seo.ogImage ? [page.seo.ogImage] : undefined,
    },
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page || page.status !== 'publish') notFound();

  return (
    <div className={`elementor-page elementor-page-${page.id}`}>
      <ElementorDocument
        id={page.id}
        tree={page.tree}
        kind="wp-page"
        ctx={renderCtx({ page })}
      />
    </div>
  );
}
