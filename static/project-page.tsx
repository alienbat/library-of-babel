const repo = 'https://github.com/alienbat/library-of-babel';
function LibraryDrawing() {
  return (
    <svg
      viewBox="0 0 800 850"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paper" x2="0" y2="1">
          <stop stopColor="#c9bda5" />
          <stop offset="1" stopColor="#706d59" />
        </linearGradient>
        <pattern id="books" width="9" height="70" patternUnits="userSpaceOnUse">
          <path d="M1 0V70M7 0V70" stroke="#9b7950" strokeWidth="2" />
        </pattern>
      </defs>
      <path fill="url(#paper)" d="M0 0H800V850H0Z" />
      {Array.from({ length: 34 }, (_, i) => {
        const y = (i - 12) * 90;
        return (
          <g key={i}>
            {[false, true].map((right) => (
              <g
                key={String(right)}
                transform={right ? 'translate(800 0) scale(-1 1)' : undefined}
              >
                <path
                  d={`M0 ${y}L400 390L400 394L0 ${y + 68}Z`}
                  fill="#bca16e"
                />
                <path
                  d={`M0 ${y}L400 390L400 394L0 ${y + 68}Z`}
                  fill="url(#books)"
                />
                <path
                  d={`M0 ${y + 68}L400 394L400 397L0 ${y + 80}Z`}
                  fill="#555444"
                />
                <path
                  d={`M0 ${y + 50}L400 394`}
                  stroke="#8d4531"
                  strokeWidth="3"
                />
                <path
                  d={`M0 ${y + 79}L400 397`}
                  stroke="#e1dbbc"
                  strokeWidth="2"
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
export default function ProjectPage({ base }: { base: string }) {
  return (
    <>
      <header>
        <a className="brand" href={base}>
          <span className="mark" aria-hidden="true">
            Ⅲ
          </span>
          <span>
            THE LIBRARY
            <br />
            OF BABEL
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#explore">The experience</a>
          <a href={repo}>GitHub ↗</a>
          <a className="nav-play" href={`${base}play/`}>
            Enter the library ↗
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">AN OPEN-SOURCE EXPLORATION</p>
            <h1>
              Every book.
              <br />
              Every possibility.
            </h1>
            <p className="intro">
              An unimaginable library. A quiet place to wander.
              <br />
              Somewhere in these shelves, the words you’re looking for.
            </p>
            <a className="cta" href={`${base}play/`}>
              Enter the Library <span>↗</span>
            </a>
            <p className="note">
              Free to explore · No download · Desktop recommended
            </p>
            <div className="hero-foot">
              <span>01 / AN INVITATION</span>
              <a href="#explore">Scroll to discover ↓</a>
            </div>
          </div>
          <div className="art">
            <LibraryDrawing />
            <div className="art-caption">
              TWO GALLERIES. A NEAR-ENDLESS HORIZON.
            </div>
          </div>
        </section>
        <section id="explore" className="experience">
          <p className="eyebrow">A LITTLE SPACE FOR ETERNITY</p>
          <div className="section-intro">
            <h2>
              What would you find
              <br />
              if everything was written?
            </h2>
            <p>
              Every book has 410 pages. Every page holds 40 lines of 80
              characters. With 95 possible characters, the collection contains
              every possible text of that length. Most is meaningless. Some
              could mean everything.
            </p>
          </div>
          <div className="features">
            {[
              [
                '01',
                'Wander without hurry',
                'Walk the galleries, climb the stairs, or take flight over the chasm. Steady light and repeating architecture stretch beyond ordinary scales.',
              ],
              [
                '02',
                'Find your words',
                'Open a book, search for an opening, or upload a text file to find its match. A book’s location always leads to the same contents.',
              ],
              [
                '03',
                'Leave a thread to follow',
                'Name your bookmarks, track a distant book, and return to your journey. Or take a planned walk lasting a billion years.',
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span className="number">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="fieldnotes">
          <div>
            <p className="eyebrow">BEFORE YOU ENTER</p>
            <h2>
              Take your time.
              <br />
              There is plenty of it.
            </h2>
            <p>
              A keyboard, mouse and WebGL2-capable browser are all you need.
              Your progress is saved in this browser.
            </p>
          </div>
          <dl>
            {[
              ['W A S D', 'Move'],
              ['MOUSE', 'Look around'],
              ['SPACE', 'Toggle flight'],
              ['LEFT CLICK', 'Open a book'],
              ['T', 'Search, bookmarks & actions'],
              ['M / ESC', 'Game menu'],
            ].map(([key, label]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="about">
          <div>
            <p className="eyebrow">BUILT IN THE OPEN</p>
            <h2>
              A small project.
              <br />
              An enormous place.
            </h2>
            <p>
              The Library of Babel is an independent project inspired by Steven
              L. Peck’s <em>A Short Stay in Hell</em>. It explores the idea of a
              combinatorial library through a playable, carefully constructed
              world.
            </p>
            <p className="small">
              Not affiliated with or endorsed by the author or publisher. The
              game’s dimensions and mechanics include its own design choices.
            </p>
            <a className="text-link" href={repo}>
              Explore the source ↗
            </a>
          </div>
          <aside>
            <span className="heart">♡</span>
            <h3>Help keep the lights on.</h3>
            <p>
              If you enjoy getting lost here, you can support the development of
              this open-source world.
            </p>
            <a className="sponsor" href="https://github.com/sponsors/alienbat">
              Sponsor on GitHub ↗
            </a>
          </aside>
        </section>
      </main>
      <footer>
        <span>THE LIBRARY OF BABEL</span>
        <span>
          Made by <a href="https://github.com/alienbat">alienbat</a> · MIT
          licensed
        </span>
        <a href={`${base}play/`}>
          Eternity can wait. Enter when you’re ready ↗
        </a>
      </footer>
    </>
  );
}
