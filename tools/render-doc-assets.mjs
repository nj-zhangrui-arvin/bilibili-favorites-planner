#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(repo, "docs", "assets");
const tmpDir = path.join(repo, "artifacts", "doc-assets");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

function writeFile(name, content) {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function render(inputPath, outputName, size = "1600,900") {
  const outputPath = path.join(outDir, outputName);
  const result = spawnSync(chrome, [
    "--headless=new",
    "--hide-scrollbars",
    "--disable-gpu",
    `--window-size=${size}`,
    `--screenshot=${outputPath}`,
    `file://${inputPath}`,
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Chrome screenshot failed for ${inputPath}`);
  }
  console.log(`Wrote ${outputPath}`);
}

const baseStyle = `
  :root {
    --bg: #f7f8fb;
    --panel: #ffffff;
    --line: #d8dee8;
    --text: #152033;
    --muted: #627084;
    --blue: #2f74ff;
    --red: #f05252;
    --green: #20a464;
    --orange: #f59e0b;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); }
  .window {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 24px 70px rgba(30, 45, 70, .15);
    overflow: hidden;
  }
  .chrome {
    height: 42px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    background: #fbfcfe;
  }
  .dot { width: 11px; height: 11px; border-radius: 99px; display: inline-block; }
  .r { background: #ff5f57; } .y { background: #febc2e; } .g { background: #28c840; }
  .pill {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    background: #eef3ff;
    color: #3156a3;
    font-size: 13px;
    font-weight: 650;
  }
`;

const cover = writeFile("cover.html", `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
${baseStyle}
body {
  width: 1600px;
  height: 900px;
  background:
    radial-gradient(circle at 12% 18%, rgba(47,116,255,.10), transparent 28%),
    radial-gradient(circle at 85% 24%, rgba(240,82,82,.10), transparent 26%),
    #f7f8fb;
}
.wrap { padding: 58px 70px; }
.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 42px; }
h1 { margin: 0; font-size: 58px; letter-spacing: 0; line-height: 1.08; }
.sub { margin-top: 14px; font-size: 24px; color: var(--muted); }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; align-items: center; }
.stage { height: 500px; padding: 26px; position: relative; }
.stage h2 { margin: 0 0 20px; font-size: 30px; }
.small { color: var(--muted); font-size: 18px; line-height: 1.5; }
.folder, .file {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin: 12px 0;
  box-shadow: 0 10px 24px rgba(30,45,70,.08);
}
.thumbs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 22px; }
.thumb { height: 82px; border-radius: 12px; background: linear-gradient(135deg, #dbeafe, #fee2e2); border: 1px solid #dbe3ef; }
.review-row { display: grid; grid-template-columns: 1fr 92px; gap: 10px; align-items: center; border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 10px 0; }
.bar { height: 10px; background: #dbe3ef; border-radius: 99px; margin: 8px 0; }
.bar.short { width: 62%; }
.status { border-radius: 9px; padding: 7px 8px; text-align: center; font-weight: 700; background: #ecfdf3; color: #16834f; }
.status.wait { background: #eef4ff; color: #2f74ff; }
.terminal { background: #111827; color: #d1fae5; border-radius: 16px; padding: 18px; margin-top: 18px; font: 17px ui-monospace, SFMono-Regular, Menlo, monospace; }
.arrow { font-size: 58px; color: var(--blue); text-align: center; font-weight: 800; }
.bottom { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; margin-top: 34px; }
.metric { background: rgba(255,255,255,.76); border: 1px solid var(--line); border-radius: 16px; padding: 18px; font-size: 18px; }
.metric b { display: block; font-size: 22px; margin-bottom: 6px; }
</style></head><body><div class="wrap">
  <div class="top">
    <div>
      <h1>Bilibili Favorites Planner</h1>
      <div class="sub">只读采集 · 本地分类 · 人工复核 · 任务包交接</div>
    </div>
    <span class="pill">Local-first / Human-reviewed / Auditable</span>
  </div>
  <div class="grid">
    <section class="window stage">
      <div class="chrome"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
      <h2>1. 只读采集</h2>
      <p class="small">在已登录收藏夹页面读取元数据，不保存 Cookie，不写 B 站。</p>
      <div class="thumbs"><div class="thumb"></div><div class="thumb"></div><div class="thumb"></div><div class="thumb"></div></div>
      <div class="folder">evidence.jsonl</div>
    </section>
    <section class="window stage">
      <div class="chrome"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
      <h2>2. 人工复核</h2>
      <div class="review-row"><div><div class="bar"></div><div class="bar short"></div></div><div class="status wait">待复核</div></div>
      <div class="review-row"><div><div class="bar"></div><div class="bar short"></div></div><div class="status">已通过</div></div>
      <div class="review-row"><div><div class="bar"></div><div class="bar short"></div></div><div class="status wait">待复核</div></div>
    </section>
    <section class="window stage">
      <div class="chrome"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
      <h2>3. 打包交接</h2>
      <div class="file">reviewed-classification.jsonl</div>
      <div class="file">task-package.json</div>
      <div class="terminal">OK: package validated<br>Tasks: move/copy<br>Ready for Executor</div>
    </section>
  </div>
  <div class="bottom">
    <div class="metric"><b>只读安全</b>采集与分析不修改 B 站</div>
    <div class="metric"><b>本地优先</b>文件和草稿都在本机</div>
    <div class="metric"><b>人工审核</b>只有 approved 行可执行</div>
    <div class="metric"><b>可审计</b>JSONL 和任务包可追踪</div>
  </div>
</div></body></html>`);

const crawler = writeFile("crawler-panel.html", `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
${baseStyle}
body { width: 1200px; height: 720px; background: #f5f6f8; padding: 38px; }
.page { height: 650px; background: #fff; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; position: relative; }
.hero { height: 150px; background: linear-gradient(135deg, #dbeafe, #fce7f3); }
.sidebar { position: absolute; top: 185px; left: 34px; width: 190px; }
.side { height: 28px; background: #eef2f7; border-radius: 8px; margin: 14px 0; }
.content { position: absolute; top: 185px; left: 260px; right: 320px; display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
.card { height: 150px; border: 1px solid var(--line); border-radius: 14px; background: #fff; padding: 12px; }
.image { height: 82px; border-radius: 10px; background: linear-gradient(135deg, #bfdbfe, #fecaca); margin-bottom: 12px; }
.panel {
  position: absolute; right: 22px; bottom: 260px; width: 330px;
  background: #101820; color: #e8f0f7; border: 1px solid #2c3d4d;
  border-radius: 10px; box-shadow: 0 18px 40px rgba(0,0,0,.28);
  padding: 12px; font-size: 13px;
}
.panel-head { display:flex; align-items:center; gap:8px; font-weight:800; margin-bottom:10px; }
.panel-head span:first-child { flex:1; }
button { border: 1px solid #587087; background: #182434; color: #e8f0f7; border-radius: 6px; padding: 6px 9px; }
.buttons { display:flex; gap:7px; margin-bottom:8px; }
.buttons button:first-child { flex:1; background:#1d6ca8; border-color:#1d6ca8; }
.progress { height:8px; background:#22313f; border-radius:99px; overflow:hidden; margin:10px 0 7px; }
.fill { width:58%; height:100%; background:#38bdf8; }
.muted { color:#9fb0c0; margin:6px 0; }
pre { max-height:120px; overflow:hidden; white-space:pre-wrap; background:#0b1117; border:1px solid #243442; border-radius:6px; padding:7px; margin:0; color:#cbd5e1; }
</style></head><body><div class="page">
  <div class="hero"></div>
  <div class="sidebar"><div class="side"></div><div class="side"></div><div class="side"></div><div class="side"></div><div class="side"></div></div>
  <div class="content">${Array.from({length:6}).map(()=>'<div class="card"><div class="image"></div><div class="bar"></div><div class="bar short"></div></div>').join("")}</div>
  <div class="panel">
    <div class="panel-head"><span>Bilibili 收藏夹采集器</span><span style="color:#7dd3fc">运行中</span><button>折叠</button></div>
    <div class="buttons"><button>导出收藏夹 JSONL</button><button>测试采集</button><button>暂停</button></div>
    <label class="muted"><input type="checkbox"> 抓标签（更慢，审核更准）</label>
    <div class="progress"><div class="fill"></div></div>
    <div>读取收藏夹: 11/19 (58%)</div>
    <div class="muted">已用时：2分18秒 · 预计剩余：1分42秒 · 已采集 218 条</div>
    <pre>[13:20:11] 收藏夹 11/19: 工具/工作流
[13:20:09] 默认收藏夹: 第 3 页，20 条
[13:20:07] 已保存检查点</pre>
  </div>
</div></body></html>`);

render(cover, "project-cover.png");
render(crawler, "crawler-panel-demo.png", "1200,720");
render(path.join(repo, "artifacts", "demo", "review.html"), "review-page-demo.png", "1440,900");
