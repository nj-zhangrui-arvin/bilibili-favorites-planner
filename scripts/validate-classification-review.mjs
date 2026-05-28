#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REQUIRED_KEYS = [
  "bvid",
  "aid",
  "title",
  "url",
  "uploader",
  "source_folders",
  "suggested_primary_folder",
  "suggested_secondary_folders",
  "confidence",
  "reason",
  "review_status",
  "reviewed_primary_folder",
  "reviewed_secondary_folders",
];

const ALLOWED_STATUS = new Set([
  "approved",
  "needs_review",
  "untrackable",
  "skip",
]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
    if (!isNonEmptyString(folder.folder_name)) {
      errors.push(`${folderLabel}.folder_name: must be a non-empty string`);
    }
    if (!isNonEmptyString(folder.folder_id)) {
      errors.push(`${folderLabel}.folder_id: must be a non-empty string`);
    }
  });
}

function validateStringArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label}: must be an array`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push(`${label}[${index}]: must be a string`);
    }
  });
}

function validateRow(row, label, errors) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    errors.push(`${label}: must be an object`);
    return;
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in row)) {
      errors.push(`${label}: missing required key "${key}"`);
    }
  }

  for (const key of ["bvid", "title", "url", "suggested_primary_folder", "confidence", "reason", "review_status"]) {
    if (!isNonEmptyString(row[key])) {
      errors.push(`${label}.${key}: must be a non-empty string`);
    }
  }
  if (typeof row.aid !== "string") {
    errors.push(`${label}.aid: must be a string`);
  }
  if (typeof row.uploader !== "string") {
    errors.push(`${label}.uploader: must be a string`);
  }

  if (!/^BV[0-9A-Za-z]+$/.test(row.bvid || "")) {
    errors.push(`${label}.bvid: must look like a BV id`);
  }
  if (isNonEmptyString(row.confidence) && !ALLOWED_CONFIDENCE.has(row.confidence)) {
    errors.push(`${label}.confidence: must be high, medium, or low`);
  }
  if (isNonEmptyString(row.review_status) && !ALLOWED_STATUS.has(row.review_status)) {
    errors.push(`${label}.review_status: must be approved, needs_review, untrackable, or skip`);
  }

  validateSourceFolders(row, label, errors);
  validateStringArray(row.suggested_secondary_folders, `${label}.suggested_secondary_folders`, errors);
  validateStringArray(row.reviewed_secondary_folders, `${label}.reviewed_secondary_folders`, errors);

  if (row.review_status === "approved" && !isNonEmptyString(row.reviewed_primary_folder)) {
    errors.push(`${label}.reviewed_primary_folder: approved rows need a primary folder`);
  }
  if (row.review_status === "approved" && !isNonEmptyString(row.aid)) {
    errors.push(`${label}.aid: approved rows need an aid`);
  }
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: validate-classification-review.mjs <classification-review.jsonl>");
  process.exit(2);
}

try {
  const parsedRows = parseJsonl(inputPath);
  const errors = [];
  const bvids = new Set();
  let approved = 0;
  let needsReview = 0;
  let untrackable = 0;
  let skipped = 0;

  if (parsedRows.length === 0) {
    errors.push("$: file must contain at least one JSONL row");
  }

  for (const parsed of parsedRows) {
    const label = `line ${parsed.number}`;
    if (parsed.parseError) {
      errors.push(`${label}: invalid JSON: ${parsed.parseError}`);
      continue;
    }
    validateRow(parsed.value, label, errors);
    if (parsed.value && typeof parsed.value === "object") {
      if (bvids.has(parsed.value.bvid)) {
        errors.push(`${label}.bvid: duplicate bvid "${parsed.value.bvid}"`);
      }
      bvids.add(parsed.value.bvid);
      if (parsed.value.review_status === "approved") approved += 1;
      if (parsed.value.review_status === "needs_review") needsReview += 1;
      if (parsed.value.review_status === "untrackable") untrackable += 1;
      if (parsed.value.review_status === "skip") skipped += 1;
    }
  }

  if (errors.length > 0) {
    console.error(`Invalid classification review: ${path.resolve(inputPath)}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`OK: ${path.resolve(inputPath)}`);
  console.log(`Rows: ${parsedRows.length} total, ${approved} approved, ${needsReview} needs_review, ${untrackable} untrackable, ${skipped} skip`);
} catch (error) {
  console.error(`Failed to validate ${inputPath}: ${error.message}`);
  process.exit(1);
}
