// The context every Elementor tree render needs: the client components that
// stand in for the plugin widgets, plus the collections those widgets query.
//
// Kept in one place so a route can never accidentally render with half of it
// wired up (a missing `Carousel` silently drops the slider, for instance).

import NavMenu from '../components/NavMenu.jsx';
import Carousel from '../components/Carousel.jsx';
import OffCanvas from '../components/OffCanvas.jsx';
import LoopGrid from '../components/LoopGrid.jsx';
import TaxonomyFilter from '../components/TaxonomyFilter.jsx';
import ShareButton from '../components/ShareButton.jsx';
import { listings, stories, terms } from './content.js';

export function renderCtx(extra = {}) {
  return {
    NavMenu,
    Carousel,
    OffCanvas,
    LoopGrid,
    TaxonomyFilter,
    ShareButtons: (network, view) => <ShareButton key={network} network={network} view={view} />,
    listings,
    terms,
    loopItems: stories,
    filterBaseUrl: '/stories/',
    depth: 0,
    props: {},
    ...extra,
  };
}
