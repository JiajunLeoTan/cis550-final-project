Reorganization Plan — Axiom Shopping Assistant
What the rubric/guidelines explicitly demand from the layout
Requirement	Source	Currently satisfied?
Clear and organized folder structure (1 pt)	Rubric → Code Quality	Partially — root is cluttered, two data/ trees, build artifacts checked in
Multiple files for components / routes / config / apis (2 pts)	Rubric → Code Quality	Yes — server/routes, server/queries, client/src/{pages,components} already split
Comments and documentation (2 pts)	Rubric → Code Quality	Patchy — needs a top-level README that documents every directory
README describing project + each directory	Guidelines → Milestone 3	Current README documents some dirs but not all
Final report, demo script, ER diagram, perf timings	Guidelines → Milestone 5	All present in docs/ but mixed with WIP planning notes
Application code zip with deps + cleaning scripts + README	Guidelines → Milestone 5	Achievable, but build artifacts and __pycache__ would currently be included
What's actually messy
Root clutter: fix_plan.md, perf_plan.md, .codex (empty), three reference PDFs, setup.sh all live alongside the README.
Two data/ trees: real data in data/, and a vestigial empty scripts/data/cleaned/ that nothing writes to.
scripts/ mixes four concerns (data pipeline, DB DDL, benchmarking, one-off exploration) with no subfolders — and ships scripts/pycache/ into git.
client/dist/ build output is committed — pollutes diffs, will get re-zipped in the Milestone 5 submission.
notebooks/ is empty but graders looking for EDA evidence (Milestone 1 requirement) will find nothing.
docs/ mixes deliverables with working notes: docs/ui-overhaul-plan.md (394 lines of WIP) sits next to docs/final_report.tex, docs/slides.pdf, docs/er_diagram.svg.
server/queries/products.sql.js is 806 lines — single file holding ~10 queries; hard to navigate.
venv/ committed.
CIS5500_Milestone4_API_Spec.pdf is a deliverable, not reference material — belongs with the other deliverables.
Proposed target layout
cis550-final-project/
├── README.md                      ← rewrite: project pitch, stack, quick start, full dir map
├── LICENSE
├── .gitignore                     ← add: dist/, __pycache__/, venv/, .env, *.pyc
├── .env.example
├── package.json                   ← root = backend
├── package-lock.json
├── requirements.txt
├── setup.sh
│
├── client/                        ← frontend (unchanged structure, dist/ removed)
│   ├── README.md
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── api/
│       ├── components/{,charts/}
│       ├── context/
│       ├── pages/
│       ├── styles/
│       └── utils/
│
├── server/                        ← Express API (mostly unchanged)
│   ├── README.md
│   ├── index.js
│   ├── config.js
│   ├── db.js
│   ├── cache.js
│   ├── routes/   {analytics,cart,meta,products}.js
│   └── queries/  {analytics,cart,meta,products}.sql.js
│        └── SPLIT products.sql.js into: products/{search,detail,trending,
│                                        value,alternatives,reviews}.sql.js
│
├── database/                      ← NEW: everything DB-shaped, today scattered in scripts/
│   ├── schema.sql                 (← scripts/schema.sql)
│   ├── perf_ddl.sql               (← scripts/perf_ddl.sql; indexes + matviews)
│   ├── refresh_matviews.sql       (← scripts/refresh_matviews.sql)
│   └── README.md                  ← document tables, indexes, 3NF justification
│
├── data_pipeline/                 ← NEW: rename of cleaning/ingest scripts
│   ├── README.md
│   ├── clean_data.py              (← scripts/clean_data.py)
│   ├── ingest_data.py             (← scripts/ingest_data.py)
│   └── create_guest_user.py       (← scripts/create_guest_user.py)
│
├── scripts/                       ← keep ONLY operational JS utilities
│   ├── benchmark.js
│   ├── refresh_matviews.js
│   ├── run_sql.js
│   └── top_reviewed.js            (or delete if unused)
│
├── data/                          ← unchanged shape
│   ├── raw/        amazon_{products,reviews,categories}.csv
│   └── cleaned/    {brands,categories,outliers,products,reviews,users}.csv
│   (DELETE scripts/data/cleaned/ — empty, redundant)
│
├── notebooks/                     ← put the EDA notebook here (Milestone 1 evidence)
│   └── eda.ipynb                  (write a small one if missing)
│
└── docs/                          ← deliverables and reference, separated
    ├── final_report.tex
    ├── final_report.pdf           (build target)
    ├── slides.md / slides.pdf
    ├── demo_script.md
    ├── er_diagram.{svg,png}
    ├── timings.md                 ← pre/post optimization table (rubric requires this)
    ├── api_spec.pdf               (← CIS5500_Milestone4_API_Spec.pdf from root)
    ├── benchmarks/                ← raw JSON outputs (already here)
    ├── reference/                 ← course-provided PDFs
    │   ├── rubric.pdf
    │   └── guidelines.pdf
    └── planning/                  ← WIP notes; not a deliverable, but kept for history
        ├── fix_plan.md            (← root)
        ├── perf_plan.md           (← root)
        └── ui-overhaul-plan.md    (← docs/)
