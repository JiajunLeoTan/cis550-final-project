# Four-Minute Demo Script

Use optimized mode for the main run. Keep the query-mode toggle visible near the
start so it is clear that the app can switch between standard and optimized
paths, then leave it on optimized for timing.

| Time | Motion | Narration |
|---:|---|---|
| 0:00-0:20 | Open Home. Point at the query-mode toggle. Run one keyword search. | "This is Axiom, a shopping analytics app over Amazon products and reviews. The frontend calls the same API routes in standard or optimized mode; for the demo I am keeping optimized on." |
| 0:20-0:55 | Open a search result product. Show rating distribution, helpful reviews, and alternatives. | "The product page combines lookup, review histogram, helpful reviews, reviewer context, and cheaper alternatives. Helpful reviews improved by about 1,300x by ranking the target product's reviews before computing reviewer stats." |
| 0:55-1:15 | Add product to cart. Open Cart. | "The cart route aggregates selected ASINs into list price, current price, and total savings, with validation on the submitted ASIN array." |
| 1:15-1:55 | Open Deals. Adjust max price or min stars. | "Deals ranks valid discounts from list price to current price, then filters by price and rating. A partial discount expression index keeps this route effectively instant in the demo." |
| 1:55-2:40 | Open Analytics. Briefly show category compare, brand performance, and review trend. | "Analytics is where the big aggregate queries are visible. Category comparison improved by about 8,000x using a materialized category summary. Brand performance improved by about 640x with a materialized brand summary. Review trend groups monthly reviews by reviewer credibility and uses caching for repeat category reads." |
| 2:40-3:35 | Open Value rankings. Move one slider or select a preset. Scroll to Top value products. Change Reviewed since from 2018-01-01 to another date. | "Value rankings normalizes rating, review count, price efficiency, and recent activity into a weighted score. The Balanced preset uses an indexed default score and improved by about 12,000x. This lower section is Top value products. It compares products against category average price, category average rating, and recent review activity; its optimized path uses the value materialized view and improved by about 380x." |
| 3:35-4:00 | Return briefly to Home or the report timing table. End on deployed app URL. | "The same pages are backed by parameterized Express routes, PostgreSQL indexes, materialized views, and a small cache where repeat reads matter. That is the full app path we submitted." |

Do not pause on raw JSON during the recording. If a page is slow on the network,
keep narrating the query and move as soon as the visible state loads.
