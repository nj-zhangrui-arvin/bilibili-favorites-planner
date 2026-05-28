# Planning Policy

## Task Package Scope

The task package only describes Bilibili favorite migration tasks:

- `move`: add the video to the target folder, then remove it from one source folder.
- `copy`: add the video to an additional target folder while keeping source membership.

Never include:
- invalid video cleanup
- favorite folder deletion
- subtitle text
- summaries
- knowledge-base content
- AI prompts
- credentials or browser login material

## Default Target Folders

Use the user's taxonomy when provided. Otherwise prefer this conservative baseline:

- AI/学习
- 编程/开发
- 面试/职场
- 工具/工作流
- 健身/锻炼
- 旅游/攻略
- 自然风光
- 古代文学
- 英雄人物
- 人情世故
- 科技前沿
- 财经/理财
- 美食/做菜
- 新闻/时事
- 娱乐/轻松看
- 娱乐/值得重看
- 待复核

Do not create a large taxonomy just because the source folders are noisy. Prefer fewer clear folders plus `待复核`.

## Classification Rules

- Prefer explicit user labels and reviewed classifications over fresh inference.
- Use metadata in this order: existing classification, source folder name, title, tags, partition, uploader, description, subtitle snippets.
- Put a video into human review when classification confidence is low, source signals conflict, or the target would be a one-off folder.
- Treat reviewed fields as final: `reviewed_primary_folder`, `reviewed_secondary_folders`, and `review_status` override suggested fields.
- Do not generate executable tasks from rows whose `review_status` is `needs_review` or `skip`.
- Use one `move` task for the primary target folder.
- Use `copy` only when the input explicitly requests secondary retention or the classification includes credible `secondary_folders`.
- Skip invalid or unavailable videos; mention them outside the package.

## Package Construction

- `operation_id` must be deterministic and unique.
- `target_folder` must match a `target_folders[].folder_name`.
- `move` tasks must have `source_folder_id`.
- `status` should be `pending`.
- `stats` is display-only; do not make downstream decisions from it.
