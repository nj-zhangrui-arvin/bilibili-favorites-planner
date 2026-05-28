# 数据契约

本文说明组件之间传递的核心文件格式。

## `evidence.jsonl`

Crawler 产物，Planner 输入。

每行一个 JSON 对象。

示例：

```json
{
  "bvid": "BV...",
  "aid": "123",
  "title": "视频标题",
  "url": "https://www.bilibili.com/video/BV...",
  "uploader": "UP 名",
  "source_folders": [
    {
      "folder_name": "默认收藏夹",
      "folder_id": "123456"
    }
  ],
  "tags": [],
  "partition": "",
  "description": "",
  "invalid_or_unavailable": false,
  "fetch_status": "ok",
  "captured_at": "2026-05-28T00:00:00.000Z"
}
```

说明：

- `tags` 可能为空，这是默认行为。
- `source_folders` 必须保留来源夹名称和 id。
- 失效或不可追踪视频不应生成迁移任务。

## `classification-review.jsonl`

Planner prepare 产物，复核页输入。

示例：

```json
{
  "bvid": "BV...",
  "aid": "123",
  "title": "视频标题",
  "source_folders": [],
  "suggested_primary_folder": "工具/工作流",
  "suggested_secondary_folders": [],
  "confidence": "low",
  "reason": "命中关键词：自动化",
  "review_status": "needs_review",
  "reviewed_primary_folder": "工具/工作流",
  "reviewed_secondary_folders": []
}
```

这是建议文件，不等于已批准。

## `reviewed-classification.jsonl`

复核页导出，Planner package 输入。

结构与 `classification-review.jsonl` 基本一致，但人工复核字段是最终真源。

只有以下行会进入任务包：

```json
{
  "review_status": "approved"
}
```

## `task-package.json`

Planner package 产物，Executor 输入。

示例：

```json
{
  "schema_version": 1,
  "plan_name": "bilibili-favorites-plan-2026-05-28",
  "target_folders": [
    {
      "folder_name": "工具/工作流",
      "folder_id": ""
    }
  ],
  "tasks": [
    {
      "operation_id": "op-00001",
      "action": "move",
      "bvid": "BV...",
      "aid": "123",
      "title": "视频标题",
      "source_folder": "默认收藏夹",
      "source_folder_id": "123456",
      "target_folder": "工具/工作流",
      "status": "pending"
    }
  ]
}
```

目标夹 `folder_id` 可以为空。Executor 会先回填已有收藏夹 id，再由用户确认创建缺失目标夹。
