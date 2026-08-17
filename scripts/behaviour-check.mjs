// Behavioural parity: the interactive pieces that replaced plugin JS.
// Structural diffs cannot see any of this, so check it in a real browser.
//
//   node scripts/behaviour-check.mjs [origin]

import { chromium } from 'playwright';

const ORIGIN = process.argv[2] || 'http://localhost:3200';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// ---------------------------------------------------------------- home
console.log('\n=== home: story marquee');
await page.goto(ORIGIN + '/', { waitUntil: 'load' });
await page.waitForTimeout(1500);

const t0 = await page.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? { x: getComputedStyle(tr).transform, slides: tr.children.length, w: tr.style.width } : null;
});
check('slider DOM present (slick-track)', !!t0, t0 ? `${t0.slides} slides` : 'not found');
check('slides have images', await page.evaluate(() =>
  [...document.querySelectorAll('.jet-listing-grid__slider .slick-slide img')].filter((i) => i.currentSrc || i.src).length > 0
));

await page.waitForTimeout(2200);
const t1 = await page.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? getComputedStyle(tr).transform : null;
});
check('marquee is animating', !!t0 && t0.x !== t1, `${t0?.x} -> ${t1}`);

check('no broken images on home', await page.evaluate(() =>
  [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length === 0
), await page.evaluate(() =>
  [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')).slice(0, 3).join(', ')
));

// ---------------------------------------------------------------- side menu
// The mobile menu on this site is Elementor popup 76, opened from the header
// burger. (An off-canvas widget also exists in the header but nothing opens it
// — its only triggers are "close" actions pointing at a stale id. That is true
// of the live site too, so it is reproduced as-is rather than "fixed".)
console.log('\n=== header: side-menu popup');
check('popup document rendered', await page.evaluate(() => !!document.querySelector('.elementor-location-popup')));
check('off-canvas document rendered', await page.evaluate(() => !!document.querySelector('.e-off-canvas')));

const popupOpen = await page.evaluate(() => {
  const el = document.querySelector('.elementor-location-popup');
  const trigger = document.querySelector('a[href*="popup:open"]');
  trigger?.click();
  return new Promise((res) => setTimeout(() => res({
    hadTrigger: !!trigger, open: el?.classList.contains('is-open'), locked: document.body.style.overflow,
  }), 400));
});
check('burger opens the side menu', popupOpen.hadTrigger && popupOpen.open,
  `trigger=${popupOpen.hadTrigger} open=${popupOpen.open} scroll-lock=${popupOpen.locked}`);

const popupClosed = await page.evaluate(() => {
  const el = document.querySelector('.elementor-location-popup');
  document.querySelector('.elementor-location-popup a[href*="popup:close"]')?.click();
  return new Promise((res) => setTimeout(() => res(el?.classList.contains('is-open')), 400));
});
check('side menu closes from its close button', popupClosed === false);

// ---------------------------------------------------------------- stories
console.log('\n=== /stories: loop grid, filter, load more');
await page.goto(ORIGIN + '/stories', { waitUntil: 'load' });
await page.waitForTimeout(800);

const initial = await page.evaluate(() => document.querySelectorAll('.e-loop-item').length);
check('loop grid renders a first page', initial === 12, `${initial} items (expected 12)`);

const afterLoad = await page.evaluate(() => {
  document.querySelector('.e-load-more-anchor button')?.click();
  return new Promise((res) => setTimeout(() => res(document.querySelectorAll('.e-loop-item').length), 400));
});
check('"Load More" adds a page', afterLoad > initial, `${initial} -> ${afterLoad}`);

const filterInfo = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.e-filter-item')];
  const target = buttons.find((b) => b.dataset.filter && b.dataset.filter !== '__all');
  if (!target) return { ok: false };
  target.click();
  return new Promise((res) =>
    setTimeout(() => res({
      ok: true,
      term: target.dataset.filter,
      count: document.querySelectorAll('.e-loop-item').length,
      pressed: target.getAttribute('aria-pressed'),
    }), 400)
  );
});
check('taxonomy filter present', filterInfo.ok, `${await page.evaluate(() => document.querySelectorAll('.e-filter-item').length)} filter buttons`);
if (filterInfo.ok) {
  check('filtering narrows the grid', filterInfo.count > 0 && filterInfo.count < afterLoad,
    `"${filterInfo.term}" -> ${filterInfo.count} items`);
  check('filter marks itself pressed', filterInfo.pressed === 'true');
}

// ---------------------------------------------------------------- story page
console.log('\n=== story page: share buttons + related');
await page.goto(ORIGIN + '/stories/claire-singleton-on-choosing-curiosity-over-comfort', { waitUntil: 'load' });
await page.waitForTimeout(600);
check('share buttons render', await page.evaluate(() => document.querySelectorAll('.elementor-share-btn').length) === 7);
check('related grid excludes the current story', await page.evaluate(() =>
  !document.querySelector('.jet-listing-dynamic-post-947')
));

// ---------------------------------------------------------------- mobile
console.log('\n=== mobile (390px)');
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push('mobile: ' + e.message));
await mp.goto(ORIGIN + '/', { waitUntil: 'load' });
await mp.waitForTimeout(1500);
const m0 = await mp.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? getComputedStyle(tr).transform : null;
});
await mp.waitForTimeout(3600);
const m1 = await mp.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? getComputedStyle(tr).transform : null;
});
check('mobile carousel advances', !!m0 && m0 !== m1, `${m0} -> ${m1}`);
check('no horizontal overflow on mobile', await mp.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1
), await mp.evaluate(() => `scrollWidth ${document.documentElement.scrollWidth} vs ${window.innerWidth}`));

// ---------------------------------------------------------------- reduced motion
console.log('\n=== prefers-reduced-motion');
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const rp = await rm.newPage();
await rp.goto(ORIGIN + '/', { waitUntil: 'load' });
await rp.waitForTimeout(1200);
const r0 = await rp.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? getComputedStyle(tr).transform : null;
});
await rp.waitForTimeout(1800);
const r1 = await rp.evaluate(() => {
  const tr = document.querySelector('.jet-listing-grid__slider .slick-track');
  return tr ? getComputedStyle(tr).transform : null;
});
check('marquee holds still when motion is reduced', r0 === r1, `${r0} -> ${r1}`);

console.log('\n=== console/page errors:', errors.length);
errors.slice(0, 6).forEach((e) => console.log('   ' + e.slice(0, 160)));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
