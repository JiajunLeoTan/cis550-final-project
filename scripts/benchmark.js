#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pool = require('../server/db');
const {
  listCategoriesQuery,
  listBrandsQuery,
  getProductDetailQuery,
  listCategoriesQueryOptimized,
  listBrandsQueryOptimized,
  getProductDetailQueryOptimized
} = require('../server/queries/meta.sql');
const {
  searchProductsQuery,
  dealsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  topValueProductsQuery,
  valueRankingsQuery,
  searchProductsQueryOptimized,
  dealsQueryOptimized,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized,
  trendingProductsQueryOptimized,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
} = require('../server/queries/products');
const {
  cartSavingsQuery,
  cartSavingsQueryOptimized
} = require('../server/queries/cart.sql');
const {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery,
  categoriesCompareQueryOptimized,
  brandsPerformanceQueryOptimized,
  reviewsTrendQueryOptimized
} = require('../server/queries/analytics.sql');

const DOCS_DIR = path.resolve(__dirname, '../docs');
const BENCHMARK_DIR = path.join(DOCS_DIR, 'benchmarks');
const EXPLAIN_DIR = path.join(BENCHMARK_DIR, 'explain');
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return fallback;
}

function cleanSql(sql) {
  return sql.trim().replace(/;+\s*$/, '');
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function summarize(runs) {
  const executionTimes = runs.map((run) => run.executionMs).filter(Number.isFinite);
  const costs = runs.map((run) => run.totalCost).filter(Number.isFinite);
  return {
    runs,
    minMs: executionTimes.length ? Math.min(...executionTimes) : null,
    medianMs: median(executionTimes),
    maxMs: executionTimes.length ? Math.max(...executionTimes) : null,
    totalCost: costs.length ? costs[costs.length - 1] : null
  };
}

async function explainAnalyze(sql, params) {
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${cleanSql(sql)}`;
  const { rows } = await pool.query(explainSql, params);
  const explain = rows[0]['QUERY PLAN'][0];
  return {
    executionMs: explain['Execution Time'],
    planningMs: explain['Planning Time'],
    totalCost: explain.Plan['Total Cost'],
    plan: explain
  };
}

async function runMode(sql, params, runs = MEASURED_RUNS) {
  const warmupRuns = [];
  for (let i = 0; i < WARMUP_RUNS; i += 1) {
    warmupRuns.push(await explainAnalyze(sql, params));
  }

  await sleep(1000);

  const results = [];
  for (let i = 0; i < runs; i += 1) {
    results.push(await explainAnalyze(sql, params));
  }

  return {
    ...summarize(results),
    warmupRuns
  };
}

function chooseKeyword(title) {
  if (!title) {
    return 'hair';
  }

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !['with', 'from', 'pack', 'inch'].includes(word));

  return words[0] || 'hair';
}

async function representativeInputs() {
  const categoryResult = await pool.query(`
    SELECT c.category_name, COUNT(r.review_id)::int AS review_count
    FROM categories c
    JOIN products p ON p.category_id = c.category_id
    LEFT JOIN reviews r ON r.asin = p.asin
    GROUP BY c.category_id, c.category_name
    ORDER BY COUNT(r.review_id) DESC, c.category_name ASC
    LIMIT 1
  `);

  const asinResult = await pool.query(`
    SELECT p.asin, p.title, COUNT(r.review_id)::int AS review_count
    FROM products p
    LEFT JOIN reviews r ON r.asin = p.asin
    GROUP BY p.asin, p.title
    HAVING COUNT(r.review_id) > 50
    ORDER BY COUNT(r.review_id) DESC, p.asin ASC
    LIMIT 1
  `);

  const fallbackAsinResult = asinResult.rows.length > 0
    ? asinResult
    : await pool.query(`
      SELECT asin, title, 0::int AS review_count
      FROM products
      ORDER BY review_count DESC NULLS LAST, asin ASC
      LIMIT 1
    `);

  const cartResult = await pool.query(`
    SELECT asin
    FROM products
    WHERE price IS NOT NULL
    ORDER BY review_count DESC NULLS LAST, asin ASC
    LIMIT 5
  `);

  const category = categoryResult.rows[0]?.category_name || 'Beauty & Personal Care';
  const asin = fallbackAsinResult.rows[0]?.asin || 'B014TMV5YE';
  const title = fallbackAsinResult.rows[0]?.title || '';
  const cartAsins = cartResult.rows.map((row) => row.asin);

  return {
    category,
    asin,
    keyword: chooseKeyword(title),
    maxPrice: 250,
    months: 3,
    reviewedSince: '2018-01-01',
    cartAsins,
    weights: [0.4, 0.2, 0.2, 0.2]
  };
}

function buildBenchmarks(input) {
  return [
    {
      query: 'GET /categories',
      input: 'none',
      preSql: listCategoriesQuery,
      postSql: listCategoriesQueryOptimized,
      params: []
    },
    {
      query: 'GET /brands',
      input: 'none',
      preSql: listBrandsQuery,
      postSql: listBrandsQueryOptimized,
      params: []
    },
    {
      query: 'GET /products/:asin',
      input: `asin=${input.asin}`,
      preSql: getProductDetailQuery,
      postSql: getProductDetailQueryOptimized,
      params: [input.asin]
    },
    {
      query: 'GET /products/search',
      input: `keyword=${input.keyword}, minStars=4`,
      preSql: searchProductsQuery,
      postSql: searchProductsQueryOptimized,
      params: [input.keyword, 4]
    },
    {
      query: 'GET /deals',
      input: `maxPrice=${input.maxPrice}`,
      preSql: dealsQuery,
      postSql: dealsQueryOptimized,
      params: [input.maxPrice]
    },
    {
      query: 'GET /products/:asin/rating-distribution',
      input: `asin=${input.asin}`,
      preSql: ratingDistributionQuery,
      postSql: ratingDistributionQueryOptimized,
      params: [input.asin]
    },
    {
      query: 'GET /products/:asin/helpful-reviews',
      input: `asin=${input.asin}`,
      preSql: helpfulReviewsQuery,
      postSql: helpfulReviewsQueryOptimized,
      params: [input.asin]
    },
    {
      query: 'GET /products/:asin/alternatives',
      input: `asin=${input.asin}`,
      preSql: alternativesQuery,
      postSql: alternativesQueryOptimized,
      params: [input.asin]
    },
    {
      query: 'POST /cart/savings',
      input: `asins=${input.cartAsins.join(',')}`,
      preSql: cartSavingsQuery,
      postSql: cartSavingsQueryOptimized,
      params: [input.cartAsins]
    },
    {
      query: 'GET /analytics/categories/compare',
      input: 'none',
      preSql: categoriesCompareQuery,
      postSql: categoriesCompareQueryOptimized,
      params: []
    },
    {
      query: 'GET /products/trending',
      input: `category=${input.category}, months=${input.months}`,
      preSql: trendingProductsQuery,
      postSql: trendingProductsQueryOptimized,
      params: [input.category, input.months]
    },
    {
      query: 'GET /products/top-value',
      input: `reviewedSince=${input.reviewedSince}`,
      preSql: topValueProductsQuery,
      postSql: topValueProductsQueryOptimized,
      params: [input.reviewedSince]
    },
    {
      query: 'GET /analytics/brands/performance',
      input: 'none',
      preSql: brandsPerformanceQuery,
      postSql: brandsPerformanceQueryOptimized,
      params: []
    },
    {
      query: 'GET /analytics/reviews/trend',
      input: `category=${input.category}`,
      preSql: reviewsTrendQuery,
      postSql: reviewsTrendQueryOptimized,
      params: [input.category]
    },
    {
      query: 'GET /products/value-rankings',
      input: `weights=${input.weights.join('/')}`,
      preSql: valueRankingsQuery,
      postSql: valueRankingsQueryOptimized,
      params: input.weights
    }
  ];
}

function formatMs(summary) {
  if (!summary || summary.error || summary.minMs === null) {
    return 'ERROR';
  }
  return `${summary.minMs.toFixed(1)} / ${summary.medianMs.toFixed(1)} / ${summary.maxMs.toFixed(1)}`;
}

function formatRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 'n/a';
  }
  return `${(numerator / denominator).toFixed(2)}x`;
}

function formatSpeedup(pre, post) {
  if (!pre?.medianMs || !post?.medianMs) {
    return 'n/a';
  }

  if (Math.abs(pre.medianMs - post.medianMs) < 0.5) {
    return '1.00x';
  }

  return `${(pre.medianMs / post.medianMs).toFixed(2)}x`;
}

function loadBaseline(phase) {
  if (!phase) {
    return null;
  }

  const baselinePath = path.join(BENCHMARK_DIR, `${phase}.json`);
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline file not found: ${baselinePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return new Map(parsed.results.map((result) => [result.query, result]));
}

function writeMarkdown(phase, results, baseline) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const lines = [
    '# Query Performance Timings',
    '',
    `Generated by \`node scripts/benchmark.js --phase ${phase}\`.`,
    '',
    `Timing cells are \`min / median / max\` milliseconds across ${MEASURED_RUNS} measured \`EXPLAIN ANALYZE\` runs after ${WARMUP_RUNS} discarded warmup run and a 1-second pause. When a baseline phase is supplied, \`pre-opt ms\` is read from that baseline and \`post-opt ms\` is read from the current phase.`,
    '',
    '| query | input | pre-opt ms | post-opt ms | speedup | EXPLAIN cost ratio |',
    '|---|---|---:|---:|---:|---:|'
  ];

  for (const result of results) {
    const baselineResult = baseline?.get(result.query);
    const pre = baselineResult?.pre || result.pre;
    const post = result.post;
    const speedup = formatSpeedup(pre, post);
    const costRatio = formatRatio(pre?.totalCost, post?.totalCost);
    lines.push([
      result.query,
      result.input.replace(/\|/g, '\\|'),
      formatMs(pre),
      formatMs(post),
      speedup,
      costRatio
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push('');
  lines.push('Representative inputs are selected from the loaded database: the category with the most linked reviews, an ASIN with more than 50 reviews when available, and fixed weights `0.4/0.2/0.2/0.2` for value ranking.');

  fs.writeFileSync(path.join(DOCS_DIR, 'timings.md'), `${lines.join('\n')}\n`);
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function writeExplainOutputs(phase, results) {
  fs.mkdirSync(EXPLAIN_DIR, { recursive: true });

  for (const result of results) {
    if (result.post?.runs?.[0]?.plan) {
      fs.writeFileSync(
        path.join(EXPLAIN_DIR, `${phase}-${safeName(result.query)}-optimized.json`),
        `${JSON.stringify(result.post.runs[0].plan, null, 2)}\n`
      );
    }
    if (result.pre?.runs?.[0]?.plan) {
      fs.writeFileSync(
        path.join(EXPLAIN_DIR, `${phase}-${safeName(result.query)}-original.json`),
        `${JSON.stringify(result.pre.runs[0].plan, null, 2)}\n`
      );
    }
  }
}

async function main() {
  const phase = argValue('--phase', 'current');
  const baselinePhase = argValue('--baseline', null);
  const baseline = loadBaseline(baselinePhase);

  fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
  fs.mkdirSync(EXPLAIN_DIR, { recursive: true });

  const input = await representativeInputs();
  const benchmarks = buildBenchmarks(input);
  const results = [];

  for (const benchmark of benchmarks) {
    process.stdout.write(`Benchmarking ${benchmark.query}... `);
    try {
      const pre = await runMode(benchmark.preSql, benchmark.params);
      const post = await runMode(benchmark.postSql, benchmark.params);
      results.push({ ...benchmark, pre, post });
      process.stdout.write(`pre ${formatMs(pre)} ms, post ${formatMs(post)} ms\n`);
    } catch (err) {
      const error = { error: err.message, runs: [], warmupRuns: [], minMs: null, medianMs: null, maxMs: null, totalCost: null };
      results.push({ ...benchmark, pre: error, post: error });
      process.stdout.write(`ERROR: ${err.message}\n`);
    }
  }

  const output = {
    phase,
    generatedAt: new Date().toISOString(),
    input,
    results
  };

  fs.writeFileSync(
    path.join(BENCHMARK_DIR, `${phase}.json`),
    `${JSON.stringify(output, null, 2)}\n`
  );
  writeExplainOutputs(phase, results);
  writeMarkdown(phase, results, baseline);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
