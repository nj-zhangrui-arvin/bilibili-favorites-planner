#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.error("用法：normalize-crawler-output.mjs <input.json|jsonl> <evidence.jsonl>");
}

function readInput(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const payload = JSON.parse(trimmed);
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.rows)) return payload.rows;
      if (Array.isArray(payload.items)) return payload.items;
      if (Array.isArray(payload.videos)) return payload.videos;
      return [payload];
    } catch {
      // JSONL often starts with "{"; fall through.
    }
  }
  return trimmed.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`第 ${index + 1} 行 JSONL 无效：${error.message}`);
    }
  });
}

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function name(value) {
  return text(value).replace(/[\r\n\t]+/g, " ").trim();
}

function normalizeSourceFolders(row) {
  if (Array.isArray(row.source_folders)) {
    return row.source_folders.map((folder) => ({
      folder_name: name(folder.folder_name || folder.name || folder.title),
      folder_id: text(folder.folder_id || folder.media_id || folder.fid || folder.id),
    })).filter((folder) => folder.folder_name || folder.folder_id);
  }
  const folderName = name(row.source_folder || row.folder_name || row.media_title);
  const folderId = text(row.source_folder_id || row.folder_id || row.media_id || row.fid);
  return folderName || folderId ? [{ folder_name: folderName, folder_id: folderId }] : [];
}

function normalizeRow(row) {
  const bvid = text(row.bvid || row.bv_id || row.bv);
  const aid = text(row.aid || row.id || row.oid || row.archive?.aid || row.stat?.aid);
  const title = name(row.title || row.name);
  const invalid = Boolean(row.invalid_or_unavailable || row.invalid || row.attr === 9 || row.state < 0);
  return {
    bvid,
    aid,
    title: title || "已失效视频",
    url: text(row.url || (bvid ? `https://www.bilibili.com/video/${bvid}` : "")),
    uploader: name(row.uploader || row.upper?.name || row.owner?.name),
    source_folders: normalizeSourceFolders(row),
    tags: Array.isArray(row.tags) ? row.tags.map(name).filter(Boolean) : [],
    partition: name(row.partition || row.tname),
    description: text(row.description || row.desc || row.intro),
    invalid_or_unavailable: invalid,
    fetch_status: text(row.fetch_status || (invalid ? "unavailable" : "ok")),
  };
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  usage();
  process.exit(2);
}

try {
  const rows = readInput(inputPath).map(normalizeRow);
  fs.writeFileSync(outputPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  console.log(`完成：已写入 ${path.resolve(outputPath)}`);
  console.log(`行数：${rows.length}`);
} catch (error) {
  console.error(`规范化失败：${error.message}`);
  process.exit(1);
}
