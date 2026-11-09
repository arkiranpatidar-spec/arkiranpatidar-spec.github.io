# kiranpatidar.com

An interactive personal universe. A wall you can pick things up from.

## Run it

```bash
npm install
npm run dev      # rebuilds on save, output in dist/
npm run build    # one-off production build
npm run preview  # serves dist/ locally
```

`dist/` is a static site with one pre-rendered HTML page per room, a `sitemap.xml` and a `robots.txt`.
It deploys as it is to Vercel, Netlify, Cloudflare Pages or GitHub Pages. Point kiranpatidar.com at it.

## Change the content

Nothing about the words lives in a component. See `docs/CONTENT.md`.

| To change | Edit |
| --- | --- |
| What you are reading, learning, making | `src/content/rooms.js`, `currently` |
| Books on the shelf, colours, titles | `src/content/site.js` |
| Objects in the cabinet and their stories | `src/content/cabinet.js` |
| Perfume feature | `src/content/perfume.js` |
| Attire archive | `src/content/attire.js` |
| Every other room | `src/content/rooms.js` |

Set `showDraftMarks: false` in `src/content/site.js` once everything is confirmed.

## How it is built

React, esbuild and hand-written CSS. No router, animation or physics dependency.

- `src/lib/motion.js`: the shared animation clock and spring-drag helper.
- `src/components/Shelf.jsx`: bookshelf physics (spring slots, gravity, throw, bounce, neighbours jolting).
- `src/lib/sound.js`: ambient sound, synthesised with Web Audio. Off by default.
- `src/lib/tabla.js` and `src/lib/foley.js`: the tabla and the sound of each object, also synthesised. They play when an object is tapped.
- `src/art/`: every illustration, as code.
- `build.mjs`: bundles the client and pre-renders each route to HTML.

### Regenerating art assets

Only needed if you change the sari drawing or the material textures.

```bash
python3 scripts/make_textures.py          # needs numpy and Pillow
npm i -D playwright sharp && node scripts/make_zari_mask.mjs
```

### Moving to Next.js

The brief preferred Next.js, Tailwind, Framer Motion and GSAP. They could not be installed where this was built, so the interaction layer is custom.
The components are plain React with no build-specific code. To move: wrap `App` in a client component, replace `src/lib/router.js` with `next/navigation`, and generate the routes from `allRoutes()` in `src/components/App.jsx`. That migration has not been tested.
