import { notFound } from 'next/navigation';
import { ElementorDocument } from '../../../lib/elementor/render.jsx';
import { stories, singlePost } from '../../../lib/content.js';
import { renderCtx } from '../../../lib/render-ctx.jsx';

export function generateStaticParams() {
  return stories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const story = stories.find((s) => s.slug === slug);
  if (!story) return {};
  const description =
    story.seo.description || story.excerpt?.replace(/<[^>]+>/g, '').trim().slice(0, 200) || undefined;
  return {
    title: story.seo.title || story.title,
    description,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      title: story.seo.title || story.title,
      description,
      type: 'article',
      publishedTime: story.date,
      images: story.seo.ogImage || story.thumbnail ? [story.seo.ogImage || story.thumbnail] : undefined,
    },
  };
}

export default async function StoryPage({ params }) {
  const { slug } = await params;
  const index = stories.findIndex((s) => s.slug === slug);
  if (index === -1 || !singlePost) notFound();

  const post = stories[index];
  return (
    <div className={`elementor-page elementor-page-${post.id}`}>
      <ElementorDocument
        id={singlePost.id}
        tree={singlePost.tree}
        kind="single-post"
        ctx={renderCtx({
          post,
          siblings: { prev: stories[index - 1] || null, next: stories[index + 1] || null },
        })}
      />
    </div>
  );
}
