#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const STATUSES = [
  "approved",
  "needs_review",
  "untrackable",
  "skip",
];

const STATUS_LABELS = {
  approved: "已通过",
  needs_review: "待复核",
  untrackable: "不可追踪",
  skip: "跳过",
};

function usage() {
  console.error("用法：summarize-review.mjs <reviewed-classification.jsonl> [summary.md]");
}

function parseJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => entry.line.trim().length > 0)
    .map((entry) => {
      try {
        return { number: entry.number, value: JSON.parse(entry.line) };
      } catch (error) {
        throw new Error(`第 ${entry.number} 行 JSONL 无效：${error.message}`);
      }
    });
}

function normalizeName(value) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim();
}

function firstSource(row) {
  return Array.isArray(row.source_folders) ? row.source_folders[0] : null;
}

function summarize(rows) {
  const statusCounts = new Map(STATUSES.map((status) => [status, 0]));
  const targetFolders = new Map();
  const sourceFolders = new Map();
  const warnings = [];
  const pendingRows = [];
  const blockedRows = [];
  let moveTasks = 0;
  let copyTasks = 0;

  for (const { number, value: row } of rows) {
    const status = row.review_status || "missing";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

    const source = firstSource(row);
    if (source?.folder_name) {
      sourceFolders.set(source.folder_name, (sourceFolders.get(source.folder_name) || 0) + 1);
    }

    if (status === "approved") {
      const primary = normalizeName(row.reviewed_primary_folder);
      if (!primary) {
        warnings.push(`line ${number}: approved row missing reviewed_primary_folder (${row.bvid || "unknown bvid"})`);
      } else {
        moveTasks += 1;
        targetFolders.set(primary, (targetFolders.get(primary) || 0) + 1);
      }

      if (!source?.folder_id || !source?.folder_name) {
        warnings.push(`line ${number}: approved row missing executable source folder (${row.bvid || "unknown bvid"})`);
      }
      if (!row.aid) {
        warnings.push(`line ${number}: approved row missing aid (${row.bvid || "unknown bvid"})`);
      }

      const secondary = Array.isArray(row.reviewed_secondary_folders) ? row.reviewed_secondary_folders : [];
      for (const folder of secondary) {
        const name = normalizeName(folder);
        if (!name || name === primary) continue;
        copyTasks += 1;
        targetFolders.set(name, (targetFolders.get(name) || 0) + 1);
      }
    } else if (status === "needs_review") {
      pendingRows.push(row);
    } else if (status === "untrackable" || status === "skip") {
      blockedRows.push(row);
    }
  }

  const targetList = Array.from(targetFolders.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));
  const sourceList = Array.from(sourceFolders.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));

  return {
    totalRows: rows.length,
    statusCounts,
    moveTasks,
    copyTasks,
    totalTasks: moveTasks + copyTasks,
    targetList,
    sourceList,
    warnings,
    pendingRows,
    blockedRows,
    estimatedSeconds: (moveTasks + copyTasks) * 5,
  };
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatSample(rows) {
  if (rows.length === 0) return "- 无";
  return rows.slice(0, 10).map((row) => {
    const title = row.title || "（无标题）";
    const bvid = row.bvid || "（无 BV）";
    const status = row.review_status || "（无状态）";
    return `- ${bvid} | ${STATUS_LABELS[status] || status} | ${title}`;
  }).join("\n");
}

function renderMarkdown(summary, inputPath) {
  const statusLines = Array.from(summary.statusCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `- ${STATUS_LABELS[status] || status}: ${count}`)
    .join("\n") || "- 无";

  const targetLines = summary.targetList.length
    ? summary.targetList.map(([name, count]) => `- ${name}: ${count}`).join("\n")
    : "- 无";

  const sourceLines = summary.sourceList.length
    ? summary.sourceList.slice(0, 30).map(([name, count]) => `- ${name}: ${count}`).join("\n")
    : "- 无";

  const warningLines = summary.warnings.length
    ? summary.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- 无";

  return `# B站收藏夹复核摘要

输入文件：\`${path.resolve(inputPath)}\`

## 执行预估

- 复核行数：${summary.totalRows}
- 计划任务数：${summary.totalTasks}
- 移动任务：${summary.moveTasks}
- 复制任务：${summary.copyTasks}
- 目标分类数：${summary.targetList.length}
- 粗略执行耗时（按 5 秒/任务）：${formatDuration(summary.estimatedSeconds)}

## 复核状态

${statusLines}

## 目标分类

${targetLines}

## 来源夹分布

${sourceLines}

## 待复核样本

${formatSample(summary.pendingRows)}

## 跳过或不可追踪样本

${formatSample(summary.blockedRows)}

## 警告

${warningLines}
`;
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath) {
  usage();
  process.exit(2);
}

try {
  const rows = parseJsonl(inputPath);
  const summary = summarize(rows);
  const markdown = renderMarkdown(summary, inputPath);
  if (outputPath) {
    fs.writeFileSync(outputPath, markdown, "utf8");
    console.log(`完成：已写入 ${path.resolve(outputPath)}`);
  } else {
    process.stdout.write(markdown);
  }
  console.log(`任务：共 ${summary.totalTasks} 个，移动 ${summary.moveTasks} 个，复制 ${summary.copyTasks} 个`);
  console.log(`目标分类：${summary.targetList.length}`);
  if (summary.warnings.length > 0) {
    console.log(`警告：${summary.warnings.length}`);
  }
} catch (error) {
  console.error(`生成复核摘要失败：${error.message}`);
  process.exit(1);
}
