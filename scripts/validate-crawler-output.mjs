#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SECRET_PATTERNS = [
  /SESSDATA/i,
  /bili_jct/i,
  /DedeUserID/i,
  /csrf/i,
  /cookie/i,
];

function usage() {
  console.error("用法：validate-crawler-output.mjs <inventory-or-evidence.jsonl>");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("output appears to contain cookie/csrf/session secrets");
  }
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => entry.line.trim().length > 0)
    .map((entry) => {
      try {
        return { number: entry.number, value: JSON.parse(entry.line) };
      } catch (error) {
        return { number: entry.number, parseError: error.message };
      }
    });
}

function validateSourceFolders(row, label, errors) {
  if (!Array.isArray(row.source_folders) || row.source_folders.length === 0) {
    errors.push(`${label}.source_folders: must be a non-empty array`);
    return;
  }
  row.source_folders.forEach((folder, index) => {
    const folderLabel = `${label}.source_folders[${index}]`;
    if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
      errors.push(`${folderLabel}: must be an object`);
      return;
    }
    if (typeof folder.folder_name !== "string") {
      errors.push(`${folderLabel}.folder_name: must be a string`);
    }
    if (typeof folder.folder_id !== "string") {
      errors.push(`${folderLabel}.folder_id: must be a string`);
    }
  });
}

function validateRow(row, label, errors) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  for (const key of ["bvid", "aid", "title", "url", "uploader"]) {
    if (typeof row[key] !== "string") errors.push(`${label}.${key}: must be a string`);
  }
  if (!isNonEmptyString(row.bvid)) errors.push(`${label}.bvid: must be a non-empty string`);
  if (!isNonEmptyString(row.title)) errors.push(`${label}.title: must be a non-empty string`);
  if (!isNonEmptyString(row.url)) errors.push(`${label}.url: must be a non-empty string`);
  if (!Array.isArray(row.tags)) errors.push(`${label}.tags: must be an array`);
  if (typeof row.invalid_or_unavailable !== "boolean") {
    errors.push(`${label}.invalid_or_unavailable: must be a boolean`);
  }
  if (typeof row.fetch_status !== "string") {
    errors.push(`${label}.fetch_status: must be a string`);
  }
  validateSourceFolders(row, label, errors);
}

const inputPath = process.argv[2];
if (!inputPath) {
  usage();
  process.exit(2);
}

try {
  const parsedRows = parseJsonl(inputPath);
  const errors = [];
  let ok = 0;
  let unavailable = 0;
  const folders = new Set();
  const bvids = new Set();

  if (!parsedRows.length) errors.push("$: file must contain at least one JSONL row");
  for (const parsed of parsedRows) {
    const label = `line ${parsed.number}`;
    if (parsed.parseError) {
      errors.push(`${label}: invalid JSON: ${parsed.parseError}`);
      continue;
    }
    validateRow(parsed.value, label, errors);
    if (parsed.value && typeof parsed.value === "object") {
      bvids.add(parsed.value.bvid);
      if (parsed.value.invalid_or_unavailable) unavailable += 1;
      else ok += 1;
      for (const folder of parsed.value.source_folders || []) {
        if (folder.folder_name || folder.folder_id) folders.add(`${folder.folder_id}:${folder.folder_name}`);
      }
    }
  }

  if (errors.length) {
    console.error(`Invalid crawler output: ${path.resolve(inputPath)}`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`OK: ${path.resolve(inputPath)}`);
  console.log(`Rows: ${parsedRows.length}, unique videos: ${bvids.size}, folders: ${folders.size}, ok: ${ok}, unavailable: ${unavailable}`);
} catch (error) {
  console.error(`Failed to validate ${inputPath}: ${error.message}`);
  process.exit(1);
}
