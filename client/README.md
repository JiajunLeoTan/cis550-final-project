# Axiom — frontend

React + Vite single-page app that consumes the Express backend in [../server](../server).

## Quick start

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Make sure the backend is running on `http://localhost:8080` (see `../server/README.md`).
To point the client at a different backend, create a `.env.local` with:

```
VITE_API_BASE_URL=http://your-host:port
```

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production bundle in `dist/`
- `npm run preview` — preview the production build

## Architecture

```
client/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx                # React root, router, CartProvider
    ├── App.jsx                 # Layout shell + routes
    ├── api/
    │   ├── client.js           # Centralized fetch wrapper (all endpoints)
    │   └── useApi.js           # Generic data-fetching hook w/ AbortController
    ├── context/
    │   └── CartContext.jsx     # Cart state backed by localStorage
    ├── components/
    │   ├── Header.jsx          # Sticky nav + cart badge
    │   ├── Footer.jsx
    │   ├── ProductCard.jsx     # Reusable product tile
    │   ├── Rating.jsx          # Star + count
    │   ├── StarIcon.jsx
    │   ├── States.jsx          # Skeletons, empty, error
    │   ├── AnimatedNumber.jsx  # rAF-driven number tween
    │   └── charts/
    │       ├── BarChart.jsx
    │       ├── HorizontalBars.jsx
    │       └── LineChart.jsx
    ├── pages/
    │   ├── Home.jsx            # Hero, entry points, featured deals
    │   ├── Browse.jsx          # Search + deals + trending
    │   ├── ProductDetail.jsx   # Overview, rating chart, reviews, alts
    │   ├── Cart.jsx            # Cart + live savings
    │   ├── Analytics.jsx       # Categories, brands, review trend
    │   ├── ValueRankings.jsx   # Weight sliders + live ranking
    │   └── NotFound.jsx
    ├── utils/format.js         # Currency, ratings, dates
    └── styles/index.css        # Design tokens + base styles
```

### State

- **Cart** — `CartContext` + `localStorage`. Simple, synchronous, no external lib.
- **URL as state** — search, filters, and cart all survive a reload.
- **Remote data** — `useApi(fn, deps)` wraps every endpoint with cancelable fetches.

### Visuals

- Palette: warm ivory (background), graphite (ink), muted emerald (accent), soft
  gold (highlight / rewards). No purple.
- Type: **Fraunces** for display, **Inter** for body, **JetBrains Mono** for numerics.
- Motion: `fade-in` / `rise-in` on mount, `stagger` for lists, `AnimatedNumber`
  for savings and value scores. Everything honors `prefers-reduced-motion`.
- Charts: bespoke SVG (bar, horizontal bar, line). No chart library — keeps the
  bundle small and transitions controllable.

## API routes used

All 15 Milestone 4 routes:

| Route | Page(s) |
|---|---|
| `GET /categories` | Browse, Analytics |
| `GET /brands` | (not eagerly loaded — catalog is ~900k) |
| `GET /products/:asin` | ProductDetail |
| `GET /products/search` | Browse, Home (via redirect) |
| `GET /deals` | Home, Browse |
| `GET /products/:asin/rating-distribution` | ProductDetail |
| `GET /products/:asin/helpful-reviews` | ProductDetail |
| `GET /products/:asin/alternatives` | ProductDetail |
| `POST /cart/savings` | Cart |
| `GET /analytics/categories/compare` | Analytics |
| `GET /products/trending` | Browse |
| `GET /products/top-value` | (available in client, hook exposed) |
| `GET /analytics/brands/performance` | Analytics |
| `GET /analytics/reviews/trend` | Analytics |
| `GET /products/value-rankings` | ValueRankings |

## Notes & limitations

- `/brands` is 886k rows — the client exposes `api.brands()` but never calls it on
  mount. Add a type-ahead later if needed.
- Review-dependent analytics can be empty because the loaded review corpus is
  small. All empty states explain this to the user.
- `recent_review_count` is computed server-side; the client just formats it.
- Product images come from `img_url` and are loaded lazily.
