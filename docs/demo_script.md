# Ultra-Short 4-Minute Demo Script

Use jump cuts and let the screen do more of the work. Speak only what the
feature is, what query powers it, and what optimization mattered. Put exact
milliseconds in small on-screen captions instead of saying them.

Leave optimized mode on for the main recording.

| Time | Motion | Say | Tiny on-screen caption |
|---:|---|---|---|
| 0:00-0:12 | Open Home. Hover over the optimized toggle. Scroll just enough to show Proven picks and Under $120. | "This is Axiom. I'm demoing in optimized mode, so the app is using our indexed, cached, and materialized-view query paths." | Optimized mode: `?optimized=1` |
| 0:12-0:32 | Click Browse. Type `kasa`. Drag Minimum rating to 4.0. | "Browse uses a keyword search query over product titles with a minimum star filter. We optimized substring search with a trigram title index." | Title search: trigram index |
| 0:32-0:45 | Click a category chip or See all on a category card. Drag Max price once. | "Category pages use paginated category queries. The optimized version pages products first, then joins the extra display fields." | Page first, join later |
| 0:45-1:20 | Click one product. Point at the header rating, Ratings distribution, Most helpful reviews, and Cheaper alternatives. Click Add to cart. | "Product detail combines metadata with rating distribution, helpful reviews, and alternatives. The header rating uses the linked histogram when catalog review counts are missing. Helpful reviews was a major win, about 1,300x faster, because we rank the top reviews first and compute reviewer stats after. Alternatives improved by about 11x." | Helpful reviews: `9118.3 ms -> 7.1 ms` |
| 1:20-1:32 | Click the brand link under the product title. Drag Minimum rating once. | "Brand pages use the same paginated pattern as category browsing, but filtered by brand." | Brand browse: paginated SQL |
| 1:32-1:45 | Click Cart. Pause on the Savings card. | "Cart runs one aggregate query over selected ASINs to compute subtotal, list price, and savings. This route was already simple and fast." | Cart: ASIN aggregate |
| 1:45-2:00 | Click Deals. Drag Max price or Minimum rating once. | "Deals ranks products by discount percentage. We optimized it with a partial expression index on the discount formula, so it was already very efficient." | Deals: partial discount index |
| 2:00-2:40 | Click Analytics. Click Average rating in the category chart. Scroll to Brand leaderboard. Change the category dropdown once in the review trend section. | "Analytics contains our heaviest aggregate queries. Category comparison moved to a materialized view and improved by about 8,000x. Brand performance also moved to a materialized view and improved by about 640x. Review trend uses a reviewer-credibility query, and its main optimization is caching repeated requests." | Category: `3113.5 -> 0.4 ms`; Brand: `2366.2 -> 3.7 ms` |
| 2:40-3:10 | Click Value rankings. Click Price first, then Recent activity, then move one slider slightly. | "Value Rankings computes a weighted score from rating, review depth, price efficiency, and recent activity. The optimized version uses a materialized view with precomputed normalized values, and it improved by about 12,000x." | Value rankings: `17047.1 -> 1.4 ms` |
| 3:10-3:28 | Scroll to Top value products. Change Reviewed since from `2018-01-01` to another date, then pause on the cards. | "Top value compares products to category average price, category average rating, and recent review activity. Its optimized path uses the value materialized view and improved by about 380x." | Top value: `324918.8 -> 855.3 ms` |
| 3:28-3:40 | Hold on the app or jump to a simple benchmark caption. | "Across the app, our main optimization patterns were indexes, query rewrites, caching, and materialized views." | Main patterns: indexes, rewrites, cache, MVs |

This leaves about 20 seconds of buffer before the 4-minute cutoff. Do not show
raw JSON. If a page is slow on the network, keep narrating the query and move as
soon as the visible state loads.
