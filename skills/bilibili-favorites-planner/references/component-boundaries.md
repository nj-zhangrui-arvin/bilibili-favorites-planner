# Component Boundaries

The planner is the analysis layer. It must stay separate from Bilibili crawling and Executor writes.

## Crawler

Responsibility:
- Read Bilibili favorites and video metadata.
- Handle page/API changes, anti-crawling behavior, login state, request pacing, and extractor updates.
- Output local files such as `inventory.json`, `inventory.jsonl`, `evidence.jsonl`, or an equivalent normalized export.

The crawler may be:
- an external open-source tool
- a browser export
- a separate local script
- the older `bilibili-video-organizer` capture pipeline

The planner must not depend on one crawler implementation. Treat crawler output as an input artifact.

## Analyzer / Planner

Responsibility:
- Read local crawler output only.
- Normalize records into `classification-review.jsonl`.
- Suggest target folders using rules or model output.
- Provide the local HTML review page.
- Summarize reviewed rows.
- Build Executor-compatible `task-package.json`.

The analyzer should be model-switchable later. Keep classification logic isolated from crawling so the model layer can move from rules to OpenAI, Gemini, local models, or other providers without touching crawler code.

## Executor

Responsibility:
- Import reviewed task packages.
- Create missing target folders when the user chooses to.
- Execute `move` and `copy` tasks in the Bilibili page context.
- Provide maintenance tools for cleanup and folder deletion.

The planner must not delete, rename, or create real Bilibili folders.

## Data Contract

Crawler output should provide as many of these fields as possible:

- `bvid`
- `aid` or `stat.aid`
- `title`
- `url`
- `uploader`
- `source_folders`
- `tags`
- `partition`
- `description`
- `invalid_or_unavailable`

Missing optional fields are acceptable. Missing `aid` or source folder id should be marked `untrackable` by the analyzer and kept out of executable task generation until repaired.
