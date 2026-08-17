// Elementor layout tree -> React.
//
// The goal is byte-comparable markup with the live site, because the site's own
// generated CSS (src/styles/wp) is keyed on those exact classes and data-ids.
// Every shape here was read off the real rendered HTML in reference/html.

import { resolveSettings, isVisible, componentProps } from './props.js';
import { iconOf } from './svg.js';
import { components, templates, images } from '../content.js';
import HtmlWidget from '../../components/HtmlWidget.jsx';

const cx = (...parts) => parts.flat().filter(Boolean).join(' ');

/**
 * WordPress served resized variants with a srcset; the export only names the
 * originals. `content/images.json` (built from the live markup) restores the
 * variant set so we ship the same responsive images instead of full-size files.
 */
function imageVariants(url) {
  const entry = images[url];
  if (!entry) return { src: url };
  const rel = (r) => '/assets/' + r;
  return {
    src: entry.defaultRel ? rel(entry.defaultRel) : url,
    srcSet: entry.srcset?.length ? entry.srcset.map((s) => `${rel(s.rel)} ${s.w}w`).join(', ') : null,
    sizes: entry.sizes || (entry.width ? `(max-width: ${entry.width}px) 100vw, ${entry.width}px` : null),
    width: entry.width,
    height: entry.height,
  };
}

/** Elementor writes custom classes from the `_css_classes` setting. */
function customClasses(s) {
  return [s._css_classes, s.css_classes].filter(Boolean).join(' ').trim();
}

function widthClasses(s) {
  const out = [];
  if (s._element_width) out.push(`elementor-widget__width-${s._element_width}`);
  if (s._element_width_mobile) out.push(`elementor-widget-mobile__width-${s._element_width_mobile}`);
  if (s._element_width_tablet) out.push(`elementor-widget-tablet__width-${s._element_width_tablet}`);
  return out;
}

const jedvClass = (s) => (s.jedv_enabled === 'yes' ? 'jedv-enabled--yes' : null);

// Elementor's per-breakpoint visibility. The setting stores the class suffix
// itself — `hide_desktop: "hidden-desktop"` — which becomes
// `elementor-hidden-desktop`, and its own CSS hides that at the right width.
const HIDE_DEVICES = ['widescreen', 'desktop', 'laptop', 'tablet_extra', 'tablet', 'mobile_extra', 'mobile'];
const hiddenClasses = (s) =>
  HIDE_DEVICES.map((d) => s[`hide_${d}`])
    .filter(Boolean)
    .map((v) => (String(v).startsWith('hidden') ? `elementor-${v}` : null))
    .filter(Boolean);

const html = (v) => ({ __html: v == null ? '' : String(v) });

