# The Library of Babel

**[Play now in your browser](https://alienbat.github.io/library-of-babel/play/)** — no installation required.

A first-person browser exploration of a library containing every possible book of a fixed format. Almost every page is noise; somewhere among them is any text you can imagine, provided it fits that format.

The project draws literary inspiration from Steven L. Peck’s _A Short Stay in Hell_ and its vast opposing galleries. It is an independent exploration of a combinatorial library, not an official game or a retelling of the novella. Read about the book on its [publisher’s website](https://www.penguin.co.uk/books/486146/a-short-stay-in-hell-by-peck-steven-l/9781807841348). Neither the author nor the publisher is affiliated with or endorses this project.

## The library we model

These are **the game’s adopted specifications**, verified against the implementation. They are not a claim that every measurement appears in Peck’s text. The opposing galleries, broad chasm, repeated rest facilities and fixed-format books reflect the literary inspiration; exact construction, placement, movement rules and the near-square global layout are project choices.

| Element                        | Adopted specification                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout                         | Two parallel galleries, repeated across floors; finite global boundaries with a visually continuous distant horizon                                       |
| Chasm width                    | 30.48 m (100 ft), between the inner gallery edges                                                                                                         |
| Each gallery’s width           | 3.6576 m (12 ft)                                                                                                                                          |
| Floor spacing / deck thickness | 3.96 m floor to floor; 0.34 m gallery decks                                                                                                               |
| Gallery section length         | 22.86 m (75 ft)                                                                                                                                           |
| Railings                       | Upper rail at 1.2192 m (4 ft); lower rail at 0.55 m                                                                                                       |
| Shelves                        | 8 rows × 570 books per occupied section, per gallery; one book deep                                                                                       |
| Individual book geometry       | 0.037 m wide × 0.34 m high × 0.30 m deep; rows spaced 0.39 m apart                                                                                        |
| Book format                    | 410 pages × 40 lines × 80 characters = 1,312,000 characters                                                                                               |
| Alphabet                       | 95 printable ASCII characters, including space; case and spacing matter                                                                                   |
| Collection size                | Exactly 95^1,312,000 distinct books; each complete content string maps to one occupied global slot                                                        |
| Amenities                      | Every 12th section, or 274.32 m, on each gallery; stairs, a seven-bed dormitory, bathroom and decorative food/water fixtures                              |
| Room footprints                | Dormitory 8 × 6.3 m; bathroom about 6 × 5 m; the repeating room-lighting region spans 32 × 6.5 m                                                    |
| Stair flight                   | 24 steps over an 8 m horizontal run, rising one floor; terminal floors omit the flight beyond the boundary                                                |
| Bathroom fittings              | Two showers, basin, mirror panel and screened toilet; layout and toilet are project interpretations                                                       |
| Finishes and lighting          | Warm brown books/shelves, gilt-colored page edges, gray carpet and reddish-brown rails; steady baked illumination, no day/night cycle or atmospheric haze |
| Walking / running              | 1.7 / 3.4 m/s; eye height 1.68 m                                                                                                                          |
| Flight / fast flight           | 8 / 24 m/s; an added exploration mechanic                                                                                                                 |
| Falling                        | Gravity 9.81 m/s²; quadratic drag approaches 53.6448 m/s (120 mph); engaging flight brakes at 5g                                                          |
| Planned walks                  | 1, 1,000, 1,000,000 or 1,000,000,000 years; 10 hours/day at walking speed, 365 days/year; stop at boundaries                                              |
| Journey time                   | Real time since the journey began, including time offline, plus planned-walk time                                                                         |

For the global dimensions, let **Q = 95^656,000**. The game uses **S = 12 × floor(Q / 2,640)** horizontal sections, **B = (S / 12) × 11 × 2 × 8 × 570** books per complete floor, and **F = ceil(Q² / B)** floors. Its width is **S × 22.86 m** and height **F × 3.96 m**, almost equal. These are mathematical model dimensions, not a claim about the size specified by the novella. [Addressing and rendering details](docs/ARCHITECTURE.md) explain how this remains practical.

## Explore

- Walk, run or fly through the galleries and rest facilities.
- Open any nearby book and turn its pages. Its location always produces the same content.
- Find a book by its exact opening, or provide a `.txt` file to find an exact normalized match. Search finds **one match**, not the nearest match.
- Save named bookmarks and track a book’s direction and straight-line distance.
- Take planned walks across immense distances and resume a saved journey later.

There are no other characters or narrative quests. Furnishings are scenery; the mirror is not a live reflection. Progress stays in the current browser rather than an online account.

## Run locally

Requires **Node.js 22.13 or newer**, npm, and a browser with WebGL2 support.

```sh
git clone https://github.com/alienbat/library-of-babel.git
cd library-of-babel
npm ci
npm run dev
```

Open the address printed by the server and select **Enter the library**. Mouse capture is preferred; click-and-drag looking is available when capture is unavailable.

| Control                                 | Action                                                         |
| --------------------------------------- | -------------------------------------------------------------- |
| WASD / mouse                            | Move / look                                                    |
| Shift                                   | Move faster                                                    |
| Space                                   | Toggle flight; when falling, brake into flight                 |
| Left click on a nearby highlighted book | Open book                                                      |
| Left / right arrows while reading       | Previous / next page                                           |
| Right click or Esc while reading        | Return book to shelf                                           |
| T                                       | Actions: search, uploaded text, bookmarks and planned walks    |
| M or Esc                                | Game Menu; continue, save progress or open settings            |
| Backtick (`)                            | Debug teleport menu: corners, original arrival or tracked book |

Touch controls provide movement and drag-to-look. **Save Progress** is in the Game Menu; autosave runs every five minutes. **Settings → Start Over** requires confirmation and clears this browser’s journey and book history. Browser storage can be cleared or exhausted; it is not a durable backup. [Storage details](docs/ARCHITECTURE.md#progress-and-storage)

## Contributing and documentation

Bug reports should include the browser, device, reproduction steps and a screenshot when useful. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup checks and the branch → PR → approval → squash-merge workflow.

- [Architecture and implementation](docs/ARCHITECTURE.md)
- [Development and validation](docs/DEVELOPMENT.md)
- [GitHub Pages build and deployment](docs/GITHUB_PAGES.md)
- [Changelog](CHANGELOG.md)
- [Literary attribution and rights policy](docs/ATTRIBUTION.md)

## License

Original project code and original project-created assets are available under the [MIT License](LICENSE). This does not license Peck’s writing, any other literary work, user-provided text or third-party dependencies. Dependencies retain their own licenses; bundled GMP/WASM notices and source are in [public/third-party/gmp-wasm](public/third-party/gmp-wasm).
