#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ALLOWED_TOP_LEVEL = new Set([
  "schema_version",
  "plan_name",
  "target_folders",
  "tasks",
  "stats",
]);

const ALLOWED_TASK_KEYS = new Set([
  "operation_id",
  "action",
  "bvid",
  "aid",
  "title",
  "source_folder",
  "source_folder_id",
  "target_folder",
  "status",
]);

const DISALLOWED_TOP_LEVEL = new Set([
  "invalid_videos",
  "legacy_folder_cleanup",
  "cleanup",
  "knowledge_base",
  "subtitles",
  "summaries",
  "prompts",
  "cookie",
  "SESSDATA",
  "csrf",
]);

const SECRET_PATTERNS = [
  /SESSDATA/i,
  /bili_jct/i,
  /csrf/i,
  /cookie/i,
  /DedeUserID/i,
];

function usage() {
  console.error("Usage: validate-task-package.mjs <task-package.json>");
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function push(errorList, pathLabel, message) {
  errorList.push(`${pathLabel}: ${message}`);
}

function validate(payload) {
  const errors = [];
  const serialized = JSON.stringify(payload);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      push(errors, "$", `possible credential or session material matched ${pattern}`);
    }
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["$: package must be a JSON object"];
  }

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      push(errors, "$", `unexpected top-level key "${key}"`);
    }
    if (DISALLOWED_TOP_LEVEL.has(key)) {
      push(errors, "$", `disallowed non-migration key "${key}"`);
    }
  }

  if (payload.schema_version !== 1) {
    push(errors, "$.schema_version", "must be 1");
  }
  if (!isNonEmptyString(payload.plan_name)) {
    push(errors, "$.plan_name", "must be a non-empty string");
  }
  if (!Array.isArray(payload.target_folders)) {
    push(errors, "$.target_folders", "must be an array");
  }
  if (!Array.isArray(payload.tasks)) {
    push(errors, "$.tasks", "must be an array");
  }
  if (errors.length > 0) {
    return errors;
  }

  const targetNames = new Set();
  const folderNamesSeen = new Set();
  payload.target_folders.forEach((folder, index) => {
    const label = `$.target_folders[${index}]`;
    if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
      push(errors, label, "must be an object");
      return;
    }
    for (const key of Object.keys(folder)) {
      if (key !== "folder_name" && key !== "folder_id") {
        push(errors, label, `unexpected key "${key}"`);
      }
    }
    if (!isNonEmptyString(folder.folder_name)) {
      push(errors, `${label}.folder_name`, "must be a non-empty string");
      return;
    }
    if (folder.folder_id !== undefined && typeof folder.folder_id !== "string") {
      push(errors, `${label}.folder_id`, "must be a string when present");
    }
    if (folderNamesSeen.has(folder.folder_name)) {
      push(errors, `${label}.folder_name`, `duplicate target folder "${folder.folder_name}"`);
    }
    folderNamesSeen.add(folder.folder_name);
    targetNames.add(folder.folder_name);
  });

  const operationIds = new Set();
  let moveTasks = 0;
  let copyTasks = 0;

  payload.tasks.forEach((task, index) => {
    const label = `$.tasks[${index}]`;
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      push(errors, label, "must be an object");
      return;
    }
    for (const key of Object.keys(task)) {
      if (!ALLOWED_TASK_KEYS.has(key)) {
        push(errors, label, `unexpected key "${key}"`);
      }
    }
    for (const key of ALLOWED_TASK_KEYS) {
      if (!(key in task)) {
        push(errors, label, `missing required key "${key}"`);
      }
    }
    if (!/^op-\d{5}$/.test(task.operation_id || "")) {
      push(errors, `${label}.operation_id`, "must match op-00001 format");
    } else if (operationIds.has(task.operation_id)) {
      push(errors, `${label}.operation_id`, `duplicate operation id "${task.operation_id}"`);
    }
    operationIds.add(task.operation_id);

    if (task.action !== "move" && task.action !== "copy") {
      push(errors, `${label}.action`, 'must be "move" or "copy"');
    }
    if (task.action === "move") moveTasks += 1;
    if (task.action === "copy") copyTasks += 1;

    if (!/^BV[0-9A-Za-z]+$/.test(task.bvid || "")) {
      push(errors, `${label}.bvid`, "must look like a BV id");
    }
    for (const key of ["aid", "title", "source_folder", "source_folder_id", "target_folder"]) {
      if (!isNonEmptyString(task[key])) {
        push(errors, `${label}.${key}`, "must be a non-empty string");
      }
    }
    if (task.status !== "pending") {
      push(errors, `${label}.status`, 'generator output should use "pending"');
    }
    if (isNonEmptyString(task.target_folder) && !targetNames.has(task.target_folder)) {
      push(errors, `${label}.target_folder`, `not listed in target_folders: "${task.target_folder}"`);
    }
  });

  if (payload.stats && typeof payload.stats === "object" && !Array.isArray(payload.stats)) {
    if ("total_tasks" in payload.stats && payload.stats.total_tasks !== payload.tasks.length) {
      push(errors, "$.stats.total_tasks", `expected ${payload.tasks.length}`);
    }
    if ("move_tasks" in payload.stats && payload.stats.move_tasks !== moveTasks) {
      push(errors, "$.stats.move_tasks", `expected ${moveTasks}`);
    }
    if ("copy_tasks" in payload.stats && payload.stats.copy_tasks !== copyTasks) {
      push(errors, "$.stats.copy_tasks", `expected ${copyTasks}`);
    }
  } else if ("stats" in payload) {
    push(errors, "$.stats", "must be an object when present");
  }

  return errors;
}

const inputPath = process.argv[2];
if (!inputPath) {
  usage();
  process.exit(2);
}

try {
  const payload = readJson(inputPath);
  const errors = validate(payload);
  if (errors.length > 0) {
    console.error(`Invalid task package: ${path.resolve(inputPath)}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  const moveTasks = payload.tasks.filter((task) => task.action === "move").length;
  const copyTasks = payload.tasks.filter((task) => task.action === "copy").length;
  console.log(`OK: ${path.resolve(inputPath)}`);
  console.log(`Tasks: ${payload.tasks.length} total, ${moveTasks} move, ${copyTasks} copy`);
  console.log(`Target folders: ${payload.target_folders.length}`);
} catch (error) {
  console.error(`Failed to validate ${inputPath}: ${error.message}`);
  process.exit(1);
}
