// Replaces Elementor Pro's nav-menu widget (which shipped jQuery SmartMenus).
// Markup matches the original so the existing CSS applies unchanged; the
// dropdown is CSS/keyboard driven instead of script driven.
import { nav } from '../lib/content.js';

const CHEVRON = (
  <svg aria-hidden="true" className="fa-svg-chevron-down e-font-icon-svg e-fas-chevron-down" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
    <path d="M207.029 381.476L12.686 187.132c-9.373-9.373-9.373-24.569 0-33.941l22.667-22.667c9.357-9.357 24.522-9.375 33.901-.04L224 284.505l154.745-154.021c9.379-9.335 24.544-9.317 33.901.04l22.667 22.667c9.373 9.373 9.373 24.569 0 33.941L240.971 381.476c-9.373 9.372-24.569 9.372-33.942 0z" />
  </svg>
);

function itemClasses(item, depth) {
  return [
    'menu-item',
    `menu-item-type-${item.objectType === 'custom' ? 'custom' : 'post_type'}`,
    `menu-item-object-${item.objectType || 'custom'}`,
    item.children?.length ? 'menu-item-has-children' : null,
    `menu-item-${item.id}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function Items({ items, depth = 0, menuId }) {
  return items.map((item) => (
    <li key={item.id} className={itemClasses(item, depth)}>
      <a
        href={item.url}
        className={depth === 0 ? 'elementor-item' : 'elementor-sub-item'}
        {...(item.url?.startsWith('http') && !item.url.includes('maintain.com.au')
          ? { target: '_blank', rel: 'noopener' }
          : {})}
      >
        {item.label}
        {item.children?.length ? <span className="sub-arrow">{CHEVRON}</span> : null}
      </a>
      {item.children?.length ? (
        <ul className="sub-menu elementor-nav-menu--dropdown">
          <Items items={item.children} depth={depth + 1} menuId={menuId} />
        </ul>
      ) : null}
    </li>
  ));
}

export default function NavMenu({ settings = {}, id = 'menu' }) {
  const layout = settings.layout || 'horizontal';
  return (
    <nav
      aria-label="Menu"
      className={`elementor-nav-menu--main elementor-nav-menu__container elementor-nav-menu--layout-${layout} e--pointer-none`}
    >
      <ul id={`menu-1-${id}`} className="elementor-nav-menu">
        <Items items={nav} menuId={id} />
      </ul>
    </nav>
  );
}
