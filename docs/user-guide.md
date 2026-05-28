# 用户手册

本文面向普通用户，说明如何从采集到执行完整整理一次 B 站收藏夹。

## 1. 安装

### 1.1 安装 Codex Skill

如果你是让 Codex 辅助整理收藏夹，推荐先安装 `bilibili-favorites-planner` Skill。这样 Codex 会自动识别 evidence、reviewed 文件，并在本地运行 Planner。

Skill 地址：

```text
https://github.com/nj-zhangrui-arvin/bilibili-favorites-planner/tree/main/skills/bilibili-favorites-planner
```

在 Codex 里用 Skill Installer 从这个 GitHub 地址安装。安装后重启 Codex。

给 Codex 的提示可以很短：

```text
请用 bilibili-favorites-planner skill 生成复核页。
```

复核页导出 `reviewed-classification.jsonl` 后，再交给 Codex：

```text
请用 bilibili-favorites-planner skill 生成 Executor 任务包。
```

这种方式下，用户不需要记 Planner 命令。Codex 负责运行脚本、打开复核页、校验输出。

### 1.2 安装浏览器脚本

在 Chrome 安装 Tampermonkey，然后安装两个 userscript：

- Crawler：只读采集收藏夹数据。
- Executor：导入任务包并执行迁移。

Crawler 安装地址：

```text
https://raw.githubusercontent.com/nj-zhangrui-arvin/bilibili-favorites-planner/main/scripts/bilibili_favorites_crawler.user.js
```

Executor 仓库：

```text
https://github.com/nj-zhangrui-arvin/bilibili-favorites-executor
```

建议把 Chrome 专门用于 B 站自动化，日常浏览器和自动化浏览器分开。

### 1.3 开发者手动模式

熟悉终端的用户也可以不安装 Skill，直接克隆仓库运行 Node 脚本：

```bash
git clone https://github.com/nj-zhangrui-arvin/bilibili-favorites-planner.git
cd bilibili-favorites-planner
npm run validate:examples
node scripts/run-planner.mjs auto ~/Downloads/bilibili-favorites-evidence.jsonl
```

## 2. 采集收藏夹

打开自己的收藏夹页面：

```text
https://space.bilibili.com/<你的 mid>/favlist
```

页面右侧会出现 Crawler 面板。

![Crawler 采集器面板](assets/crawler-panel-demo.png)

推荐流程：

1. 先点 `测试采集`。
2. 确认只下载一个文件：`bilibili-favorites-test-evidence.jsonl`。
3. 测试正常后，再点 `导出收藏夹 JSONL`。

采集器默认行为：

- 默认只下载一个 `evidence.jsonl`。
- 默认不抓标签，减少请求量和风控概率。
- 需要标签辅助审核时，可勾选 `抓标签（更慢，审核更准）`。
- `暂停` 会保存进度，刷新页面后可继续。
- `取消重来` 会清空进度，下次从 0 开始。

## 3. 运行 Planner

把 `bilibili-favorites-evidence.jsonl` 交给 Codex，并说明要生成复核页。已安装 Skill 时，Codex 会自动运行 Planner。

Planner 会：

- 生成 `classification-review.jsonl`。
- 生成 `review.html`。
- 在 macOS 上自动打开复核页。
- 停在人工复核步骤。

## 4. 人工复核

在 `review.html` 中：

![Planner 复核页](assets/review-page-demo.png)

- 搜索标题、UP、BV 号、来源夹、标签、分类。
- 调整主分类。
- 添加次分类。
- 输入并新增不存在的分类名。
- 用分页处理大量视频。
- 用批量主分类处理搜索结果。
- 审核完成后导出 `reviewed-classification.jsonl`。

只有 `review_status: approved` 的行会进入任务包。

## 5. 生成任务包

把 `reviewed-classification.jsonl` 交给 Codex，并说明要生成 Executor 任务包。

Planner 会：

- 校验复核结果。
- 生成 `review-summary.md`。
- 生成 `task-package.json`。
- 校验任务包。

## 6. 执行迁移

打开 B 站收藏夹页面，使用 Executor 面板：

1. 导入 `task-package.json`。
2. 如提示缺少目标夹，先创建缺失目标夹。
3. 先备份进度。
4. 先小批量执行。
5. 遇到风控或异常就暂停。
6. 完成后导出执行报告。

Executor 是唯一会写 B 站的组件。

## 建议节奏

大账号不要一次冲到底：

1. 测试采集。
2. 全量采集。
3. Planner 生成复核页。
4. 人工批量复核。
5. 导出 reviewed 文件。
6. Planner 生成任务包。
7. Executor 小批量试跑。
8. 确认无误后再继续执行。
