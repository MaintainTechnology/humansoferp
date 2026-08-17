// The homepage story marquee.
//
// On the live site this is a JetEngine listing that Slick turns into a carousel
// — but the actual movement comes from CSS, not Slick:
//
//   #rtl_slide .slick-track { display:flex; animation: rtlSlide 150s linear infinite }
//   @keyframes rtlSlide { from { translateX(0) } to { translateX(-50%) } }
//
// A -50% translation loops seamlessly only if the track holds exactly two
// copies of the content, so that is what we render. (Slick's own cloning left
// the live track at an uneven count, which makes it visibly jump once per
// cycle; duplicating cleanly removes that without changing the look.)
//
// Because the animation is declarative, this needs no client JavaScript at all.

const cx = (...p) => p.filter(Boolean).join(' ');

export default function Carousel({ children, gridClassName }) {
  const slides = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (!slides.length) return null;

  // Slick sized slides with inline styles, and JetEngine's own grid rules are
  // specific enough to win against a stylesheet selector — so match Slick and
  // set the width inline. `--hoe-slide-count` is inherited from the track.
  const slideStyle = { width: 'calc(100% / var(--hoe-slide-count))', flex: '0 0 auto' };

  const run = (copy) =>
    slides.map((node, i) => (
      <div
        key={`${copy}-${i}`}
        className="jet-listing-grid__item jet-equal-columns slick-slide"
        style={slideStyle}
        // The second run is decorative: screen readers should read the set once.
        {...(copy === 1 ? { 'aria-hidden': 'true' } : {})}
        data-slick-index={copy * slides.length + i}
      >
        {node}
      </div>
    ));

  // Slick used to set slide/track widths inline from JS. Without it the flex
  // track would share the width between every slide, so publish the slide count
  // and let CSS size them against `--columns` (which Elementor's generated CSS
  // already sets per breakpoint). See the `.slick-track` rules in app.css.
  const total = slides.length * 2;

  return (
    <div className="jet-listing-grid__slider">
      <div className={cx(gridClassName, 'slick-initialized', 'slick-slider')}>
        <div className="slick-list draggable">
          <div
            className="slick-track"
            style={{
              '--hoe-slide-count': total,
              display: 'flex',
              width: `calc(${total} * 100% / var(--columns, 4))`,
            }}
          >
            {run(0)}
            {run(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
