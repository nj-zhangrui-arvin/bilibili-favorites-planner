# 开发说明

## 仓库结构

```text
scripts/      Crawler 和 Planner 脚本
examples/     脱敏示例数据
schemas/      Executor 任务包 schema
docs/         用户和开发文档
references/   设计参考和内部边界说明
```

Executor 保持独立仓库：`bilibili-favorites-executor`。

## 校验命令

Crawler：

```bash
node --check scripts/bilibili_favorites_crawler.user.js
node --check scripts/validate-crawler-output.mjs
```

Planner：

```bash
node --check scripts/*.mjs
node scripts/run-planner.mjs auto evidence.jsonl
```

Executor：

```bash
cd ../bilibili-favorites-executor
node --check bilibili_favorites_executor.user.js
python3 tests/test_static_contract.py
```

仓库快速校验：

```bash
npm run check
npm run validate:examples
```

## 发布前检查

- 运行语法检查。
- 运行静态测试。
- 运行 `node tools/render-doc-assets.mjs` 更新脱敏截图。
- Crawler `测试采集` 正常。
- 下载的 evidence 能通过校验。
- Planner auto prepare 能生成并打开复核页。
- 复核页能导出 reviewed JSONL。
- Planner auto package 能生成任务包。
- Executor 能导入小任务包。
- 先执行 1-2 条任务验证。
- 导出执行报告。
- 更新截图和文档。
