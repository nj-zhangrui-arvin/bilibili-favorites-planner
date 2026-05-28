# Input Inventory Schema

The planner accepts local crawler/export artifacts only. Crawling Bilibili is a separate component.

Accepted formats:
- JSON arrays
- JSON objects with a `videos` array
- JSON objects with an `items` array
- JSONL where each line is one video object

See `component-boundaries.md` for the crawler/analyzer split.

Recommended JSON object:

```json
{
  "schema_version": 1,
  "account": {
    "uid": "123456",
    "name": "example"
  },
  "folders": [
    {
      "folder_name": "默认收藏夹",
      "folder_id": "1000000001"
    }
  ],
  "videos": [
    {
      "bvid": "BV1example01",
      "aid": "100000001",
      "title": "示例视频标题",
      "source_folders": [
        {
          "folder_name": "默认收藏夹",
          "folder_id": "1000000001"
        }
      ],
      "tags": ["Python", "教程"],
      "partition": "知识",
      "uploader": "示例 UP",
      "description": "可选简介",
      "invalid_or_unavailable": false,
      "classification": {
        "primary_folder": "编程/开发",
        "secondary_folders": ["AI/学习"],
        "confidence": "high",
        "reason": "标题和标签都指向编程教程"
      }
    }
  ]
}
```

Required for executable tasks:
- `bvid`
- `aid`
- `title`
- at least one source folder with `folder_name` and `folder_id`

Useful optional fields:
- `tags`
- `partition`
- `uploader`
- `description`
- `subtitle_text`
- `classification.primary_folder`
- `classification.secondary_folders`
- `invalid_or_unavailable`

Compatibility aliases:
- `source_folder` + `source_folder_id` may be normalized into one `source_folders` entry.
- `primary_folder` and `secondary_folders` at the video top level may be treated as classification fields.
- `folder_name`, `media_id`, or `id` inside source folders may be mapped to the executor's `source_folder` and `source_folder_id`.