/** Elementor link setting: { url, is_external, nofollow } */
function linkAttrs(link) {
  if (!link) return null;
  let url = typeof link === 'string' ? link : link.url;
  if (!url) return null;
  // WordPress tolerates protocol-less externals ("maintain.com.au/"); rendered
  // as-is they resolve relative to our origin. Normalise the way WP does.
  if (/^[\w-]+(\.[\w-]+)+/.test(url) && !/^([a-z]+:|\/|#)/i.test(url)) url = `https://${url}`;
  const a = { href: url };
  if (typeof link === 'object') {
    if (link.is_external) a.target = '_blank';
    if (link.nofollow) a.rel = 'nofollow';
    if (link.is_external && link.nofollow) a.rel = 'nofollow noopener';
    else if (link.is_external) a.rel = 'noopener';
  }
  return a;
}

function Icon({ icon, className }) {
  const i = iconOf(icon);
  if (!i) return null;
  if (i.svg) return <span className={className} dangerouslySetInnerHTML={html(i.svg)} />;
  if (i.img) return <span className={className}><img src={i.img} alt="" /></span>;
  return <span className={className}><i className={i.className} aria-hidden="true" /></span>;
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const widgets = {
  heading(s) {
    const Tag = (s.header_size || 'h2').toLowerCase();
    const title = s.title ?? '';
    const link = linkAttrs(s.link);
    const cls = cx('elementor-heading-title', `elementor-size-${s.size || 'default'}`);
    // Elementor puts the anchor *inside* the title element, not around it.
    return link ? (
      <Tag className={cls}>
        <a {...link} dangerouslySetInnerHTML={html(title)} />
      </Tag>
    ) : (
      <Tag className={cls} dangerouslySetInnerHTML={html(title)} />
    );
  },

  'text-editor'(s) {
    return <div dangerouslySetInnerHTML={html(s.editor)} />;
  },

  image(s) {
    const img = s.image || {};
    if (!img.url) return null;
    const v = imageVariants(img.url);
    const size = s.image_size || 'large';
    const el = (
      <img
        src={v.src}
        {...(v.srcSet ? { srcSet: v.srcSet, sizes: v.sizes } : {})}
        {...(v.width ? { width: v.width, height: v.height } : {})}
        alt={img.alt || ''}
        className={cx(`attachment-${size}`, `size-${size}`, img.id ? `wp-image-${img.id}` : null)}
        loading="lazy"
        decoding="async"
      />
    );
    const link = linkAttrs(s.link_to === 'custom' ? s.link : null);
    return link ? <a {...link}>{el}</a> : el;
  },

  button(s) {
    const link = linkAttrs(s.link) || {};
    const icon = iconOf(s.selected_icon);
    const alignIcon = s.icon_align === 'row-reverse' || s.icon_align === 'right';
    const iconEl = icon ? (
      <span className="elementor-button-icon">
        {icon.svg ? (
          <span dangerouslySetInnerHTML={html(icon.svg)} />
        ) : icon.img ? (
          <img src={icon.img} alt="" />
        ) : (
          <i className={icon.className} aria-hidden="true" />
        )}
      </span>
    ) : null;

    return (
      <div className="elementor-button-wrapper">
        <a
          className={cx('elementor-button', link.href ? 'elementor-button-link' : null, `elementor-size-${s.size || 'sm'}`)}
          {...link}
          href={link.href || '#'}
        >
          <span className="elementor-button-content-wrapper">
            {!alignIcon && iconEl}
            <span className="elementor-button-text" dangerouslySetInnerHTML={html(s.text ?? '')} />
            {alignIcon && iconEl}
          </span>
        </a>
      </div>
    );
  },

  'icon-list'(s) {
    const items = s.icon_list || [];
    const inline = s.view === 'inline';
    return (
      <ul className={cx('elementor-icon-list-items', inline && 'elementor-inline-items')}>
        {items.map((it, i) => {
          const link = linkAttrs(it.link);
          const body = (
            <>
              <Icon icon={it.selected_icon} className="elementor-icon-list-icon" />
              <span className="elementor-icon-list-text" dangerouslySetInnerHTML={html(it.text ?? '')} />
            </>
          );
          return (
            <li key={it._id || i} className={cx('elementor-icon-list-item', inline && 'elementor-inline-item')}>
              {link ? <a {...link}>{body}</a> : body}
            </li>
          );
        })}
      </ul>
    );
  },

  'icon-box'(s) {
    const Title = (s.title_size || 'h3').toLowerCase();
    const link = linkAttrs(s.link);
    const icon = <Icon icon={s.selected_icon} className="elementor-icon" />;
    return (
      <div className="elementor-icon-box-wrapper">
        {icon && (
          <div className="elementor-icon-box-icon">
            {link ? <a className="elementor-icon" {...link}>{icon}</a> : icon}
          </div>
        )}
        <div className="elementor-icon-box-content">
          <Title className="elementor-icon-box-title">
            {link ? (
              <a {...link} dangerouslySetInnerHTML={html(s.title_text ?? '')} />
            ) : (
              <span dangerouslySetInnerHTML={html(s.title_text ?? '')} />
            )}
          </Title>
          {s.description_text ? (
            <p className="elementor-icon-box-description" dangerouslySetInnerHTML={html(s.description_text)} />
          ) : null}
        </div>
      </div>
    );
  },

  icon(s) {
    const link = linkAttrs(s.link);
    const i = iconOf(s.selected_icon);
    if (!i) return null;
    const inner = i.svg ? (
      <span dangerouslySetInnerHTML={html(i.svg)} />
    ) : i.img ? (
      <img src={i.img} alt="" />
    ) : (
      <i className={i.className} aria-hidden="true" />
    );
    return (
      <div className="elementor-icon-wrapper">
        {link ? (
          <a className="elementor-icon" {...link}>{inner}</a>
        ) : (
          <div className="elementor-icon">{inner}</div>
        )}
      </div>
    );
  },

  divider(s) {
    return (
      <div className="elementor-divider">
        <span className="elementor-divider-separator" />
      </div>
    );
  },

  html(s) {
    // Raw HTML blocks carry three things on this site: form shortcodes, vendor
    // <script> tags we've replaced, and genuine third-party embeds.
    // HtmlWidget sorts them out.
    return <HtmlWidget html={s.html} />;
  },

  spacer() {
    return <div className="elementor-spacer"><div className="elementor-spacer-inner" /></div>;
  },

  // --- theme widgets (single templates) ------------------------------------
  'theme-post-title'(s, ctx) {
    const Tag = (s.header_size || 'h1').toLowerCase();
    return <Tag className="elementor-heading-title elementor-size-default">{ctx.post?.title ?? ''}</Tag>;
  },
  'theme-post-excerpt'(s, ctx) {
    // `excerpt` is normally bound to a post-excerpt dynamic tag (already
    // resolved by this point); fall back to the post's own excerpt.
    return <div dangerouslySetInnerHTML={html(s.excerpt || ctx.post?.excerpt || '')} />;
  },
  'theme-post-content'(s, ctx) {
    return <div dangerouslySetInnerHTML={html(s.content || ctx.post?.html || '')} />;
  },
  'theme-post-featured-image'(s, ctx) {
    const url = ctx.post?.thumbnail;
    return url ? <img src={url} alt={ctx.post?.title || ''} className="attachment-full size-full" /> : null;
  },
  'post-info'(s, ctx) {
    // Driven by the widget's `icon_list` repeater: each row picks a meta type
    // (date, author, terms…) and optionally a custom icon.
    const post = ctx.post;
    const rows = s.icon_list?.length ? s.icon_list : [{ _id: 'date', type: 'date' }];
    const date = post?.date ? new Date(post.date.replace(' ', 'T') + 'Z') : null;

    const valueFor = (row) => {
      const type = row.type || 'date';
      if (type === 'date') {
        if (!date) return null;
        // Elementor's default is WordPress's "F j, Y".
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      if (type === 'time') return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
      if (type === 'terms') {
        const list = (post?.terms || []).map((t) => t.name);
        return list.length ? list.join(', ') : null;
      }
      if (type === 'custom') return row.custom_text || null;
      return null;
    };

    return (
      <ul className="elementor-inline-items elementor-icon-list-items elementor-post-info">
        {rows.map((row, i) => {
          const value = valueFor(row);
          if (!value) return null;
          const type = row.type || 'date';
          return (
            <li
              key={row._id || i}
              className={cx('elementor-icon-list-item', `elementor-repeater-item-${row._id || i}`, 'elementor-inline-item')}
              itemProp={type === 'date' ? 'datePublished' : undefined}
            >
              <Icon icon={row.selected_icon} className="elementor-icon-list-icon" />
              <span className={cx('elementor-icon-list-text', 'elementor-post-info__item', `elementor-post-info__item--type-${type}`)}>
                {value}
              </span>
            </li>
          );
        })}
      </ul>
    );
  },
  'post-navigation'(s, ctx) {
    const { prev, next } = ctx.siblings || {};
    return (
      <div className="elementor-post-navigation">
        <div className="elementor-post-navigation__prev elementor-post-navigation__link">
          {prev && <a href={prev.url}><span className="post-navigation__prev--label">Previous</span><span className="post-navigation__prev--title">{prev.title}</span></a>}
        </div>
        <div className="elementor-post-navigation__next elementor-post-navigation__link">
          {next && <a href={next.url}><span className="post-navigation__next--label">Next</span><span className="post-navigation__next--title">{next.title}</span></a>}
        </div>
      </div>
    );
  },
  'share-buttons'(s, ctx) {
    // Driven by the widget's `share_buttons` repeater. Elementor emits divs
    // with role="button" (it opens a share window in JS) rather than anchors,
    // and defaults an entry with no explicit network to Facebook.
    const rows = s.share_buttons?.length ? s.share_buttons : [{ button: 'facebook' }];
    const share = ctx.ShareButtons;
    // Elementor's `view` control defaults to icon-text, not icon.
    const view = s.view || 'icon-text';
    return share ? (
      <div className="elementor-grid" role="list">
        {rows.map((row, i) => (
          <div className="elementor-grid-item" role="listitem" key={row._id || i}>
            {share(row.button || 'facebook', view)}
          </div>
        ))}
      </div>
    ) : null;
  },
};

// ---------------------------------------------------------------------------
// Composite widgets: template include, JetEngine component, listing grid
// ---------------------------------------------------------------------------

function TemplateWidget({ settings, ctx }) {
  const id = String(settings.template_id ?? '');
  const tpl = templates[id];
  if (!tpl) return null;
  return (
    <div className="elementor-template">
      <div
        className={cx('elementor', `elementor-${id}`)}
        data-elementor-type={tpl.kind}
        data-elementor-id={id}
        data-elementor-post-type="elementor_library"
      >
        {/* A template is its own Elementor document: depth resets, so its top
            containers are `e-parent`. Its CSS is scoped to `.elementor-{id}`. */}
        <Tree nodes={tpl.tree} ctx={{ ...ctx, props: {}, depth: 0 }} />
      </div>
    </div>
  );
}

function ComponentWidget({ componentId, settings, ctx, uid }) {
  const comp = components[componentId];
  if (!comp) return null;
  const props = componentProps(comp, settings);
  return (
    <div
      className={cx(
        'elementor',
        `elementor-${componentId}`,
        `jet-listing-grid--${componentId}`,
        `jet-component-instance-${uid}`
      )}
    >
      <Tree nodes={comp.tree} ctx={{ ...ctx, props, depth: 0 }} />
    </div>
  );
}

function ListingGrid({ settings, ctx }) {
  const listingId = String(settings.lisitng_id ?? settings.listing_id ?? '');
  const listing = components[listingId];
  // Elementor's responsive controls inherit from the next breakpoint up when
  // left unset — an unset mobile column count means "same as tablet", not 1.
  const cols = settings.columns || 3;
  const colsT = settings.columns_tablet || settings.columns_tablet_extra || cols;
  const colsM = settings.columns_mobile || colsT;
  const equal = settings.equal_columns_height === 'yes';
  const carousel = settings.carousel_enabled === 'yes';

  // Which collection this grid shows is declared on the listing itself.
  // JetEngine's default page size is 6 when `posts_num` is unset; rows arrive
  // newest-first, matching WordPress's default ordering.
  let source = ctx.listings?.[listingId] || [];

  // `posts_not_in` is how the single-post template excludes the story you are
  // already reading from its "more stories" grid. It is bound to a post-id
  // dynamic tag, so by this point it holds a concrete id.
  const excluded = new Set();
  for (const q of settings.posts_query || []) {
    const v = q?.posts_not_in;
    if (v == null || v === '') continue;
    for (const part of String(v).split(',')) if (part.trim()) excluded.add(part.trim());
  }
  if (excluded.size) source = source.filter((r) => !excluded.has(String(r.id)));

  const limit = Number(settings.posts_num) || 6;
  const rows = source.slice(0, limit);

  const gridClassName = cx(
    'jet-listing-grid__items',
    `grid-col-desk-${cols}`,
    `grid-col-tablet-${colsT}`,
    `grid-col-mobile-${colsM}`,
    `jet-listing-grid--${listingId}`,
    equal && 'jet-equal-columns__wrapper',
    'grid-collapse-gap'
  );

  // The card is its own Elementor document. Without this wrapper the listing's
  // CSS — all scoped to `.elementor-{listingId}` — never matches, and the cards
  // render unstyled.
  const card = (row) =>
    listing ? (
      <div
        className={cx('elementor', `elementor-${listingId}`)}
        data-elementor-type="jet-listing-items"
        data-elementor-id={listingId}
        data-elementor-post-type="jet-engine"
      >
        <Tree nodes={listing.tree} ctx={{ ...ctx, post: row, props: {}, depth: 0 }} />
      </div>
    ) : null;

  if (carousel) {
    const Carousel = ctx.Carousel;
    return (
      <div className="jet-listing-grid jet-listing">
        {Carousel ? (
          <Carousel gridClassName={gridClassName}>
            {rows.map((row) => card(row))}
          </Carousel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="jet-listing-grid jet-listing">
      <div className={gridClassName}>
        {rows.map((row, i) => (
          <div
            className={cx('jet-listing-grid__item', `jet-listing-dynamic-post-${row.id}`, equal && 'jet-equal-columns')}
            key={row.id || i}
            data-post-id={row.id}
          >
            {card(row)}
          </div>
        ))}
        {rows.length === 0 && <div className="jet-listing-not-found">No data was found</div>}
      </div>
    </div>
  );
}

/** Elementor Pro loop-grid: repeats a `loop-item` template over a collection. */
function LoopGridWidget({ node, settings, ctx }) {
  const LoopGrid = ctx.LoopGrid;
  const tpl = templates[String(settings.template_id ?? '')];
  if (!LoopGrid || !tpl) return null;

  // Expand the loop-item template here, on the server: LoopGrid is a client
  // component and a render function cannot cross that boundary. The collection
  // is small enough (63 stories) that prerendering all of them keeps filtering
  // and "load more" instant with no round trip.
  const items = (ctx.loopItems ?? []).map((item) => ({
    id: item.id,
    slug: item.slug,
    terms: item.terms,
    node: (
      <div
        className={cx('elementor', `elementor-${tpl.id}`)}
        data-elementor-type="loop-item"
        data-elementor-id={tpl.id}
        data-elementor-post-type="elementor_library"
      >
        <Tree nodes={tpl.tree} ctx={{ ...ctx, post: item, props: {}, depth: 0 }} />
      </div>
    ),
  }));

  return (
    <LoopGrid
      id={node.id}
      perPage={Number(settings.posts_per_page) || 12}
      loadMoreLabel={settings.text || 'Load More'}
      noMoreLabel={settings.load_more_no_posts_custom_message || 'No more posts to show'}
      notFoundLabel={settings.nothing_found_message_text || 'Nothing found.'}
      infinite={String(settings.pagination_type || '').includes('infinite')}
      items={items}
    />
  );
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

function Container({ node, ctx }) {
  const s = resolveSettings(node.settings, ctx.props, ctx);
  if (!isVisible(s, ctx.props, ctx)) return null;

  const boxed = s.content_width !== 'full';
  const Tag = s.html_tag || 'div';
  // A container can be an <a> wrapping the whole card. Elementor tags those
  // `e-child` rather than `e-parent` regardless of nesting depth.
  const isAnchor = Tag === 'a';
  // Elementor containers are either flex or CSS grid; the layout classes and
  // the generated CSS both key off which one.
  const layout = s.container_type === 'grid' ? 'e-grid' : 'e-flex';
  const className = cx(
    'elementor-element',
    `elementor-element-${node.id}`,
    !boxed && 'e-con-full',
    customClasses(s),
    hiddenClasses(s),
    jedvClass(s),
    layout,
    boxed && 'e-con-boxed',
    'e-con',
    ctx.depth && !isAnchor ? 'e-child' : isAnchor ? 'e-child' : 'e-parent'
  );

  // A container's background can be bound to a dynamic tag — that is how the
  // story cards get their photo. JetEngine emits a per-item <style> rule for
  // this; an inline style is equivalent and wins over the generated CSS the
  // same way. Size/position/repeat still come from that generated CSS.
  const bgUrl = s.background_background === 'classic' ? s.background_image?.url : null;
  const style = bgUrl ? { backgroundImage: `url("${bgUrl}")` } : undefined;

  const link = linkAttrs(s.link);
  // Nested anchors are invalid HTML and break hydration. When the container
  // itself is the link, descendants render their plain (unlinked) form — the
  // whole card is already clickable.
  const kids = (
    <Tree
      nodes={node.elements}
      ctx={{ ...ctx, depth: (ctx.depth || 0) + 1, insideAnchor: ctx.insideAnchor || isAnchor }}
    />
  );

  return (
    <Tag
      className={className}
      data-id={node.id}
      data-element_type="container"
      data-e-type="container"
      {...(style ? { style } : {})}
      {...(s._element_id ? { id: s._element_id } : {})}
      {...(link ? (isAnchor ? { href: link.href, ...(link.target ? { target: link.target } : {}), ...(link.rel ? { rel: link.rel } : {}) } : { 'data-link': link.href }) : {})}
    >
      {boxed ? <div className="e-con-inner">{kids}</div> : kids}
    </Tag>
  );
}

// The setting that carries a widget's visible content. When that setting is
// bound to a dynamic tag and the tag resolves to nothing, JetEngine drops the
// widget entirely rather than emitting an empty shell — so we do too.
const CONTENT_KEY = {
  heading: 'title',
  'text-editor': 'editor',
  image: 'image',
  button: 'text',
  'icon-box': 'title_text',
  icon: 'selected_icon',
};

function rendersNothing(type, node, resolved) {
  const key = CONTENT_KEY[type];
  if (!key) return false;
  // Only applies when the content was dynamic and the tag came back empty.
  // A statically empty widget is authored intent, and Elementor renders it.
  if (!node.settings?.__dynamic__?.[key]) return false;
  return resolved.__dynamicEmpty__?.includes(key) === true;
}

function Widget({ node, ctx }) {
  const type = node.widgetType || 'html';
  let s = resolveSettings(node.settings, ctx.props, ctx);
  if (!isVisible(s, ctx.props, ctx)) return null;
  if (rendersNothing(type, node, s)) return null;

  // Inside a link-container, drop per-widget links so we never emit <a> in <a>.
  if (ctx.insideAnchor && (s.link || s.link_to)) {
    const { link, link_to, ...rest } = s;
    s = rest;
  }

  const extra = [];
  if (type === 'icon-list') {
    extra.push(`elementor-icon-list--layout-${s.view === 'inline' ? 'inline' : 'traditional'}`);
    extra.push('elementor-list-item-link-full_width');
  }
  if (type === 'icon') extra.push(`elementor-view-${s.view || 'default'}`);
  if (type === 'icon-box') {
    extra.push(`elementor-view-${s.view || 'default'}`);
    if (s.shape) extra.push(`elementor-shape-${s.shape}`);
    extra.push('elementor-position-block-start');
  }
  if (type === 'nav-menu') extra.push(`elementor-nav-menu--dropdown-${s.dropdown || 'none'}`);
  if (type === 'loop-grid') {
    // The grid's column count lives in these classes, not in the widget CSS.
    // Without them every card stacks into a single column.
    extra.push(`elementor-grid-${s.columns || 3}`);
    extra.push(`elementor-grid-tablet-${s.columns_tablet || 2}`);
    extra.push(`elementor-grid-mobile-${s.columns_mobile || 1}`);
  }
  if (type === 'share-buttons') {
    extra.push(`elementor-share-buttons--view-${s.view || 'icon-text'}`);
    extra.push(`elementor-share-buttons--skin-${s.skin || 'flat'}`);
    extra.push(`elementor-share-buttons--color-${s.color_source || 'official'}`);
    extra.push(`elementor-share-buttons--shape-${s.shape || 'square'}`);
    extra.push(`elementor-grid-${s.columns || 0}`);
    if (s.columns_mobile !== undefined) extra.push(`elementor-grid-mobile-${s.columns_mobile}`);
  }

  const className = cx(
    'elementor-element',
    `elementor-element-${node.id}`,
    widthClasses(s),
    customClasses(s),
    hiddenClasses(s),
    extra,
    jedvClass(s),
    'elementor-widget',
    `elementor-widget-${type}`
  );

  let body = null;
  const compMatch = type.match(/^jet-engine-component-(\d+)$/);
  if (compMatch) {
    body = <ComponentWidget componentId={compMatch[1]} settings={s} ctx={ctx} uid={node.id} />;
  } else if (type === 'template') {
    body = <TemplateWidget settings={s} ctx={ctx} />;
  } else if (type === 'jet-listing-grid') {
    body = <ListingGrid settings={s} ctx={ctx} />;
  } else if (type === 'loop-grid') {
    body = <LoopGridWidget node={node} settings={s} ctx={ctx} />;
  } else if (type === 'taxonomy-filter') {
    const TaxonomyFilter = ctx.TaxonomyFilter;
    body = TaxonomyFilter ? (
      <TaxonomyFilter settings={s} terms={ctx.terms || []} baseUrl={ctx.filterBaseUrl || '/'} />
    ) : null;
  } else if (type === 'off-canvas') {
    const OffCanvas = ctx.OffCanvas;
    body = OffCanvas ? (
      <OffCanvas id={node.id} settings={s}>
        <Tree nodes={node.elements} ctx={{ ...ctx, depth: 0 }} />
      </OffCanvas>
    ) : null;
  } else if (type === 'nav-menu') {
    const NavMenu = ctx.NavMenu;
    body = NavMenu ? <NavMenu settings={s} id={node.id} /> : null;
  } else if (widgets[type]) {
    body = widgets[type](s, ctx);
  } else if (process.env.NODE_ENV !== 'production') {
    body = <div data-unimplemented-widget={type} />;
  }

  // Widgets whose content is entirely absent (an icon widget with no icon
  // chosen, say) are omitted by Elementor rather than emitted as an empty
  // shell. Composite widgets manage their own emptiness, so exclude them.
  const COMPOSITE = ['template', 'jet-listing-grid', 'loop-grid', 'taxonomy-filter', 'off-canvas', 'nav-menu', 'html'];
  if (body == null && !COMPOSITE.includes(type) && !compMatch) return null;

  return (
    <div
      className={className}
      data-id={node.id}
      data-element_type="widget"
      data-e-type="widget"
      data-widget_type={`${type}.${s._skin || 'default'}`}
      {...(s._element_id ? { id: s._element_id } : {})}
    >
      <div className="elementor-widget-container">{body}</div>
    </div>
  );
}

export function Tree({ nodes, ctx = {} }) {
  if (!Array.isArray(nodes)) return null;
  return nodes.map((node) =>
    node.elType === 'widget' ? (
      <Widget key={node.id} node={node} ctx={ctx} />
    ) : (
      <Container key={node.id} node={node} ctx={ctx} />
    )
  );
}

/** Top-level document wrapper: matches `<div class="elementor elementor-{id}">`. */
export function ElementorDocument({ id, tree, kind = 'wp-page', ctx = {}, className }) {
  return (
    <div
      className={cx('elementor', `elementor-${id}`, className)}
      data-elementor-type={kind}
      data-elementor-id={id}
      data-elementor-post-type={kind === 'wp-page' ? 'page' : 'elementor_library'}
    >
      <Tree nodes={tree} ctx={{ depth: 0, props: {}, ...ctx }} />
    </div>
  );
}
