#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TAXONOMY_RULES = [
  ["AI/学习", ["ai", "agent", "openai", "claude", "deepseek", "gemini", "llm", "大模型", "人工智能", "提示词", "机器学习", "学习效率"]],
  ["编程/开发", ["python", "javascript", "typescript", "node", "代码", "编程", "开发", "程序员", "github", "开源", "前端", "后端", "数据库", "架构"]],
  ["面试/职场", ["面试", "简历", "职场", "求职", "招聘", "offer", "升职", "绩效", "职业规划"]],
  ["工具/工作流", ["工具", "效率", "工作流", "自动化", "workflow", "notion", "obsidian", "raycast", "快捷键", "脚本", "配置"]],
  ["健身/锻炼", ["健身", "训练", "锻炼", "减脂", "增肌", "跑步", "瑜伽", "拉伸", "饮食控制"]],
  ["旅游/攻略", ["旅游", "旅行", "攻略", "徒步", "自驾", "露营", "路线", "酒店", "景区"]],
  ["自然风光", ["风景", "自然", "山", "海", "湖", "森林", "草原", "雪山", "日出", "日落"]],
  ["古代文学", ["古文", "文学", "诗词", "唐诗", "宋词", "红楼梦", "史记", "古代"]],
  ["英雄人物", ["人物", "传记", "英雄", "历史人物", "名人", "人物志"]],
  ["人情世故", ["人情世故", "情商", "沟通", "社交", "关系", "说话", "处世"]],
  ["科技前沿", ["科技", "芯片", "机器人", "量子", "航天", "新能源", "自动驾驶", "vr", "ar"]],
  ["财经/理财", ["财经", "理财", "股票", "基金", "投资", "经济", "商业", "财报", "房价"]],
  ["美食/做菜", ["美食", "做菜", "菜谱", "烹饪", "厨房", "食材", "料理", "探店"]],
  ["新闻/时事", ["新闻", "时事", "热点", "国际", "社会", "政策", "事件"]],
  ["娱乐/轻松看", ["搞笑", "娱乐", "综艺", "游戏", "鬼畜", "吐槽", "整活", "轻松"]],
  ["娱乐/值得重看", ["电影", "影视", "纪录片", "动画", "短片", "故事", "音乐", "演唱会", "经典"]],
];

const REVIEWED_STATUSES = new Set(["approved", "codex_batch_reviewed", "reviewed", "manual_reviewed"]);

function usage() {
  console.error("用法：build-classification-review.mjs <inventory-or-evidence.json|jsonl> <classification-review.jsonl>");
}

function readInput(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const payload = JSON.parse(trimmed);
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.videos)) return payload.videos;
      if (Array.isArray(payload.items)) return payload.items;
      return [payload];
    } catch {
      // Many JSONL files start with "{"; fall through to line-by-line parsing.
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

function normalizeName(value) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim();
}

function stringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeAid(row) {
  return stringValue(row.aid || row.aid_str || row.stat?.aid || row.archive?.aid);
}

function normalizeUrl(row) {
  if (row.url) return String(row.url);
  if (row.bvid) return `https://www.bilibili.com/video/${row.bvid}`;
  return "";
}

function normalizeSourceFolders(row) {
  if (Array.isArray(row.source_folders)) {
    return row.source_folders
      .map((folder) => ({
        folder_name: normalizeName(folder.folder_name || folder.name || folder.title),
        folder_id: stringValue(folder.folder_id || folder.media_id || folder.id),
      }))
      .filter((folder) => folder.folder_name || folder.folder_id);
  }
  const folderName = normalizeName(row.source_folder || row.folder_name);
  const folderId = stringValue(row.source_folder_id || row.folder_id || row.media_id);
  return folderName || folderId ? [{ folder_name: folderName, folder_id: folderId }] : [];
}

function normalizeTags(row) {
  if (!Array.isArray(row.tags)) return [];
  return row.tags.map((tag) => normalizeName(tag)).filter(Boolean);
}

function classificationFromRow(row) {
  const nested = row.classification && typeof row.classification === "object" ? row.classification : {};
  const primary = normalizeName(
    row.reviewed_primary_folder ||
    row.primary_folder ||
    nested.primary_folder ||
    row.suggested_primary_folder
  );
  const secondary = Array.isArray(row.reviewed_secondary_folders) ? row.reviewed_secondary_folders :
    Array.isArray(row.secondary_folders) ? row.secondary_folders :
    Array.isArray(nested.secondary_folders) ? nested.secondary_folders :
    Array.isArray(row.suggested_secondary_folders) ? row.suggested_secondary_folders :
    [];
  const confidence = normalizeName(row.confidence || nested.confidence);
  const reason = normalizeName(row.reason || nested.reason);
  return {
    primary,
    secondary: secondary.map(normalizeName).filter(Boolean),
    confidence,
    reason,
  };
}

function textForRules(row) {
  return [
    row.title,
    row.uploader,
    row.partition,
    row.description,
    normalizeSourceFolders(row).map((folder) => folder.folder_name).join(" "),
    normalizeTags(row).join(" "),
  ].filter(Boolean).join(" ").toLowerCase();
}

