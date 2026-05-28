# 整体架构

本项目由几个边界清晰的小组件组成。

## Crawler

运行在 B 站收藏夹页面里的 Tampermonkey userscript。

职责：

- 读取自建收藏夹列表。
- 读取收藏夹内的视频元数据。
- 可选读取视频标签。
- 导出 `evidence.jsonl`。
- 用浏览器 `localStorage` 保存暂停/继续进度。

不负责：

- 不分类。
- 不生成任务包。
- 不移动、复制、删除收藏。
- 不导出 Cookie 或登录凭据。

## Planner

本地 Node.js 脚本和 Codex Skill。

职责：

- 归一化采集数据。
- 根据标题、UP、简介、来源夹、分区、标签生成分类建议。
- 生成复核 JSONL。
- 生成本地复核页。
- 根据人工批准行生成 Executor 任务包。
- 校验输入和输出。

不负责：

- 不抓 B 站页面。
- 不写 B 站。
- 不把未审核建议自动变成执行任务。

## Review Page

Planner 生成的本地静态 HTML。

职责：

- 搜索、筛选、分页展示复核行。
- 编辑状态、主分类、次分类。
- 内联新增分类名。
- 导出 `reviewed-classification.jsonl`。

不负责：

- 不依赖后端。
- 不请求 B 站。
- 不删除、重命名真实收藏夹。

## Executor

运行在 B 站收藏夹页面里的 Tampermonkey userscript。

职责：

- 导入 `task-package.json`。
- 回填或创建缺失目标夹。
- 保守节奏执行 move/copy。
- 暂停、恢复、备份和导出报告。

不负责：

- 不做 AI 分类。
- 不生成采集数据。
- 不做隐式清理。

## 仓库策略

建议开源为两个仓库：

- `bilibili-favorites-planner`：Crawler + Planner + 复核页。
- `bilibili-favorites-executor`：写操作执行器。

这样可以把写操作风险隔离出来，也方便 Planner 后续独立演进分类规则和模型适配。

## 信任模型

```mermaid
flowchart LR
  Browser["已登录浏览器"] --> Evidence["evidence.jsonl"]
  Evidence --> Review["人工复核 JSONL"]
  Review --> Package["task-package.json"]
  Package --> Executor["Executor"]
```

`reviewed-classification.jsonl` 是人工审核真源。Planner 的建议在人工批准前不可信。
