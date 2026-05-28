#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.error("Usage: build-task-package.mjs <reviewed-classification.jsonl> <task-package.json> [plan-name]");
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
        throw new Error(`Invalid JSONL at line ${entry.number}: ${error.message}`);
      }
    });
}

function normalizeName(value) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function firstSource(row) {
  return Array.isArray(row.source_folders) ? row.source_folders[0] : null;
}

function operationId(index) {
  return `op-${String(index).padStart(5, "0")}`;
}

function taskBase(row, source, targetFolder, action, opIndex) {
  return {
    operation_id: operationId(opIndex),
    action,
    bvid: row.bvid,
    aid: String(row.aid),
    title: row.title,
    source_folder: source.folder_name,
    source_folder_id: String(source.folder_id),
    target_folder: targetFolder,
    status: "pending",
  };
}

function assertApprovedRow(row, lineNumber) {
  const label = `line ${lineNumber}`;
  const errors = [];
  const source = firstSource(row);

  if (!isNonEmptyString(row.bvid)) errors.push(`${label}: approved row missing bvid`);
  if (!isNonEmptyString(row.aid)) errors.push(`${label}: approved row missing aid (${row.bvid || "unknown bvid"})`);
  if (!isNonEmptyString(row.title)) errors.push(`${label}: approved row missing title (${row.bvid || "unknown bvid"})`);
  if (!isNonEmptyString(row.reviewed_primary_folder)) errors.push(`${label}: approved row missing reviewed_primary_folder (${row.bvid || "unknown bvid"})`);
  if (!source || !isNonEmptyString(source.folder_name) || !isNonEmptyString(source.folder_id)) {
    errors.push(`${label}: approved row missing executable source folder (${row.bvid || "unknown bvid"})`);
  }
  if (!Array.isArray(row.reviewed_secondary_folders)) {
    errors.push(`${label}: reviewed_secondary_folders must be an array (${row.bvid || "unknown bvid"})`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function buildPackage(parsedRows, planName) {
  const tasks = [];
  const targetNames = new Set();
  const approvedRows = parsedRows.filter(({ value }) => value.review_status === "approved");

  for (const parsed of approvedRows) {
    const row = parsed.value;
    assertApprovedRow(row, parsed.number);

    const source = firstSource(row);
    const primary = normalizeName(row.reviewed_primary_folder);
    targetNames.add(primary);
    tasks.push(taskBase(row, source, primary, "move", tasks.length + 1));

    const secondarySeen = new Set([primary]);
    for (const folder of row.reviewed_secondary_folders) {
      const secondary = normalizeName(folder);
      if (!secondary || secondarySeen.has(secondary)) continue;
      secondarySeen.add(secondary);
      targetNames.add(secondary);
      tasks.push(taskBase(row, source, secondary, "copy", tasks.length + 1));
    }
  }

  const targetFolders = Array.from(targetNames)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
    .map((folderName) => ({
      folder_name: folderName,
      folder_id: "",
    }));

  const moveTasks = tasks.filter((task) => task.action === "move").length;
  const copyTasks = tasks.filter((task) => task.action === "copy").length;

  return {
    schema_version: 1,
    plan_name: planName,
    target_folders: targetFolders,
    tasks,
    stats: {
      total_tasks: tasks.length,
      move_tasks: moveTasks,
      copy_tasks: copyTasks,
      source_review_rows: parsedRows.length,
      approved_rows: approvedRows.length,
      estimated_seconds_at_5s_per_task: tasks.length * 5,
    },
  };
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const planName = process.argv[4] || `bilibili-favorites-plan-${new Date().toISOString().slice(0, 10)}`;

if (!inputPath || !outputPath) {
  usage();
  process.exit(2);
}

try {
  const rows = parseJsonl(inputPath);
  const payload = buildPackage(rows, planName);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`OK: wrote ${path.resolve(outputPath)}`);
  console.log(`Tasks: ${payload.tasks.length} total, ${payload.stats.move_tasks} move, ${payload.stats.copy_tasks} copy`);
  console.log(`Target folders: ${payload.target_folders.length}`);
  console.log(`Approved rows: ${payload.stats.approved_rows}/${payload.stats.source_review_rows}`);
} catch (error) {
  console.error(`Failed to build task package: ${error.message}`);
  process.exit(1);
}
