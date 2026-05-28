---
name: bilibili-favorites-planner
description: Generate read-only Bilibili favorites migration task packages for the Bilibili Favorites Executor. Use when Codex needs to plan Bilibili favorite-folder reorganization from inventory or metadata files, classify videos into target folders, produce an auditable JSON task package, or validate packages against the executor contract without writing to Bilibili.
---

# Bilibili Favorites Planner

## Boundaries

Use this skill to generate and validate task packages for `bilibili-favorites-executor`.

Do:
- Read local crawler/export artifacts such as inventory, evidence, classification, or manually supplied video metadata.
- Classify videos into target favorite folders and produce a human-review file.
- Consume reviewed classification files as the source of truth for final packages.
- Produce an auditable task package JSON that matches `schemas/task-package.schema.json`.
- Validate the package with `scripts/validate-task-package.mjs`.
- Keep ambiguous videos in a review folder instead of guessing.

Do not:
- Crawl Bilibili pages or APIs.
- Write to Bilibili, call favorite move/copy APIs, or automate Executor buttons.
- Put cleanup actions in the task package.
- Put invalid-video cleanup, folder deletion, subtitles, summaries, prompts, knowledge-base text, Cookie, SESSDATA, csrf, or account passwords in the task package.
- Treat generated packages as approved for execution until the user has reviewed them.

## Workflow

### Recommended Entry

For normal use, prefer file-driven execution instead of asking the user to type commands.

If the user provides a JSONL file and asks what to do next:
- If it is crawler evidence, run `auto` to generate the review page.
- If it is `classification-review.jsonl`, run `auto` to regenerate/open the review page.
- If it is `reviewed-classification.jsonl`, run `auto` to generate the Executor package.
- Only ask for confirmation when the file type is ambiguous or when a previous output directory may be overwritten.

Single auto entry:

```bash
node "$SKILL_DIR/scripts/run-planner.mjs" auto input.jsonl
```

`$SKILL_DIR` means the installed `bilibili-favorites-planner` skill directory. Resolve it from the current `SKILL.md` location instead of using a user-specific absolute path.

The auto command creates a timestamped output directory under `artifacts/bilibili/planner/`, opens `review.html` on macOS when review is needed, and stops for human review before package generation.

Manual commands remain available when exact output paths are needed.

Prepare a human review page from crawler evidence:

```bash
node "$SKILL_DIR/scripts/run-planner.mjs" prepare evidence.jsonl planner-output
```

After the review page exports `reviewed-classification.jsonl`, build the Executor package:

```bash
node "$SKILL_DIR/scripts/run-planner.mjs" package reviewed-classification.jsonl planner-output
```

The `prepare` command stops at human review. The `package` command only uses rows with `review_status: approved`.

### Detailed Steps

1. Locate the local crawler/export artifact.
   - Prefer an explicit file from the user.
   - If none is provided, look for recent local artifacts such as `artifacts/bilibili/inventory.jsonl`, `evidence.jsonl`, `classification.jsonl`, or JSON exports.
   - For expected inventory shape, read `references/input-inventory-schema.md` and `examples/input-inventory.example.json`.
   - For crawler/analyzer boundaries, read `references/component-boundaries.md`.

2. Normalize videos.
   - Require `bvid`, `aid`, `title`, source folder name, and source folder id for executable tasks.
   - Exclude invalid or unavailable videos from migration tasks; list them separately in the review notes if useful.
   - Deduplicate by `bvid`; choose one primary source for `move`, and use `copy` only for intentional secondary folder retention.

3. Classify conservatively.
   - Reuse existing classification fields if present and credible.
   - Otherwise infer from title, folder names, tags, partition, uploader, description, and user-provided taxonomy.
   - Keep target folder names stable and human-readable.
   - For folder policy details, read `references/planning-policy.md`.

4. Generate a human-review file before the task package.
   - Use the analyzer script when starting from inventory/evidence:

```bash
node "$SKILL_DIR/scripts/build-classification-review.mjs" inventory-or-evidence.jsonl classification-review.jsonl
```

   - Use JSONL, commonly `classification-review.jsonl`.
   - Each line should contain the video identity, source folders, suggested folders, confidence, reason, and editable reviewed fields.
   - Set `review_status` to `needs_review` for low confidence or mixed intent.
   - Use `review_status: approved` only when the classification is already explicit and low risk.
   - Read `references/human-review-workflow.md` and validate with:

```bash
node "$SKILL_DIR/scripts/validate-classification-review.mjs" classification-review.jsonl
```

5. Stop for human edits when review is required.
   - Prefer the local HTML review page for non-trivial inventories:

```bash
node "$SKILL_DIR/scripts/generate-review-page.mjs" classification-review.jsonl review.html
```

   - The page lets humans search videos, filter by status, page through results, choose or add categories, and export `reviewed-classification.jsonl`.
   - For small inventories, direct JSONL editing is also acceptable.
   - The human edits only `reviewed_primary_folder`, `reviewed_secondary_folders`, and `review_status`.
   - Only `approved` rows become executable migration tasks.
   - `skip` rows stay out of the task package.
   - `needs_review` rows must not be silently converted into executable tasks.

6. Summarize the reviewed file before package generation.
   - Run:

```bash
node "$SKILL_DIR/scripts/summarize-review.mjs" reviewed-classification.jsonl review-summary.md
```

   - Review move/copy counts, target folders, pending rows, skipped rows, warnings, and rough execution time.
   - Do not generate a task package if approved rows are missing executable fields.

7. Generate the task package from reviewed classifications.
   - Run:

```bash
node "$SKILL_DIR/scripts/build-task-package.mjs" reviewed-classification.jsonl task-package.json
```

   - Use `schema_version: 1`.
   - Include every target folder referenced by tasks in `target_folders`.
   - Use deterministic operation ids: `op-00001`, `op-00002`, ...
   - Set task `status` to `pending`.
   - Keep `stats` display-only.
   - Save the package as JSON, commonly `task-package.json`.

8. Validate before reporting completion.
   - Run:

```bash
node "$SKILL_DIR/scripts/validate-task-package.mjs" task-package.json
```

9. Report review evidence.
   - Provide the output path, counts for move/copy tasks, target folder count, skipped invalid count if known, and validation result.
   - State that execution must happen separately in Bilibili Favorites Executor after human review.

## Resources

- `examples/input-inventory.example.json`: example input inventory.
- `examples/classification-review.example.jsonl`: example human-review classification file.
- `examples/task-package.example.json`: executor-compatible output package.
- `schemas/task-package.schema.json`: JSON Schema for the executor task package contract.
- `scripts/build-classification-review.mjs`: analyze local crawler/export artifacts into human-review JSONL.
- `scripts/build-task-package.mjs`: build an executor task package from approved reviewed classification rows.
- `scripts/generate-review-page.mjs`: generate a dependency-free local HTML review page from classification JSONL.
- `scripts/run-planner.mjs`: one-command entry for prepare/review and package generation workflows.
- `scripts/summarize-review.mjs`: produce a dry-run Markdown summary from reviewed classification JSONL.
- `scripts/validate-classification-review.mjs`: dependency-free validator for the human-review JSONL file.
- `scripts/validate-task-package.mjs`: dependency-free validator for task packages.
- `references/input-inventory-schema.md`: accepted input inventory shape.
- `references/component-boundaries.md`: crawler/analyzer/executor separation.
- `references/human-review-workflow.md`: human intervention workflow and editable fields.
- `references/planning-policy.md`: classification and package-generation policy.
