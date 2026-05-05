-- These views have unique indexes, so CONCURRENTLY keeps the read paths usable
-- while the refreshed data is swapped in.
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_value_score_components;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_compare;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_brand_performance;
