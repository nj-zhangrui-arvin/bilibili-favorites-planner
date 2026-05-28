# Crawler Contract

The crawler output is a local, read-only artifact consumed by `bilibili-favorites-planner`.

Recommended files:

- `inventory.jsonl`: one row per favorite-folder membership.
- `evidence.jsonl`: same shape, optionally enriched with tags, partition, description, or availability details.
- `crawl-summary.md`: human-readable crawl result.

Each JSONL row should contain:

- `bvid`: required when the video is trackable.
- `aid`: required for executable Planner rows; may be empty for unavailable rows.
- `title`: video title.
- `url`: video URL.
- `uploader`: uploader display name.
- `source_folders`: array of `{ "folder_name": "...", "folder_id": "..." }`.
- `tags`: array of strings, optional but useful for review.
- `partition`: optional Bilibili partition/category.
- `description`: optional video description.
- `invalid_or_unavailable`: boolean.
- `fetch_status`: `ok`, `invalid`, `unavailable`, or `error`.

Rules:

- Do not include Cookie, SESSDATA, csrf, or account credentials.
- Keep one row per video-folder membership before normalization; downstream tools may dedupe by `bvid`.
- Missing `aid` or source folder id means Planner should mark the row `untrackable`.
- Crawler must not classify videos or generate Executor task packages.
