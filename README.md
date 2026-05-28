# Bilibili Favorites Organizer

![Bilibili Favorites Planner 项目封面](docs/assets/project-cover.png)

Bilibili Favorites Organizer 是一套本地优先的 B 站收藏夹整理流程。它先只读采集收藏夹数据，再在本地生成分类建议和人工复核页，最后才把人工审核过的任务包交给执行器写回 B 站。

## 开源拆分建议

建议按 **一个产品、两个仓库** 开源：

- `bilibili-favorites-planner`：Crawler + Planner + 复核页 + 数据契约 + 文档。
- `bilibili-favorites-executor`：独立 Executor userscript。

原因：

- Crawler 和 Planner 都是只读或本地文件处理，用户体验上属于“执行前准备流程”。
- Executor 是唯一会写 B 站的组件，风险、测试和版本节奏应该独立。
- 后续 Planner 可以切换规则/模型，不影响写操作执行器。

## 总流程

```mermaid
flowchart TD
  A["B 站收藏夹页面"] --> B["Crawler 只读采集"]
  B --> C["evidence.jsonl"]
  C --> D["Planner 分类分析"]
  D --> E["review.html 人工复核"]
  E --> F["reviewed-classification.jsonl"]
  F --> G["task-package.json"]
  G --> H["Executor 写回 B 站"]
```

## 效果图

![Crawler 采集器面板](docs/assets/crawler-panel-demo.png)

![Planner 复核页](docs/assets/review-page-demo.png)

## 安装

本项目目前不需要 npm 包发布，直接从 GitHub 下载或克隆即可使用。

### 1. 准备本地 Planner

需要先安装 Node.js 18 或更高版本。

```bash
git clone https://github.com/nj-zhangrui-arvin/bilibili-favorites-planner.git
cd bilibili-favorites-planner
npm run validate:examples
```

如果校验通过，Planner 就可以使用。日常运行用：

```bash
node scripts/run-planner.mjs auto ~/Downloads/bilibili-favorites-evidence.jsonl
```

也可以注册成本机命令：

```bash
npm link
bili-favorites-planner auto ~/Downloads/bilibili-favorites-evidence.jsonl
```

### 2. 安装 Crawler 脚本

在 Chrome 安装 Tampermonkey，然后打开下面的脚本地址安装：

```text
https://raw.githubusercontent.com/nj-zhangrui-arvin/bilibili-favorites-planner/main/scripts/bilibili_favorites_crawler.user.js
```

Crawler 只负责读取收藏夹并导出 JSONL，不写入 B 站。

### 3. 安装 Executor 脚本

Executor 是单独仓库，只有它会执行写回：

```text
https://github.com/nj-zhangrui-arvin/bilibili-favorites-executor
```

## 快速开始

1. 在 Chrome 安装 Crawler userscript。
2. 打开自己的 B 站收藏夹页面。
3. 先点 `测试采集`，确认能下载 `bilibili-favorites-test-evidence.jsonl`。
4. 测试正常后点 `导出收藏夹 JSONL`，得到 `bilibili-favorites-evidence.jsonl`。
5. 把 evidence 文件交给 Planner，生成并打开 `review.html`。
6. 在复核页人工确认分类，导出 `reviewed-classification.jsonl`。
7. Planner 根据 reviewed 文件生成 `task-package.json`。
8. 在 Executor 导入任务包，小批量执行。

完整说明见 [用户手册](docs/user-guide.md)。

## 核心文件

- `evidence.jsonl`：Crawler 只读采集结果。
- `classification-review.jsonl`：Planner 分类建议和待复核字段。
- `review.html`：本地人工复核页。
- `reviewed-classification.jsonl`：人工审核后的真源文件。
- `task-package.json`：Executor 可执行任务包。

格式说明见 [数据契约](docs/data-contracts.md)。

## 安全边界

- Crawler 只读 B 站收藏夹数据。
- Planner 只处理本地文件。
- 复核页只导入/导出本地 JSONL。
- Executor 是唯一写 B 站的组件。
- 不要求用户填写 Cookie、SESSDATA、csrf 或账号密码。
- 不存在从采集到写入的全自动链路，必须经过人工复核。

详细说明见 [安全模型](docs/safety-model.md)。

## 文档

- [用户手册](docs/user-guide.md)
- [流程说明](docs/workflow.md)
- [整体架构](docs/architecture.md)
- [安全模型](docs/safety-model.md)
- [人工复核](docs/human-review.md)
- [数据契约](docs/data-contracts.md)
- [故障排查](docs/troubleshooting.md)
- [路线图](docs/roadmap.md)
- [开发说明](docs/development.md)
- [贡献指南](docs/contributing.md)

## 合规与平台边界

本项目是非官方本地工具，与 Bilibili 或上海宽娱数码科技有限公司无任何关联，也未获得其背书、赞助或授权。

请只用于管理自己账号下的收藏夹。不要用于第三方账号、商业化数据抓取、刷量、绕过平台限制或影响平台服务稳定性。自动化读取和写入都可能触发平台风控，例如 403、412、验证码或登录校验。

使用前请自行理解风险，并在执行前备份。

## License

MIT