Concrete actions, in order
Update .gitignore to cover client/dist/, **/__pycache__/, venv/, .env, *.pyc, .codex. Then git rm -r --cached the offenders.
Create database/, move scripts/{schema,perf_ddl,refresh_matviews}.sql into it. Update any path references in scripts/benchmark.js, scripts/refresh_matviews.js, ingest scripts, and READMEs.
Create data_pipeline/, move scripts/{clean_data,ingest_data,create_guest_user}.py. Update README.md commands (./venv/bin/python data_pipeline/clean_data.py).
Delete scripts/data/ (empty vestige).
Move PDFs: CIS5500_Milestone4_API_Spec.pdf → docs/api_spec.pdf; both course PDFs → docs/reference/.
Move planning notes: fix_plan.md, perf_plan.md, docs/ui-overhaul-plan.md → docs/planning/.
Split server/queries/products.sql.js (806 lines) into server/queries/products/{search,detail,trending,value,alternatives,reviews}.sql.js with a barrel index.js. Update server/routes/products.js imports.
Add a placeholder notebooks/eda.ipynb documenting summary stats from the cleaning pipeline (or delete the dir if we won't fill it).
Rewrite README.md to include: title, problem statement, dataset summary, stack, full directory map with one-line description per top-level folder, run instructions, deployment notes, group members. This directly serves the "README describing each directory" guideline and the Code Quality "documentation" rubric line.
Add a short database/README.md and data_pipeline/README.md explaining each file's role — multiple READMEs reinforce the "comments and documentation" rubric line.
Verify with npm run dev, cd client && npm run dev, node scripts/benchmark.js --phase post-index, and one ingest dry-run that nothing path-broke.
What I'm intentionally NOT doing
Not renaming server/queries/*.sql.js — the convention is consistent and routes already import them.
Not restructuring client/src/ — pages/components/api/context/utils split already matches the rubric ask.
Not deleting notebooks/ outright in case you want EDA evidence; flagged for a decision.
Not touching the actual SQL inside queries — reorganization only.

I need real EDA notebook. OK to split products.sql.js. Delete top_reviewed.js. Move the rubric/guidelines PDFs into docs/reference/

Heres what the last AI agent got to:


Update .gitignore and untrack .codex done 

Create database/ and move SQL files done

Create data_pipeline/ and move Python scripts done

Delete scripts/data/ and scripts/top_reviewed.js done

Move PDFs to docs/reference/ and docs/api_spec.pdf done

Move planning notes to docs/planning/ done

Split server/queries/products.sql.js into products/ subfolder done

Update path references in scripts and READMEs working on

Add notebooks/eda.ipynb with real EDA not yet

Rewrite root README.md with full directory map not yet

Add database/README.md and data_pipeline/README.md not yet 

Verify with smoke checks not yet

The last agent was cut short Now updating path references. The Python scripts reference scripts/schema.sql and scripts/clean_data.py, the JS scripts reference refresh_matviews.sql, and the analytics SQL comments reference paths.

Pick up where it's left off.