function ruleClassify(row) {
  const text = textForRules(row);
  const scores = [];
  for (const [folder, keywords] of TAXONOMY_RULES) {
    let score = 0;
    const hits = [];
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
        hits.push(keyword);
      }
    }
    if (score > 0) scores.push({ folder, score, hits });
  }

  scores.sort((a, b) => b.score - a.score || a.folder.localeCompare(b.folder, "zh-Hans-CN"));
  if (scores.length === 0) {
    return {
      primary: "待复核",
      secondary: [],
      confidence: "low",
      reason: "未命中明确分类规则",
      reviewStatus: "needs_review",
    };
  }

  const top = scores[0];
  const tied = scores.filter((item) => item.score === top.score);
  const secondary = scores
    .slice(1, 3)
    .filter((item) => item.score >= 2 && item.score >= top.score - 1)
    .map((item) => item.folder);

  if (tied.length > 1) {
    return {
      primary: top.folder,
      secondary,
      confidence: "medium",
      reason: `候选冲突：${tied.map((item) => item.folder).join("、")}`,
      reviewStatus: "needs_review",
    };
  }

  const confidence = top.score >= 3 ? "high" : top.score >= 2 ? "medium" : "low";
  return {
    primary: top.folder,
    secondary,
    confidence,
    reason: `命中关键词：${top.hits.slice(0, 5).join("、")}`,
    reviewStatus: "needs_review",
  };
}

function reviewStatusFromRow(row, classification, ruleResult, executable) {
  if (row.invalid_or_unavailable || row.fetch_status === "invalid" || row.fetch_status === "unavailable") {
    return "untrackable";
  }
  if (!executable) return "untrackable";
  const current = normalizeName(row.review_status);
  if (REVIEWED_STATUSES.has(current)) return "approved";
  if (current === "already_correct") return "skip";
  if (current === "needs_decision") return "needs_review";
  if (current === "skip" || current === "untrackable") return current;
  if (classification.primary && (row.classification_source || row.reviewed_primary_folder)) {
    return "approved";
  }
  return ruleResult.reviewStatus;
}

function toReviewRow(row) {
  const sourceFolders = normalizeSourceFolders(row);
  const aid = normalizeAid(row);
  const executable = Boolean(aid && sourceFolders.some((folder) => folder.folder_name && folder.folder_id));
  const existing = classificationFromRow(row);
  const ruleResult = existing.primary ? {
    primary: existing.primary,
    secondary: existing.secondary,
    confidence: existing.confidence || "medium",
    reason: existing.reason || "沿用输入中的分类结果",
    reviewStatus: "needs_review",
  } : ruleClassify(row);
  const reviewStatus = reviewStatusFromRow(row, existing, ruleResult, executable);
  const primary = ruleResult.primary || "待复核";
  const secondary = Array.from(new Set(ruleResult.secondary.filter((folder) => folder && folder !== primary)));

  return {
    bvid: stringValue(row.bvid),
    aid,
    title: stringValue(row.title || row.name),
    url: normalizeUrl(row),
    uploader: stringValue(row.uploader || row.upper?.name),
    source_folders: sourceFolders,
    tags: normalizeTags(row),
    suggested_primary_folder: primary,
    suggested_secondary_folders: secondary,
    confidence: ruleResult.confidence || "low",
    reason: ruleResult.reason || "待人工复核",
    review_status: reviewStatus,
    reviewed_primary_folder: reviewStatus === "untrackable" ? "" : primary,
    reviewed_secondary_folders: reviewStatus === "untrackable" ? [] : secondary,
  };
}

function dedupeByBvid(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = row.bvid || `${row.title}:${row.url}`;
    if (!seen.has(key)) {
      seen.set(key, row);
      continue;
    }
    const existing = seen.get(key);
    const mergedSources = [...(existing.source_folders || []), ...(row.source_folders || [])];
    const sourceKey = (folder) => `${folder.folder_id}::${folder.folder_name}`;
    const sourceMap = new Map(mergedSources.map((folder) => [sourceKey(folder), folder]));
    existing.source_folders = Array.from(sourceMap.values());
    existing.tags = Array.from(new Set([...(existing.tags || []), ...(row.tags || [])]));
  }
  return Array.from(seen.values());
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  usage();
  process.exit(2);
}

try {
  const inputRows = readInput(inputPath);
  const reviewRows = dedupeByBvid(inputRows.map(toReviewRow));
  fs.writeFileSync(outputPath, `${reviewRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const counts = reviewRows.reduce((acc, row) => {
    acc[row.review_status] = (acc[row.review_status] || 0) + 1;
    return acc;
  }, {});
  console.log(`完成：已写入 ${path.resolve(outputPath)}`);
  console.log(`复核行数：${reviewRows.length}`);
  console.log(`状态：${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(", ")}`);
} catch (error) {
  console.error(`生成分类复核文件失败：${error.message}`);
  process.exit(1);
}
