import { ElementorDocument } from '../lib/elementor/render.jsx';
import { error404 } from '../lib/content.js';
import { renderCtx } from '../lib/render-ctx.jsx';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  if (!error404) {
    return (
      <div className="elementor-page" style={{ padding: '10rem 1.25rem', textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p><a href="/">Back to home</a></p>
      </div>
    );
  }
  return (
    <div className="elementor-page error404">
      <ElementorDocument id={error404.id} tree={error404.tree} kind="error-404" ctx={renderCtx()} />
    </div>
  );
}

