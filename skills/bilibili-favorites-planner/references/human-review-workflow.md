# Human Review Workflow

Human review is the boundary between AI classification and executable migration tasks.

## File Shape

Use JSONL: one JSON object per line. Recommended filename:

```text
classification-review.jsonl
```

Each row represents one video and keeps both machine suggestions and human-editable fields.

Required fields:
- `bvid`
- `aid`
- `title`
- `url`
- `uploader`
- `source_folders`
- `suggested_primary_folder`
- `suggested_secondary_folders`
- `confidence`
- `reason`
- `review_status`
- `reviewed_primary_folder`
- `reviewed_secondary_folders`

`aid` may be empty only when `review_status` is `untrackable`. Approved rows must include a non-empty `aid`.

Allowed `review_status` values:
- `approved`: use reviewed fields to generate tasks.
- `needs_review`: do not generate tasks yet.
- `untrackable`: keep out of the task package because the video is invalid, unavailable, or missing executable IDs.
- `skip`: keep the video out of the task package.

## Editable Fields

Humans should edit only these fields:

- `review_status`
- `reviewed_primary_folder`
- `reviewed_secondary_folders`

The suggested fields should stay unchanged as audit evidence.

## Local HTML Review Page

For larger inventories, generate a local static review page:

```bash
node "$SKILL_DIR/scripts/generate-review-page.mjs" classification-review.jsonl review.html
```

Open `review.html` in a browser. The page runs entirely locally and does not write to Bilibili.

The page supports:
- keyword search across title, uploader, BV id, URL, source folders, tags, suggested folders, and reviewed folders
- status filtering
- compact pagination with 50, 100, or 200 rows per page; default is 100
- searchable primary category selection
- searchable secondary category multi-selection
- inline category creation from the category selector
- bulk primary-folder update for all current search/filter results
- bulk status checkboxes that narrow bulk primary-folder updates; only `needs_review` is selected by default
- approve-current-page shortcut for rows that already have a primary folder
- export of `reviewed-classification.jsonl`

Inline category creation only adds a category name to the local review data. It must not delete, rename, merge, or create real Bilibili folders. Missing real folders are created later by the Executor when the reviewed task package is imported and the user chooses `创建缺失目标夹`.

Bulk primary-folder update changes only `reviewed_primary_folder` for rows that match both the current search/filter result set and the checked bulk statuses. It does not change `review_status`; humans can then use the approve-current-page shortcut to mark visible reviewed rows as `approved`.

Pagination and filtering must not discard edits. The page commits visible primary-category draft text before filtering, paging, approving visible rows, bulk-updating primary folders, or exporting. Secondary categories are committed immediately when selected or added.

The page also stores an automatic browser-local draft with `localStorage` for the same `review.html` path. This protects edits across refreshes or accidental tab closes, but the final file still must be exported as `reviewed-classification.jsonl`.

## Review Rules

- For an accepted primary target, set `review_status` to `approved` and fill `reviewed_primary_folder`.
- For secondary targets, fill `reviewed_secondary_folders`; each secondary folder becomes a `copy` task.
- For uncertain rows, keep `review_status` as `needs_review`.
- For conflicting rows, keep `needs_review` until a human selects the target.
- For rows that do not need migration, use `skip`.
- For invalid or unavailable rows, use `untrackable`.
- For invalid, unwanted, or out-of-scope rows, set `review_status` to `skip`.
- Never use this file for deletion or cleanup decisions.

## Package Generation Rule

Only rows with `review_status: "approved"` may become task package entries.

For each approved row:
- `reviewed_primary_folder` becomes one `move` task.
- each item in `reviewed_secondary_folders` becomes one `copy` task.
- source folder name and id come from the first executable source folder unless the row has an explicit reviewed source selection.

Rows with any other status must stay out of the task package.

Before task package generation, run a dry-run summary:

```bash
node "$SKILL_DIR/scripts/summarize-review.mjs" reviewed-classification.jsonl review-summary.md
```

Use the summary to check:
- planned move/copy counts
- target folder list
- pending `needs_review` rows
- skipped or untrackable rows
- approved rows missing executable source folder or aid
- rough executor runtime estimate

Then build the task package:

```bash
node "$SKILL_DIR/scripts/build-task-package.mjs" reviewed-classification.jsonl task-package.json
```

The builder:
- reads only `approved` rows
- creates one `move` task for `reviewed_primary_folder`
- creates one `copy` task for each non-empty secondary folder that differs from the primary folder
- sets every task status to `pending`
- writes all target folders with empty `folder_id`, so missing folders can be created later by the Executor
- fails instead of producing a partial package when an approved row is missing `aid`, `title`, or an executable source folder
