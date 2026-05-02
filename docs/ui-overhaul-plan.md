# UI/UX Overhaul Plan

> Audience: a coding agent implementing the changes end-to-end.
> Goal: strip the "AI-generated luxury portfolio" feel and replace it with a quieter, more human, more editorial product-research interface. Lower the visual volume; raise the information density.

---

## 1. The problem, in plain terms

The current build (Axiom) is a textbook "AI-looking" site. It hits almost every tell:

| Tell | Where |
| --- | --- |
| Ivory + graphite + muted emerald + soft gold palette | `client/src/styles/index.css:3-25` |
| Fraunces display serif paired with Inter + JetBrains Mono | `client/src/styles/index.css:73-77` |
| `.eyebrow` mono-uppercase kicker above every section, with leading dash glyph | `client/src/styles/index.css:388-405` |
| Numbered eyebrows ("01 / Browse", "02 / Trending", …) | `client/src/pages/Home.jsx:150-176` |
| Animated counter-up "stats" on the hero (1,426,336 products indexed) | `client/src/pages/Home.jsx:9-13`, `Home.jsx:117-141` |
| Dark hero with two radial gradient glows in gold + emerald | `client/src/pages/Home.jsx:42-62` |
| Italic-gold "actually" word in a hero headline | `client/src/pages/Home.jsx:74-78` |
| `.stagger` entrance animation on every grid | `client/src/styles/index.css:529-556` |
| Emerald → gold linear-gradient progress bars used as decoration | `Cart.jsx:201-209`, `ValueRankings.jsx:371-379` |
| Section headers structured identically: eyebrow → display heading → ghost button | `Home.jsx`, `Browse.jsx`, `Analytics.jsx`, `ValueRankings.jsx`, `Cart.jsx` |
| "Premium" copy ("Reviewed and loved", "Catching fire", "Find exactly what matters", "Signals across the catalog", "Tune the weights. The ranking responds.") | many |
| Mono numerals + `text-num` everywhere — even on cart counts and rating sliders | many |
| Pill badges with frosted-glass backdrop-blur over product images | `ProductCard.jsx:39-52` |
| `Σ weights = 1.00 · server renormalizes` style mono footnote | `ValueRankings.jsx:129-140` |

Individually, any one of these is fine. Stacked together, they read as a template — the same template every LLM produces when asked to design a "premium product analytics site." The fix isn't to swap one palette for another; it's to **reduce the amount of design happening on screen** and to **let real content carry the page**.

The target aesthetic is closer to: *Pitchfork's record reviews × the Wirecutter × a personal Substack*. Editorial. Quiet. Confident in the data.

---

## 2. Design principles for the rewrite

Use these as decision rules. When unsure, prefer the option that:

1. **Removes a flourish rather than adds one.** No second gradient, no second animation, no second accent color.
2. **Looks like one human made it for themselves and a few friends.** Not "for a Series B launch."
3. **Lets typography do the work.** One typeface family, two weights, real hierarchy through size and spacing — not through color and ornament.
4. **Uses color sparingly and meaningfully.** A single accent for interactive affordance. No decorative gradients. No emerald-to-gold sweeps.
5. **Treats data as the hero.** Product titles, prices, ratings, and charts should be the loudest things on the page. Chrome should recede.
6. **Respects rest.** Reduce or eliminate entrance animations. They draw attention to the framework, not the content.
7. **Writes copy like a person, not a deck.** Short, specific, occasionally dry. No "actually." No "catching fire." No emoji.

---

## 3. Design system — the new tokens

Replace [client/src/styles/index.css](client/src/styles/index.css) wholesale. Below is the target token set; the implementer should rewrite the file in this spirit, keeping only the utility classes that are actually used.

### 3.1 Palette

Drop the ivory + emerald + gold trio. New palette:

