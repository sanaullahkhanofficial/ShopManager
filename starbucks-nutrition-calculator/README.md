# Starbucks Nutrition Calculator

An independent, U.S.-focused nutrition calculator for Starbucks drinks. Built with **Astro + TypeScript**, a small **React** island for the
interactive calculator, and vanilla CSS. Builds to fully static files — no Node.js server required in production.

> This is an independent informational tool and is **not affiliated with, endorsed by, or sponsored by Starbucks Corporation**. This is a
> separate project from the `ShopManager` desktop app in the root of this repository; the two do not share code, dependencies, or a build
> pipeline.

## ⚠️ Data status — read before treating any number as final

Every drink/size record in `src/data/us/` carries a `status` of **`needs-review`**, not `verified`. The nutrition figures were compiled from
publicly available Starbucks nutrition data via third-party nutrition trackers, because the environment used to build this dataset could not
reach `starbucks.com` directly (its network egress was blocked). Every record's `sourceUrl` points to the specific Starbucks nutrition page it
should be checked against before being presented as final. See [`src/data/us/meta.ts`](./src/data/us/meta.ts) and
[`/methodology/`](./src/pages/methodology/index.astro) for the full explanation and the update process. **No number in this dataset was
fabricated or guessed** — where a verified figure wasn't available (for example, per-pump syrup/sauce nutrition), the calculator says so
instead of inventing one.

## What's implemented

- A real, state-driven calculator (drink → size → milk → espresso shots → syrup/sauce/sweetener/cold foam/whip/toppings → nutrition), built on
  a pure, deterministic `calculateNutrition(configuration, database)` function (see `src/lib/calculator/`).
- 11 seed drinks across Hot Coffee, Iced Coffee, Espresso, Cold Brew, Latte, Cappuccino, Macchiato, Mocha, Americano, Refreshers, Matcha and
  Chai categories.
- Size, milk and customization eligibility per drink — invalid combinations are clamped/repaired, never silently miscalculated.
- Search (instant, case-insensitive, alias- and category-aware), quick filters (data-driven, not hard-coded), popular drinks, low-calorie /
  low-sugar / high-protein / dairy-free / caffeine-free sections.
- Save, favorite, recent-drinks and shareable-URL state, all client-side via `localStorage` and `URLSearchParams`, with graceful fallbacks if
  storage is unavailable.
- "What changed?" comparison against the default recipe, and neutral-language "smart swap" suggestions generated from real calculated data.
- Drink detail pages, `/drinks/`, `/methodology/`, `/faq/`, `/changelog/`, `/privacy/`, `/terms/`, sitemap, robots.txt, canonical/OG/Twitter
  metadata, and JSON-LD (`WebSite`, `FAQPage`, `BreadcrumbList`).
- Responsive layout for mobile (320–767px), tablet (768–1023px), laptop (1024–1439px) and desktop (1440px+), with a mobile bottom nav.
- 34 Vitest unit tests (calculation engine, validation, search, filters, URL round-trip, storage) and Playwright e2e tests across mobile/
  tablet/desktop viewports.

## Known gaps (intentionally not faked)

- Per-pump syrup/sauce nutrition deltas are not verified for any drink — the calculator discloses "ingredient-level calculation unavailable"
  instead of estimating one.
- Per-drink milk-substitution nutrition deltas are not verified — selecting a different milk updates your customization summary but shows a
  disclosure rather than a fabricated total.
- Food items and seasonal drinks are not yet in the dataset (the type system in `src/types/drink.ts` already supports food items).
- Only Grande-size data is verified per drink today; other sizes are shown as disabled with "Data not available" rather than guessed.
- The interactive two-drink comparison tool (arbitrary drink vs. drink) is not built yet; the homepage ships a static example comparison
  instead. See `/changelog/`.

## Getting started

```bash
npm install
npm run dev       # http://localhost:4321
```

## Scripts

| Script                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Local dev server                                     |
| `npm run build`        | Type-check (`astro check`) then build static `dist/` |
| `npm run preview`      | Preview the production build locally                 |
| `npm test`             | Run unit tests (Vitest)                              |
| `npm run test:e2e`     | Run Playwright e2e tests                             |
| `npm run lint`         | ESLint                                               |
| `npm run format`       | Prettier (write)                                     |
| `npm run format:check` | Prettier (check only)                                |

