import { useEffect, useRef, useState } from 'react';

/** Account for the image's full cover scale, including pixels cropped out of view.
 * The browser combines this CSS-pixel size with devicePixelRatio to pick a source.
 */
function SceneImage({ base, name, alt, eager = false }: {
  base: string; name: string; alt: string; eager?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [sizes, setSizes] = useState('100vw');
  useEffect(() => {
    const img = ref.current!;
    const update = () => {
      const { width, height } = img.getBoundingClientRect();
      setSizes(`${Math.ceil(Math.max(width, height * 16 / 9))}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(img);
    update();
    return () => observer.disconnect();
  }, []);
  return <img ref={ref} src={`${base}${name}-1920.webp`}
    srcSet={[960, 1920, 2560, 3840].map(w => `${base}${name}-${w}.webp ${w}w`).join(', ')}
    sizes={sizes} width={3840} height={2160} alt={alt}
    loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" />;
}

const repo = 'https://github.com/alienbat/library-of-babel';
const specs: [string, string][] = [
  ['Layout', 'Two parallel galleries facing across a chasm, repeated floor over floor to finite boundaries'],
  ['Chasm', '30.48 m (100 ft) between the inner gallery edges'],
  ['Gallery', '3.66 m (12 ft) wide; sections 22.86 m (75 ft) long; floors 3.96 m apart'],
  ['Shelves', '8 rows × 570 books per section, per gallery, one book deep'],
  ['Each book', '410 pages × 40 lines × 80 characters — 1,312,000 characters'],
  ['Alphabet', '95 printable ASCII characters, including space; case and spacing matter'],
  ['Amenities', 'Every 12th section: stairs, a seven-bed dormitory, bathroom, food and water'],
  ['Movement', 'Walk 1.7 m/s · run 3.4 m/s · fly 8 or 24 m/s · fall toward 120 mph'],
  ['Planned walks', '1, 1,000, 1,000,000 or 1,000,000,000 years at ten hours a day'],
];
const examples: [string, React.ReactNode][] = [
  ['01', <>A book of nothing but the letter <em>A</em></>],
  ['02', <>“All work and no play makes Jack a dull boy”, 410 pages of it, as in <em>The Shining</em></>],
  ['03', 'The King James Bible, encoded in Base64'],
  ['04', 'The nuclear launch codes of every nuclear power'],
];
export default function ProjectPage({ base }: { base: string }) {
  const play = `${base}play/`;
  return (
    <>
      <header>
        <a className="brand" href={base}>
          <span className="mark" aria-hidden="true">Ⅲ</span>
          <span>THE LIBRARY<br />OF BABEL</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#library">The library</a>
          <a href="#search">The search</a>
          <a href={repo}>GitHub ↗</a>
          <a className="nav-play" href={play}>Enter the library</a>
        </nav>
      </header>
      <main>
        <section className="hero" aria-label="Introduction">
          <div className="hero-art"><SceneImage base={base} name="hero" alt="" eager /></div>
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow eyebrow-light">A LIBRARY OF EVERY POSSIBLE BOOK</p>
            <h1>Every book.<br />Every possibility.</h1>
            <p className="intro">
              A library that holds every book it is possible to write — an idea from Jorge Luis Borges, here given the vast opposing galleries of Steven L. Peck’s <em>A Short Stay in Hell</em>.
            </p>
            <div className="hero-actions">
              <a className="cta" href={play}>Enter the library <span>→</span></a>
              <a className="hero-more" href="#library">How the library is built ↓</a>
            </div>
          </div>
          <div className="hero-facts">
            <div><b>410</b>PAGES PER BOOK</div>
            <div><b>40 × 80</b>LINES × CHARACTERS</div>
            <div><b>95</b>PRINTABLE CHARACTERS</div>
            <div><b>95<sup>1,312,000</sup></b>DISTINCT BOOKS</div>
          </div>
        </section>

        <section id="library" className="library" aria-labelledby="library-title">
          <p className="eyebrow">01 — THE LIBRARY WE MODEL</p>
          <div className="section-intro">
            <h2 id="library-title">Two galleries, one chasm, and a horizon that never arrives.</h2>
            <div>
              <p>Every book has 410 pages of 40 lines, each 80 characters long, drawn from 95 printable characters. That fixes the collection at exactly 95<sup>1,312,000</sup> books — one of every possible text of that length — and every one of them has a single, permanent place on a shelf.</p>
              <p>The galleries are laid out like a building rather than a database: two twelve-foot walkways face each other across a hundred-foot drop, stacked floor upon floor, with stairs, a dormitory and a bathroom every twelfth section. Return to any spot and the same book is on the same shelf.</p>
              <p className="small">Inspired by the opposing galleries of Steven L. Peck’s <em>A Short Stay in Hell</em>. An independent project; the exact dimensions and rules below are its own choices.</p>
            </div>
          </div>
          <div className="library-detail">
            <figure className="art">
              <SceneImage base={base} name="galleries" alt="The two galleries seen from a walkway, shelves receding to the horizon" />
              <figcaption className="art-caption">TWO GALLERIES. A NEAR-ENDLESS HORIZON.</figcaption>
            </figure>
            <dl className="specs">
              {specs.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section id="search" className="search" aria-labelledby="search-title">
          <p className="eyebrow">02 — THE SEARCH</p>
          <div className="section-intro">
            <div>
              <h2 id="search-title">Every book that has ever existed, or ever will.</h2>
              <p>Type how a book begins, or upload a text file, and the library finds the one shelf where that exact book sits — real or fictional, written or not yet written. Then it points you toward it, however many light years away. A few things already waiting on the shelves:</p>
            </div>
            <ul className="examples">
              {examples.map(([n, text]) => (
                <li key={n}><span className="number">{n}</span><span>{text}</span></li>
              ))}
              <li className="examples-cta"><span className="number">05</span><span>Your biography</span><a className="find" href={play}>Enter and find <span>→</span></a></li>
            </ul>
          </div>
        </section>

        <section className="about" aria-label="Built in the open">
          <p className="eyebrow">03 — BUILT IN THE OPEN</p>
          <div className="tiles">
            <a className="tile" href={repo}>
              <span className="tile-label"><span className="tile-mark" aria-hidden="true">Ⅲ</span><span>Explore the source</span></span>
              <span className="tile-arrow">↗</span>
            </a>
            <a className="tile" href="https://github.com/sponsors/alienbat">
              <span className="tile-label"><span className="tile-mark" aria-hidden="true">♡</span><span>Sponsor on GitHub</span></span>
              <span className="tile-arrow">↗</span>
            </a>
          </div>
          <p className="footnote">MIT licensed. Not affiliated with or endorsed by Steven L. Peck or his publisher; the book’s text is not included.</p>
        </section>
      </main>
      <footer>
        <span>THE LIBRARY OF BABEL</span>
        <span>Made by <a href="https://github.com/alienbat">alienbat</a> · MIT licensed</span>
        <a href={play}>Eternity can wait. Enter when you’re ready ↗</a>
      </footer>
    </>
  );
}