```
--paper:        #fafaf7;   /* page background; warm-neutral but not creamy */
--paper-2:      #f3f2ed;   /* alt surface (cards on cards, table stripes) */
--surface:      #ffffff;   /* card surface */
--ink:          #1c1c1a;   /* primary text */
--ink-2:        #44443f;   /* secondary text */
--ink-3:        #84847e;   /* tertiary / metadata */
--rule:         #e7e5dd;   /* hairlines */
--rule-2:       #d4d2c8;   /* stronger hairlines */

--accent:       #1f4d3a;   /* one accent — a deep forest, used only for links,
                              focused inputs, and selected state */
--accent-soft:  #e6ece8;   /* accent's tinted background (selected pill) */

--negative:     #8a3a26;   /* errors, "save" callouts. Brick, not ember. */
--positive:     #2f6b3a;   /* discounts, verified — same family as accent */
```

Rules:

- **No gradient backgrounds anywhere.** Delete every `linear-gradient(...)` and `radial-gradient(...)` use.
- **No gold.** Drop the entire `--gold-*` family.
- **No emerald-to-gold sweeps** on progress bars. Progress bars are flat `--accent` on `--rule`.
- Selection color: `var(--accent-soft)` background, `var(--ink)` text. Not the loud emerald-300.

### 3.2 Typography

Replace the three-font system with one serif and one mono fallback for tabular numbers in tables only.

```
--font-serif: "Source Serif 4", "Iowan Old Style", Georgia, "Times New Roman", serif;
--font-sans:  ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
--font-mono:  ui-monospace, "SF Mono", Menlo, monospace;
```

Body and UI text: `--font-serif` at 16px, line-height 1.6. A serif for body is the single most effective move to make this site stop reading "AI". Pair it with sans only for chrome that must feel utilitarian (nav, buttons).

Concretely:

- `body`: serif, 16px, `--ink`.
- `nav`, `button`, form labels, table headers, axis labels: sans, 13–14px, `--ink-2`.
- Display headings: same serif as body, just larger and tighter. **Drop Fraunces.** Drop the `letter-spacing: -0.02em` flourish on display headings — set it to `-0.01em` only on the largest size.
- **Drop `.eyebrow` entirely** as a styled pattern. See §4 for what replaces it.
- **Drop `.text-num` / mono numerals everywhere except inside tables** with rows of numbers that need to align. Cart badge, rating values, slider readouts, price tags: all use the serif. Money set in serif looks like a price tag, not telemetry.

### 3.3 Spacing, radius, shadow

- Spacing scale stays roughly the same, but **double the page-level rhythm** between sections. Replace `--s-16` between sections with `--s-20`. Generous whitespace is editorial; cramped grids are AI.
- Radius: collapse `--r-xs … --r-xl` down to two values: `--r: 4px` for inputs/buttons, `--r-lg: 8px` for cards. Drop the 14px / 20px / 28px middle radii. **Eliminate `--r-full` for buttons and nav links** — pill-shaped buttons are a tell. Buttons are slightly rounded rectangles.
- Shadows: keep one. `--shadow: 0 1px 0 var(--rule)` (a single hairline below cards, no blur). Delete all soft drop-shadows; they read as "premium."
- Card hover: do **not** translate or shadow-grow. Change the border color from `--rule` to `--rule-2`. That's it.

### 3.4 Motion

- Delete `.stagger`, `.fade-in`, `.rise-in`. Page mounts are instant.
- Keep transitions on hover/focus only, and make them shorter (120ms).
- Keep the `prefers-reduced-motion` block.
- Delete [client/src/components/AnimatedNumber.jsx](client/src/components/AnimatedNumber.jsx) and every usage. Numbers render at their final value. Counter-up animations are the single strongest "AI launch page" tell.

---

## 4. Patterns that must change globally

### 4.1 Eyebrows → kickers, used sparingly

The current `.eyebrow` (mono uppercase 12px with a leading dash, applied above every heading on every page) needs to die. The new pattern:

