/** Metadata shared by the prerender and its build checks. */
export function siteUrls(base = '/library-of-babel/', origin = 'https://alienbat.github.io') {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash)
    throw new Error('STATIC_SITE_ORIGIN must be an HTTPS origin without a path');
  return { home: new URL(base, url).href, play: new URL(`${base}play/`, url).href,
    image: new URL(`${base}social-preview.jpg`, url).href };
}
export const seoTitle = 'The Library of Babel — Free 3D Browser Exploration';
export const seoDescription = 'Explore The Library of Babel, a free 3D browser game inspired by A Short Stay in Hell. Walk endless-looking galleries, search for books and save your discoveries.';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export function seoHead(urls, play = false) {
  const title = play ? 'Play The Library of Babel — 3D Browser Game' : seoTitle;
  const url = play ? urls.play : urls.home;
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    ...Object.entries({ 'og:type': 'website', 'og:site_name': 'The Library of Babel',
      'og:title': title, 'og:description': seoDescription, 'og:url': url,
      'og:image': urls.image, 'og:image:type': 'image/jpeg',
      'og:image:width': '1200', 'og:image:height': '675',
      'og:image:alt': 'Two galleries of books stretching toward a distant horizon across a vast chasm',
    }).map(([property, content]) => `<meta property="${property}" content="${escape(content)}" />`),
    ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title,
      'twitter:description': seoDescription, 'twitter:image': urls.image,
      'twitter:image:alt': 'The Library of Babel viewed from the middle of its chasm',
    }).map(([name, content]) => `<meta name="${name}" content="${escape(content)}" />`),
  ];
  if (!play) tags.push(`<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': urls.home, url: urls.home, name: seoTitle,
        description: seoDescription, inLanguage: 'en', primaryImageOfPage: urls.image,
        mainEntity: { '@id': `${urls.home}#game` } },
      { '@type': 'VideoGame', '@id': `${urls.home}#game`, name: 'The Library of Babel',
        url: urls.play, description: seoDescription, image: urls.image,
        genre: 'Exploration', gamePlatform: 'Web browser', playMode: 'SinglePlayer',
        isAccessibleForFree: true, inLanguage: 'en',
        author: { '@type': 'Person', name: 'alienbat', url: 'https://github.com/alienbat' },
        license: 'https://github.com/alienbat/library-of-babel/blob/main/LICENSE',
      },
    ],
  }).replaceAll('<', '\\u003c')}</script>`);
  return {title, tags: tags.join('\n    ')};
}
