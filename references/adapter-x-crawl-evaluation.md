# x-crawl Adapter Evaluation

`x-crawl` is a capable Node.js crawler library for static pages, dynamic pages, API calls, retries, delays, proxies, and optional AI-assisted parsing.

Decision for v1:

- Do not make `x-crawl` the default crawler path.
- Prefer Chrome page-context capture because it reuses the user's logged-in Bilibili session without exporting cookies.
- Keep `x-crawl` as a future optional adapter for public metadata enrichment or fallback dynamic-page scraping.

Reasons:

- Bilibili favorites require authenticated account context.
- A generic crawler adds dependency and browser-context complexity.
- The Planner only needs stable local JSONL artifacts, not a crawler framework.
- Anti-crawling behavior changes faster than the Planner/Executor contract.
