#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.error(`用法：
  run-planner.mjs auto <jsonl> [out-dir] [plan-name]
  run-planner.mjs prepare <evidence.jsonl> [out-dir]
  run-planner.mjs package <reviewed-classification.jsonl> [out-dir] [plan-name]

说明：
  auto: 自动识别输入类型。采集文件生成复核页，已复核文件生成任务包。
  prepare: 生成 classification-review.jsonl 和 review.html，停下来给人工复核。
  package: 从 reviewed-classification.jsonl 生成 review-summary.md 和 task-package.json。`);
}

function ensureFile(filePath, label) {
  if (!filePath) throw new Error(`缺少 ${label}`);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} 不存在或不是文件：${filePath}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return path.resolve(dirPath);
}

function timestampSlug(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function defaultOutDir() {
  return path.resolve(process.cwd(), "artifacts", "bilibili", "planner", timestampSlug());
}

function parseJsonlSample(filePath, maxRows = 20) {
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, maxRows)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`第 ${index + 1} 行 JSONL 无效：${error.message}`);
      }
    });
}

function detectInputKind(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  const rows = parseJsonlSample(filePath);
  const hasReviewStatus = rows.some((row) => row && typeof row === "object" && "review_status" in row);
  const hasReviewedFields = rows.some((row) => row && typeof row === "object" && "reviewed_primary_folder" in row);
  const approvedRows = rows.filter((row) => row?.review_status === "approved").length;

  if (basename.includes("reviewed-classification") || (hasReviewStatus && hasReviewedFields && approvedRows > 0)) {
    return "package";
  }
  if (basename.includes("classification-review") || (hasReviewStatus && hasReviewedFields)) {
    return "review-page";
  }
  return "prepare";
}

function run(scriptName, args) {
  const scriptPath = path.join(scriptDir, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}

function openReviewPage(htmlPath) {
  if (process.platform !== "darwin") return;
  const result = spawnSync("open", [htmlPath], { encoding: "utf8" });
  if (result.status === 0) {
    console.log(`已打开复核页：${htmlPath}`);
  }
}

function prepare(inputPath, outDirArg) {
  ensureFile(inputPath, "evidence JSONL");
  const outDir = ensureDir(outDirArg || path.dirname(path.resolve(inputPath)));
  const reviewPath = path.join(outDir, "classification-review.jsonl");
  const htmlPath = path.join(outDir, "review.html");

  run("build-classification-review.mjs", [inputPath, reviewPath]);
  run("validate-classification-review.mjs", [reviewPath]);
  run("generate-review-page.mjs", [reviewPath, htmlPath]);

  console.log("");
  console.log("下一步：打开复核页，人工确认分类后导出 reviewed-classification.jsonl");
  console.log(`复核页：${htmlPath}`);
  console.log(`复核源：${reviewPath}`);
  openReviewPage(htmlPath);
}

function reviewPageOnly(reviewPath, outDirArg) {
  ensureFile(reviewPath, "classification review JSONL");
  const outDir = ensureDir(outDirArg || path.dirname(path.resolve(reviewPath)));
  const htmlPath = path.join(outDir, "review.html");

  run("validate-classification-review.mjs", [reviewPath]);
  run("generate-review-page.mjs", [reviewPath, htmlPath]);

  console.log("");
  console.log("下一步：在复核页完成审核并导出 reviewed-classification.jsonl");
  console.log(`复核页：${htmlPath}`);
  openReviewPage(htmlPath);
}

function buildPackage(reviewedPath, outDirArg, planName) {
  ensureFile(reviewedPath, "reviewed classification JSONL");
  const outDir = ensureDir(outDirArg || path.dirname(path.resolve(reviewedPath)));
  const summaryPath = path.join(outDir, "review-summary.md");
  const packagePath = path.join(outDir, "task-package.json");

  run("validate-classification-review.mjs", [reviewedPath]);
  run("summarize-review.mjs", [reviewedPath, summaryPath]);
  run("build-task-package.mjs", planName ? [reviewedPath, packagePath, planName] : [reviewedPath, packagePath]);
  run("validate-task-package.mjs", [packagePath]);

  console.log("");
  console.log("下一步：把 task-package.json 导入 Bilibili Favorites Executor 执行。");
  console.log(`摘要：${summaryPath}`);
  console.log(`任务包：${packagePath}`);
}

function auto(inputPath, outDirArg, planName) {
  ensureFile(inputPath, "JSONL 输入文件");
  const kind = detectInputKind(inputPath);
  const outDir = outDirArg ? ensureDir(outDirArg) : ensureDir(defaultOutDir());

  console.log(`已识别输入类型：${kind}`);
  console.log(`输出目录：${outDir}`);

  if (kind === "package") {
    buildPackage(inputPath, outDir, planName);
  } else if (kind === "review-page") {
    reviewPageOnly(inputPath, outDir);
  } else {
    prepare(inputPath, outDir);
  }
}

const command = process.argv[2];

try {
  if (command === "auto") {
    auto(process.argv[3], process.argv[4], process.argv[5]);
  } else if (command === "prepare") {
    prepare(process.argv[3], process.argv[4]);
  } else if (command === "package") {
    buildPackage(process.argv[3], process.argv[4], process.argv[5]);
  } else {
    usage();
    process.exit(command ? 1 : 2);
  }
} catch (error) {
  console.error(`Planner 入口执行失败：${error.message}`);
  process.exit(1);
}