## Before deploying to a real domain

`astro.config.mjs` and a couple of JSON-LD blocks currently use the placeholder `https://example.com`. Before deploying, replace it with your
real domain (used for canonical URLs, Open Graph tags, and the generated sitemap):

- `astro.config.mjs` → `site: 'https://your-domain.com'`
- `public/robots.txt` → the `Sitemap:` line
- `src/pages/index.astro` / `src/pages/drinks/[slug].astro` → the `structuredData` blocks

## Deploying to Hostinger (static hosting, no Node.js required)

This app builds to plain static HTML/CSS/JS. Hostinger's shared hosting serves static files directly from `public_html` — you do **not** need
Node.js, a Hostinger VPS, or any server-side runtime.

1. **Build locally** (or in CI):

   ```bash
   npm install
   npm run build
   ```

   This produces a `dist/` folder containing the finished site.

2. **Upload the contents of `dist/` — not the folder itself — into `public_html`.**
   - Using **Hostinger File Manager** (hPanel → Files → File Manager): open `public_html`, delete any placeholder `index.html` Hostinger put
     there, then upload every file/folder from inside `dist/` (not the `dist` folder itself) so that `public_html/index.html`,
     `public_html/drinks/`, `public_html/_astro/`, etc. sit directly under `public_html`.
   - Using **FTP/SFTP** (hPanel → Files → FTP Accounts for credentials): connect with an FTP client (e.g. FileZilla) and upload the contents
     of `dist/` into `public_html/`.
   - Using the **Hostinger Git integration** (if enabled on your plan): point it at this repository's `starbucks-nutrition-calculator/`
     directory, set the build command to `npm run build` and the publish directory to `dist`, if your plan supports a build step; otherwise
     build locally and upload as above.

3. **Verify.** Visit your domain and confirm the homepage, `/drinks/`, `/drinks/caffe-latte/`, `/methodology/`, `/faq/`, `/changelog/`,
   `/sitemap-index.xml` and `/robots.txt` all load with no console errors.

4. **HTTPS.** Enable Hostinger's free SSL (hPanel → Security → SSL) if it isn't already active, so the canonical/OG URLs you set above are
   actually reachable over HTTPS.

No Node.js, database, or backend process is required on the Hostinger server — everything the calculator needs (the dataset, the calculation
engine, and the interactive UI) is bundled into the static files at build time and runs in the visitor's browser.

## Project structure

```
src/
  components/        Astro + React components (Calculator/ is the interactive React island)
  data/us/            Seed dataset: drinks, milk, modifiers, categories, data-version metadata
  layouts/            BaseLayout.astro (SEO meta, structured data, header/footer/bottom-nav)
  lib/
    calculator/       calculateNutrition (pure), defaults, delta ("what changed"), math helpers
    validation/       parseUnknownConfiguration - never trusts URL/localStorage input blindly
    storage/          localStorage helpers (saved drinks, recents, favorites) with graceful failure
    sharing/          URL <-> configuration serialization for deep links and Share
    search.ts, filters.ts, catalog.ts, smartSwaps.ts, format.ts
  pages/              Astro routes: /, /drinks/, /drinks/[slug]/, /methodology/, /faq/, /changelog/, /privacy/, /terms/
  styles/global.css   Design tokens + responsive layout
  types/              Nutrition, Drink, Customization, Configuration, Database types
tests/
  unit/               Vitest - calculation engine, validation, search, filters, URL, storage
  e2e/                Playwright - critical calculator flow across mobile/tablet/desktop
```

## Architecture notes for extending the data

- Replacing the local dataset with an API/database later only requires implementing `NutritionDatabase` (see `src/types/database.ts`) from a
  different source — the calculation engine, UI, and tests all consume that interface, not the JSON/TS files directly.
- Never add a nutrition number without a `sourceUrl` and an honest `status`. If you don't have a verified figure, leave the field `null` (it
  renders as "—") or set the modifier's `perUnit` to `null` (it renders as "ingredient-level calculation unavailable").
