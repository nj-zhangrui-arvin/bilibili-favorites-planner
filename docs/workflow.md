# 流程说明

## 主流程

```mermaid
flowchart TD
  A["打开自己的 B 站收藏夹页面"] --> B["Crawler userscript"]
  B --> C["bilibili-favorites-evidence.jsonl"]
  C --> D["Planner Skill auto prepare"]
  D --> E["classification-review.jsonl"]
  E --> F["review.html"]
  F --> G["人工复核"]
  G --> H["reviewed-classification.jsonl"]
  H --> I["Planner Skill auto package"]
  I --> J["review-summary.md"]
  I --> K["task-package.json"]
  K --> L["Executor userscript"]
  L --> M["写回 B 站收藏夹"]
```

## 读写边界

```mermaid
flowchart LR
  subgraph Local["只读或本地处理"]
    Crawler["Crawler"]
    Planner["Planner"]
    Review["Review Page"]
  end

  subgraph Write["写 B 站"]
    Executor["Executor"]
  end

  Crawler --> Planner --> Review --> Executor
```

## 每一步输入输出

| 阶段 | 输入 | 输出 | 是否写 B 站 |
| --- | --- | --- | --- |
| Crawler | 已登录收藏夹页面 | `evidence.jsonl` | 否 |
| Planner prepare | `evidence.jsonl` | `classification-review.jsonl`, `review.html` | 否 |
| 人工复核 | `review.html` | `reviewed-classification.jsonl` | 否 |
| Planner package | `reviewed-classification.jsonl` | `task-package.json` | 否 |
| Executor | `task-package.json` | B 站收藏夹变化、执行报告 | 是 |

## 人工停止点

流程刻意保留两个停止点：

- 生成复核页后，必须人工确认分类。
- 生成任务包后，必须人工导入 Executor 并启动执行。

不存在“采集后自动写回 B 站”的路径。