- **Most section headers don't get a kicker at all.** A heading and, where useful, one sentence of supporting prose. That's enough hierarchy.
- When a kicker *is* genuinely useful (e.g. distinguishing "Reviews" from "Ratings" on the product page), render it as small sans-serif `--ink-3` text, sentence case, with no leading dash, no uppercase, no letter-spacing flare. Example: "Ratings distribution" or "Most helpful reviews".
- **Remove all numbered eyebrows ("01 / Browse").** Numbering nav cards as if they were a marketing landing page is the loudest tell on `Home.jsx`.

### 4.2 Section header structure

The repeating `<eyebrow><h-display><ghost button on the right>` block on every page is the second loudest tell. Vary it:

- Home: hero is just a headline + sentence + a real search input. No stats row. No CTA pair.
- Browse: page heading is "Browse" — that's it. No "Find exactly what matters." kicker line.
- Analytics: page heading is "Analytics", followed by a short paragraph (~25 words) explaining what the page actually shows. No kicker.
- Value Rankings: title is "Value rankings" with a one-line description below. Keep the explanatory paragraph; drop the "Tune the weights. The ranking responds." marketing voice.
- Product detail: drop the `<eyebrow>Ratings</eyebrow><h-display>Distribution</h-display>` two-line title pattern inside cards. Use a single line: "Ratings distribution" in normal-weight serif at 18px.
- Cart: page heading is "Cart". No "Ready when you are." line.

### 4.3 Pills, badges, frosted glass

