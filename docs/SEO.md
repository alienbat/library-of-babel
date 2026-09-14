# Landing-page search and sharing metadata

The GitHub Pages build prerenders the React landing page, then `scripts/render-landing.mjs`
adds metadata from `scripts/landing-seo.mjs`. Crawlers and social sharing services receive
complete HTML without running the game or JavaScript.

- Descriptive page titles and descriptions for the landing and playable entry.
- Separate self-canonical URLs for the two distinct pages.
- Open Graph and Twitter large-image cards, with an absolute JPEG screenshot URL.
- WebPage and VideoGame JSON-LD describing the actual free browser experience.
  There are no invented ratings or reviews, and no promise of a Google rich result.
- A generated sitemap listing the landing page and game entry. No speculative book
  URLs or artificial last-modified dates: books are generated in the browser.

## Build and verify

Run `npm run build:github`. The static build checker validates the metadata, JSON-LD,
canonical destinations, sitemap entries and image asset. Preview using
`npm run preview:github`. Inspect the HTML source, not just the hydrated DOM.

Published URLs default to `https://alienbat.github.io/library-of-babel/`.
For an actual hosting change, set `STATIC_SITE_ORIGIN` to the HTTPS origin and
`STATIC_BASE_PATH` to its slash-delimited path for the entire build command.
Local previews intentionally retain the production canonical URLs.

The preview image is `public/social-preview.jpg` (1200 by 675 pixels), derived from
`static/screenshots/chasm.png`. Keep the image dimensions in metadata synchronized
when replacing it. Social networks may cache older cards after deployment.

## After deployment

The owner can verify a URL-prefix property in Google Search Console for
`https://alienbat.github.io/library-of-babel/`, submit
`https://alienbat.github.io/library-of-babel/sitemap.xml`, and request indexing of the
landing page. This requires the owner's Search Console account; repository changes
do not submit the site automatically.

A crawler reads robots.txt at the origin root (`https://alienbat.github.io/robots.txt`),
not `/library-of-babel/robots.txt`. This project cannot configure that root file through
its project Pages build. If managing the separate user-site repository, add a Sitemap
line there pointing to this sitemap; otherwise submit it directly in Search Console.
Do not disallow assets needed to render the landing page. A sitemap aids discovery
but does not guarantee indexing or ranking.

References: [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[robots.txt location](https://developers.google.com/search/docs/crawling-indexing/robots/intro),
[structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