- Drop the frosted-glass `backdrop-filter: blur(6px)` pill over product images in [ProductCard.jsx:39-52](client/src/components/ProductCard.jsx#L39-L52). Replace with a small, flat tag at the bottom-left of the card body (not over the image): plain text in `--positive` for discounts ("18% off"), `--ink-3` for "Best seller" — no background fill. Save the chrome for things that are interactive.
- Pills used as category/brand chips on `ProductDetail.jsx` should become inline metadata, not chips. Render as `Brand · Category` in `--ink-3`, 13px, separated by middots.
- Drop `pill--gold`, `pill--ember` styling. Keep `pill` and `pill--accent` if needed at all.

### 4.4 Animated numbers and progress bars

- Remove every `<AnimatedNumber>`. Numbers are static.
- Cart "Savings" hero (`Cart.jsx:165-220`): replace the giant animated savings figure + gradient progress bar + "% off list / Goal: maximum" mono footer with a small, plain block:
  ```
  Subtotal       $312.40
  List price     $389.00
  You save        $76.60   (19.7%)
  ```
  Right-aligned numerics, hairline rule between rows. Drop the bar entirely. Drop the "Goal: maximum" line — this is the AI tell par excellence.
- Value Rankings rank-row score bar (`ValueRankings.jsx:349-380`): drop the gradient. Render the score as plain text (`84.2`) followed by a thin flat bar in `--accent` on `--rule`. Or drop the bar entirely and just show the number — cleaner.

### 4.5 The hero

The current hero on Home (`Home.jsx:42-145`) is the densest concentration of AI tells in the codebase: dark background, two radial-gradient glows, italic-gold word, animated stat counters, gold-CTA search bar, mono-uppercase eyebrow. Rewrite it:

- Background: page background, no gradient, no dark band.
- Headline (serif, 48–56px, regular weight, `--ink`): a short, specific line. Suggested copy:
  > A reading room for 1.4 million products.
- Sub-line (serif, 18px, `--ink-2`, max-width 56ch): one sentence, no superlatives. Suggested copy:
  > Search the catalog, compare categories, and rank products by the weights you care about — rating, review depth, price, momentum.
- One search input. Plain. No gold "Search" button — a single small "Search" button in `--accent` next to it, or even just the input with a subtle "Press Enter" affordance.
- **Delete the stats row.** "1,426,336 products indexed" with counter-up animation is the most AI thing on the page.
- **Delete the four-card "01 / 02 / 03 / 04" entry grid.** Replace with two short paragraphs of editorial prose linking inline to Browse / Analytics / Value Rankings / Cart. Treat the home page like the front page of a magazine, not a SaaS dashboard.
  - Example: *"Start with **Browse** to search by keyword and rating, or jump straight to today's **deals**. **Analytics** breaks down how categories and brands compare across the corpus. **Value Rankings** lets you weight what 'good' means and re-rank the catalog live."*
- "Proven picks" and "Featured deals" sections: keep the data, change the framing.
  - Section heading: just "Proven picks" — drop "Reviewed and loved." subhead.
  - Section heading: just "Under $120" — drop "genuinely good."
  - Drop the right-side "See full rankings" / "Browse all deals" ghost buttons next to the heading. Put a single, small text link below the grid: "More deals →" in `--accent`.

### 4.6 Copy pass — global

Rewrite every line of marketing voice copy. Rules:

1. No metaphors of fire, energy, momentum (delete "catching fire", "what's catching fire", "hot right now").
2. No hedging-as-confidence (delete "actually", "genuinely", "no hype, no filler", "exactly what matters", "ready when you are").
3. No directives to the user (delete "Tune the weights. The ranking responds.").
4. Prefer descriptions of what the page *contains* over what it *does for them*.
5. Imperatives are fine when they're literal ("Search products", "Add to cart").

Concrete replacements:

| File / location | Old | New |
| --- | --- | --- |
| Home headline | "The catalog you can *actually* reason about." | "A reading room for 1.4 million products." |
| Home sub | "Search, compare, and rank 1.4 million products by real value — rating strength, review depth, price efficiency, and momentum. No hype, no filler." | "Search the catalog, compare categories, and rank products by the weights you care about — rating, review depth, price, and recent activity." |
| Home / Proven picks heading | "Reviewed and loved." | "Proven picks" |
| Home / Deals heading | "Under $120, genuinely good." | "Under $120" |
| Browse page heading | "Find exactly what matters." | "Browse" |
| Browse trending heading | "Catching fire in {category}" | "Recent activity in {category}" |
| Browse deals heading | "Discounts, ranked by depth." | "Discounts" |
| Analytics heading | "Signals across the catalog." | "Analytics" |
| Analytics / Categories card | "How they compare" | "Categories compared" |
| Analytics / Brands card | "Top performers" | "Brand leaderboard" |
| Analytics / Reviews trend | "Credibility over time" | "Review credibility over time" — keep, this one is fine. |
| Value Rankings heading | "Tune the weights. The ranking responds." | "Value rankings" |
| Value Rankings sub | "We normalize each dimension to 0–1 per product, scale by your weights, and re-rank the whole catalog live." | Keep — this one is descriptive and fine. |
| Value Rankings / `#1 for your weights` callout | Keep but render in plain `--surface` card, not a dark gradient panel. Heading: "Top result". |
| Cart heading | "Ready when you are." | "Cart" |
| Cart / Savings card | giant animated $ figure + gradient bar + "Goal: maximum" | plain Subtotal / List price / You save table (see §4.4) |
| Empty state on alternatives | "This product is already the Pareto pick." | "No cheaper, higher-rated alternatives in this category." |
| `Σ weights = 1.00 · server renormalizes` mono footer in ValueRankings sidebar | delete (it's developer self-talk) | (remove) |

### 4.7 Header / nav

[client/src/components/Header.jsx](client/src/components/Header.jsx):

- Drop the brand mark — the dark square with an inset gold ring and the letter "A" is straight out of the "AI-designed startup" template. Replace with the wordmark only, set in serif italic at 20px: *Axiom* (or rename — see §6).
- Nav links: sans, 14px, `--ink-2`. Active state is `--ink` and an underline 2px below the text — not a pill background.
- Cart link: same style as other nav links, with the count appended in parentheses: "Cart (3)". Drop the dark pill with the gold badge.
- `QueryModeToggle`: keep functionally, but restyle to a small text toggle ("standard / optimized") in the footer area or in a developer-mode panel — it doesn't belong in the primary nav.
- Header itself: drop the `backdrop-filter: blur` "frosted" effect. Plain `--paper` background with a single `--rule` bottom border. Sticky is fine.

### 4.8 Buttons

- Reduce to two variants:
  - **Primary**: `--accent` background, white text, `--r` radius, 12px / 18px padding. No hover translate. Hover darkens by ~6%.
  - **Quiet**: transparent background, `--ink` text, 1px `--rule-2` border. Same dimensions.
- Delete `btn--gold`, `btn--emerald` (the accent button replaces both).
- Delete the `transform: translateY(-1px)` on hover. It's everywhere and it's an AI tell.
- Delete `btn--block` decoration; just use `width: 100%` inline where needed.

### 4.9 Inputs and sliders

- Inputs: 1px `--rule-2` border, `--r` radius, `--surface` background, no shadow on focus. Focus state is `border-color: --accent` and a 1px inner ring (`box-shadow: inset 0 0 0 1px var(--accent)`), not the soft 3px halo.
- Sliders: track is `--rule`, fill is `--accent`, thumb is `--accent` solid (no white border, no shadow). Drop `transform: scale(1.1)` on hover.

### 4.10 Cards

- 1px `--rule` border, `--r-lg` radius, no shadow.
- Hover: `--rule` → `--rule-2` only. No translate, no shadow.
- Drop `card-hover` translateY and the `sh-3` shadow growth.
- Card-on-dark variants (Value Rankings top result, Cart hero) — convert all to plain `--surface` cards. The whole site has zero dark surfaces in the new system.

### 4.11 Charts

[client/src/components/charts/](client/src/components/charts/):

- Single color across all bar charts: `--accent`. Drop the gold bar in `Analytics.jsx` brands chart.
- Line chart in Analytics: three series colors → (`--ink`, `--accent`, `--ink-3` dashed). The current `--graphite-700` / `--emerald-600` / `--ember-500` palette is fine functionally but feels like a brand pitch deck; the new palette is calmer.
- Axis labels: sans, 11px, `--ink-3`. Drop the mono.
- Gridlines: `--rule`, 1px. No bolder gridlines on axis edges.
- Bar chart values shown above bars: same color as the axis labels, sans 11px, no emphasis.
- Add a 1-line caption *under* each chart explaining what to read from it (e.g. "Top 12 categories by product count. Hover for exact values."). This is the editorial move that actually makes a data page feel human.

---

## 5. Page-by-page change list

The implementer should treat each item below as a discrete edit. After each page is done, the page should pass the smell test in §7 before moving on.

### 5.1 [client/src/pages/Home.jsx](client/src/pages/Home.jsx)

1. Delete `HERO_STATS` (`Home.jsx:9-13`) and the entire stats row (`Home.jsx:117-141`).
2. Replace the dark hero panel (`Home.jsx:42-145`) with a plain section: serif H1, one-sentence sub, search input + small primary button. No background color, no radial gradients, no italic gold word. Apply the new copy from §4.6.
3. Delete the four-card "01/02/03/04" entry grid (`Home.jsx:147-178`) and the `EntryCard` component at the bottom of the file. Replace with two short paragraphs of intro prose linking inline to the four areas (see §4.5).
4. "Proven picks" section (`Home.jsx:180-207`): keep the data fetch, drop the kicker and "See full rankings" right-side button, drop the two-line heading, change heading to plain "Proven picks". Replace the right-side ghost button with a left-aligned `More →` text link below the grid.
5. "Featured deals" section (`Home.jsx:209-238`): same treatment. Heading becomes "Under $120".
6. Remove `stagger` class from the grids.

### 5.2 [client/src/pages/Browse.jsx](client/src/pages/Browse.jsx)

1. Replace the `<eyebrow>Search</eyebrow><h-display>Find exactly what matters.</h-display>` block (`Browse.jsx:87-92`) with a plain `<h1>Browse</h1>`.
2. Filter card (`Browse.jsx:94-149`): drop `card` styling. Render filters as a borderless inline row sitting directly on the page background, separated by ample whitespace. Labels are sans 13px in `--ink-3`, sentence case, no colon-bold mono numerals.
3. Result count line (`Browse.jsx:154-164`): keep, but simplify to just "{n} results". Drop the quoted keyword echo — the input still shows it.
4. Deals section: heading becomes plain "Discounts". Move max-price slider out of the section header into the filter row at the top of the page.
5. Trending section: heading becomes "Recent activity in {category}" with category in `--ink-2`, not `--muted`.
6. Remove all `stagger` class usages.

### 5.3 [client/src/pages/Analytics.jsx](client/src/pages/Analytics.jsx)

1. Replace page header eyebrow + display heading (`Analytics.jsx:82-87`) with `<h1>Analytics</h1>` and a single descriptive paragraph (~25 words).
2. Each chart card: collapse the eyebrow + display heading (`Analytics.jsx:91-95`, `:127-131`, `:166-170`) to a single `<h2>` in serif 22px regular. Subtitles only when the title isn't enough.
3. Metric toggle buttons (`Analytics.jsx:96-106`, `:132-142`): switch from filled-vs-ghost to a plain segmented underline-tab (selected tab has `--accent` underline; others have transparent underline). No filled buttons on the chart card.
4. Chart colors: brand chart switches from `--gold-500` to `--accent`. All charts use the same accent.
5. Add a one-line caption under each chart in `--ink-3`, 13px (see §4.11).

### 5.4 [client/src/pages/ProductDetail.jsx](client/src/pages/ProductDetail.jsx)

1. Hero: drop the gradient background on the image card (`ProductDetail.jsx:74-80`). Plain `--paper-2` placeholder with a thin border.
2. Drop the three pill chips (`ProductDetail.jsx:96-104`) and replace with a single line of metadata directly under the title: `Brand · Category · Best seller` in `--ink-3` 14px, with "Best seller" in `--ink`.
3. Price block (`ProductDetail.jsx:109-128`): drop the "Save $X" `pill--ember` chip. Show the discount inline as plain text: "$89.99 — was $119.99 (25% off)" in serif, with "(25% off)" in `--positive`.
4. Buttons row: primary "Add to cart" in `--accent`. Secondary "View on retailer ↗" in quiet variant. Same dimensions.
5. ASIN line (`ProductDetail.jsx:169-174`): keep, but render in sans 12px `--ink-3` without the mono treatment.
6. Two cards "Ratings / Distribution" and "Reviews / Most helpful" (`ProductDetail.jsx:178-238`): collapse the two-line eyebrow+heading to single-line headings: "Ratings distribution" and "Most helpful reviews".
7. `ReviewItem` (`ProductDetail.jsx:270-318`): drop the surface-alt fill and the rounded card chrome. Render reviews as a vertical list separated by hairline rules (`--rule`). The first line is the rating + verified tag + date; the second is the title in `--ink` semibold serif; then the body paragraph in serif `--ink-2`; then a small footer line in sans 12px `--ink-3` with the helpful count and reviewer stats. Drop the 👍 emoji — say "12 found this helpful".
8. "Smarter picks" section (`ProductDetail.jsx:240-265`): heading "Cheaper, higher-rated alternatives". Empty-state copy from §4.6.

### 5.5 [client/src/pages/ValueRankings.jsx](client/src/pages/ValueRankings.jsx)

1. Page header: replace the eyebrow + display heading + lead block (`ValueRankings.jsx:52-63`) with `<h1>Value rankings</h1>` and the existing explanation paragraph (which is fine — keep verbatim).
2. Sidebar (`ValueRankings.jsx:73-141`): drop the linear gradient background, drop the `--ivory-50` tint. Plain `--surface` card with `--rule` border.
3. Preset buttons: small quiet-variant buttons. Drop the row-wrap pill style.
4. Drop the `Σ weights = 1.00 · server renormalizes` mono footer.
5. Top-result hero card (`ValueRankings.jsx:144-244`): convert the dark gradient panel to a plain `--surface` card. Heading "Top result", product image at left, title + brand + category + price + score at right. Score is plain serif text, no animated number, no gold color.
6. `RankRow` (`ValueRankings.jsx:285-384`): drop the gradient progress bar. Render the score column as plain serif `--ink` text, optionally with a thin flat `--accent` bar of fixed track color `--rule`. Better: drop the bar entirely; show "84.2 / 100" and let the visual ranking come from the row order itself.
7. Remove all `card-hover` translate effects on the rank rows; selected/hover state is `background: --paper-2` only.

### 5.6 [client/src/pages/Cart.jsx](client/src/pages/Cart.jsx)

1. Page header: `<h1>Cart</h1>`. Drop the eyebrow + "Ready when you are." line.
2. Item rows (`Cart.jsx:84-162`): drop the card chrome on each row; render as a flat list separated by hairline rules. Image at 80×80 with `--paper-2` placeholder, no gradient. Remove button is a small text-link "Remove" in `--ink-3`, not a button.
3. Summary aside (`Cart.jsx:165-256`):
   - Drop the gradient background.
   - Drop the giant animated savings number.
   - Drop the gradient progress bar.
   - Drop the `Goal: maximum` mono line.
   - Drop "Recalculating…" text — if you must show loading, show it as a faint dot indicator next to the heading.
   - Replace the whole block with a simple receipt-style table (see §4.4).
4. Checkout button: primary accent, full width, "Checkout" (drop the "(demo)" suffix — it's chatter; if needed, render a small `--ink-3` line below saying "Demo only — no order is placed.").

### 5.7 [client/src/components/ProductCard.jsx](client/src/components/ProductCard.jsx)

1. Drop the frosted-glass pill over the image. Move badge to card body.
2. Drop the `card-hover` translate; keep only the border-color change.
3. Image hover scale (`product-card:hover .product-media img`): drop. Subtle but reads as "ecommerce template."
4. Card body: title in serif `--ink` regular weight 16px, brand + category in sans 13px `--ink-3` on a single line with middot separator (drop the eyebrow class on category).
5. Price: serif `--ink` 18px, no display-font flourish. Strikethrough list price stays, in `--ink-3` 13px.
6. Rating: stars in `--ink-2`, count in sans 12px `--ink-3`. Drop the gold star color — stars are filled `--ink-2`, half-stars use the same color. The visual interest comes from typography, not from a gold accent.

### 5.8 [client/src/components/Footer.jsx](client/src/components/Footer.jsx)

(Not read in detail above — apply the same principles: plain text, sans 13px, `--ink-3`, single hairline top border, no gradients or pills. Move the `QueryModeToggle` here as a small footer-right control labeled "SQL mode: standard / optimized".)

### 5.9 [client/src/components/States.jsx](client/src/components/States.jsx)

- `Empty`: icon-less, just a centered paragraph in `--ink-3` serif italic. Optional action button below.
- `ErrorBanner`: drop the dashed border and salmon tint. Render as a single line of `--negative` text with a small `--negative` left border (3px) on a `--paper-2` background. No emoji, no all-caps.
- `SkeletonGrid`: keep the shimmer but use `--rule` to `--rule-2` instead of the dark-on-ivory shimmer — softer.

### 5.10 [client/src/components/AnimatedNumber.jsx](client/src/components/AnimatedNumber.jsx)

Delete. Replace every import with the static formatted value. Files to update: `Home.jsx`, `Cart.jsx`, `ValueRankings.jsx`.

---

## 6. Naming and identity

The site is currently called "Axiom" with a dark-square + gold-ring + letter-A logo (`Header.jsx:11-12`). "Axiom" + dark monogram is itself an AI cliché — every LLM-designed B2B tool is called Axiom, Atlas, Orbit, Lumen, or Helix.

Two acceptable paths:

- **Path A (low-effort):** keep "Axiom" but kill the monogram. Wordmark only, set in italic serif: *Axiom*.
- **Path B (preferred):** rename to something specific to the project. Suggestions: *The Catalog Reader*, *Shelf*, *Ledger*, *Fieldnotes*. Pick something that sounds like a publication or a notebook, not a startup. The course is CIS 5500; this is allowed to feel academic.

The implementer should default to Path A and leave a TODO comment near the wordmark suggesting Path B for the team to decide.

---

## 7. Smell test — when is the page done?

After editing each page, walk this checklist. If any answer is "yes", keep editing.

1. Is there a gradient anywhere on screen (radial, linear, conic)? → remove it.
2. Is there an uppercase, letter-spaced, mono-set kicker label? → either remove it, or convert to plain sentence-case sans.
3. Is any number animating from 0 to its value? → make it static.
4. Does any element grow, lift, or shadow on hover? → reduce to a border-color or background change.
5. Does the page have more than two colors that aren't black-ish, white-ish, or `--accent`? → cut.
6. Are there decorative pills with frosted-glass blur? → remove.
7. Is the headline a marketing phrase ("genuinely good", "actually", "ready when you are", "catching fire")? → rewrite as a description.
8. Does the eye land on chrome (a button, a glow, a stat counter) before it lands on the data (a product, a chart, a price)? → invert.
9. Are there entrance animations on a grid? → remove `stagger` / `fade-in` / `rise-in`.
10. Is there a counter, sigma symbol, or developer-self-talk in user-facing copy? → remove.

---

## 8. Implementation order

1. Rewrite [client/src/styles/index.css](client/src/styles/index.css) with the new tokens and component styles. Keep the same class names where possible so existing JSX still works during the transition; delete classes that have no place in the new system (e.g. `eyebrow`, `h-display--xl`, `pill--gold`, `btn--gold`, `btn--emerald`, `stagger`, `fade-in`, `rise-in`).
2. Delete [client/src/components/AnimatedNumber.jsx](client/src/components/AnimatedNumber.jsx) and remove its imports.
3. Edit [client/src/components/Header.jsx](client/src/components/Header.jsx) and [Footer.jsx](client/src/components/Footer.jsx) — chrome first.
4. Edit [client/src/components/ProductCard.jsx](client/src/components/ProductCard.jsx), [Rating.jsx](client/src/components/Rating.jsx), [States.jsx](client/src/components/States.jsx), and the chart components — shared building blocks next.
5. Edit pages in this order: Home, Browse, ProductDetail, Analytics, ValueRankings, Cart. Apply the page-specific changes from §5.
6. Do a global grep for the strings "actually", "genuinely", "catching fire", "ready when you are", "no hype", "exactly what matters", "Reviewed and loved", "Σ", "Goal: maximum", "Tune the weights" — every match is a defect.
7. Do a global grep for `linear-gradient` and `radial-gradient` in JSX inline styles. Every match is a defect.
8. Do a global grep for `text-num`, `eyebrow`, `h-display`, `stagger`, `fade-in`, `rise-in`. Each remaining usage must be reviewed for whether it survives the new system.
9. Build and visually inspect every page in the browser. Run the §7 smell test on each page.

## 9. What to leave alone

- Routing, data fetching, API client, cart context, server, and SQL — all out of scope. UI only.
- Information density and the actual data shown on each page. The point of this overhaul is to *reveal* the data more cleanly, not to cut it.
- The Value Rankings interaction (sliders → live re-rank). It's the strongest concept on the site; preserve its behavior, just quiet down its presentation.
- The chart components' SVG structure. Restyle, don't restructure.

---

## 10. One-line summary for the implementer

Make it look like the work of one person who reads a lot, not the output of a templating system that has heard of "premium."
