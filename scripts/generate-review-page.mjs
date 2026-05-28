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

const STATUS_ALIASES = {
  needs_decision: "needs_review",
  already_correct: "skip",
};

function usage() {
  console.error("用法：generate-review-page.mjs <classification-review.jsonl> [review.html]");
}

function parseJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`第 ${index + 1} 行 JSONL 无效：${error.message}`);
      }
    });
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlDocument(rows, inputPath) {
  rows = rows.map((row) => ({
    ...row,
    review_status: STATUS_ALIASES[row.review_status] || row.review_status || "needs_review",
  }));
  const embeddedRows = JSON.stringify(rows);
  const sourceName = htmlEscape(path.basename(inputPath));
  const generatedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>B站收藏夹分类复核</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --line: #d9dee7;
      --line-strong: #b7c0cd;
      --text: #17202a;
      --muted: #5f6b7a;
      --accent: #1b6ca8;
      --accent-soft: #e6f2fa;
      --danger: #a3342f;
      --warning: #8a5a00;
      --ok: #1f6f43;
      --radius: 8px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      line-height: 1.35;
    }

    button, input, select, textarea {
      font: inherit;
    }

    button {
      border: 1px solid var(--line-strong);
      background: var(--panel);
      color: var(--text);
      min-height: 30px;
      border-radius: 6px;
      padding: 4px 9px;
      cursor: pointer;
    }

    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    button:disabled {
      opacity: .55;
      cursor: default;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      min-height: 30px;
      padding: 4px 7px;
    }

    a { color: var(--accent); }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(246, 247, 249, .96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(8px);
    }

    .header-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 10px 14px;
      display: grid;
      gap: 8px;
    }

    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0;
    }

    .source {
      color: var(--muted);
      font-size: 12px;
    }

    .toolbar {
      display: grid;
      grid-template-columns: minmax(260px, 1.8fr) minmax(140px, .6fr) minmax(110px, .42fr) minmax(260px, 1fr);
      gap: 8px;
      align-items: end;
    }

    .bulkbar {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) minmax(280px, .8fr) auto minmax(220px, .7fr);
      gap: 8px;
      align-items: end;
    }

    .bulk-statuses {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 30px;
      align-items: center;
    }

    .check-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 999px;
      padding: 3px 7px;
      white-space: nowrap;
      color: var(--muted);
    }

    .check-pill input {
      width: auto;
      min-height: 0;
      margin: 0;
    }

    .bulk-message {
      color: var(--muted);
      font-size: 12px;
      min-height: 30px;
      display: flex;
      align-items: center;
    }

    .bulk-message.warn { color: var(--warning); }
    .bulk-message.ok { color: var(--ok); }

    .field label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin: 0 0 3px;
    }

    .actions {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      color: var(--muted);
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 999px;
      padding: 2px 7px;
      white-space: nowrap;
    }

    main {
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      padding: 10px 14px 24px;
    }

    .list {
      display: grid;
      gap: 7px;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(320px, 1.45fr) minmax(230px, .78fr) minmax(210px, .72fr) minmax(250px, .85fr);
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }

    .video-title {
      font-size: 14px;
      font-weight: 650;
      margin: 0 0 4px;
      word-break: break-word;
    }

    .meta {
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      margin-bottom: 4px;
    }

    .reason {
      margin: 4px 0 0;
      color: var(--muted);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .folders {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }

    .label-line {
      color: var(--muted);
      margin-top: 4px;
      font-size: 12px;
    }

    .folder-chip, .tag {
      border: 1px solid var(--line);
      background: #f9fafb;
      border-radius: 999px;
      padding: 1px 6px;
      color: var(--muted);
      font-size: 11px;
    }

    .group {
      display: grid;
      gap: 6px;
      align-content: start;
    }

    .suggestion {
      border-left: 2px solid var(--accent);
      padding-left: 8px;
      color: var(--muted);
    }

    .combo {
      position: relative;
    }

    .combo-menu {
      position: absolute;
      z-index: 30;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 12px 24px rgba(21, 30, 42, .16);
      display: none;
    }

    .combo-menu.open { display: block; }

    .combo-option {
      padding: 6px 8px;
      cursor: pointer;
      border-bottom: 1px solid #eef1f4;
    }

    .combo-option:last-child { border-bottom: 0; }
    .combo-option:hover { background: var(--accent-soft); }
    .combo-option.add { color: var(--accent); font-weight: 650; }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-height: 24px;
      margin-bottom: 4px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--line);
      background: var(--accent-soft);
      border-radius: 999px;
      padding: 2px 6px;
    }

    .chip button {
      min-height: 20px;
      width: 20px;
      padding: 0;
      border-radius: 50%;
      line-height: 1;
      border-color: transparent;
      background: transparent;
    }

    .status-approved { color: var(--ok); }
    .status-needs_review { color: var(--warning); }
    .status-untrackable, .status-skip { color: var(--danger); }

    .pager {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin: 10px 0 0;
      color: var(--muted);
      flex-wrap: wrap;
    }

    .pager-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .empty {
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
      padding: 22px;
      text-align: center;
      background: var(--panel);
      color: var(--muted);
    }

    .file-input {
      display: none;
    }

    @media (max-width: 1080px) {
      .toolbar,
      .bulkbar {
        grid-template-columns: 1fr 1fr;
      }
      .row {
        grid-template-columns: 1fr;
      }
      .actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 640px) {
      .toolbar,
      .bulkbar {
        grid-template-columns: 1fr;
      }
      .title-row {
        align-items: flex-start;
        flex-direction: column;
      }
      main, .header-inner {
        padding-left: 12px;
        padding-right: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="header-inner">
        <div class="title-row">
          <div>
            <h1>B站收藏夹分类复核</h1>
            <div class="source">来源文件：${sourceName} · 生成时间：${htmlEscape(generatedAt)}（Asia/Shanghai）</div>
          </div>
          <div class="actions">
            <button id="importButton" type="button">导入 JSONL</button>
            <button id="exportButton" class="primary" type="button">导出复核 JSONL</button>
            <input id="fileInput" class="file-input" type="file" accept=".jsonl,.txt,application/json">
          </div>
        </div>
        <div class="toolbar">
          <div class="field">
            <label for="searchInput">视频搜索</label>
            <input id="searchInput" type="search" placeholder="标题 / UP / BV / 来源夹 / 标签 / 分类">
          </div>
          <div class="field">
            <label for="statusFilter">状态</label>
            <select id="statusFilter">
              <option value="all">全部状态</option>
              ${STATUSES.map((status) => `<option value="${status}">${STATUS_LABELS[status]}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="pageSize">每页</label>
            <select id="pageSize">
              <option value="50">50</option>
              <option value="100" selected>100</option>
              <option value="200">200</option>
            </select>
          </div>
          <div class="field">
            <label>统计</label>
            <div id="stats" class="stats"></div>
          </div>
        </div>
        <div class="bulkbar">
          <div class="field">
            <label for="bulkPrimaryInput">批量主分类</label>
            <input id="bulkPrimaryInput" type="text" list="categoryDatalist" placeholder="对当前筛选结果设置主分类">
            <datalist id="categoryDatalist"></datalist>
          </div>
          <div class="field">
            <label>批量范围</label>
            <div class="bulk-statuses">
              ${STATUSES.map((status) => `<label class="check-pill"><input type="checkbox" data-role="bulk-status" value="${status}" ${status === "needs_review" ? "checked" : ""}>${STATUS_LABELS[status]}</label>`).join("")}
            </div>
          </div>
          <div class="actions">
            <button id="applyBulkPrimaryButton" type="button">应用到筛选结果</button>
            <button id="approveVisibleButton" type="button">批准当前页</button>
          </div>
          <div id="bulkMessage" class="bulk-message">只改主分类，不改状态</div>
        </div>
      </div>
    </header>
    <main>
      <div id="list" class="list"></div>
      <div class="pager">
        <div id="pageInfo"></div>
        <div class="pager-buttons">
          <button id="prevPage" type="button">上一页</button>
          <button id="nextPage" type="button">下一页</button>
        </div>
      </div>
    </main>
  </div>
  <script id="initialRows" type="application/json">${embeddedRows.replaceAll("<", "\\u003c")}</script>
  <script>
    const STATUS_LABELS = ${JSON.stringify(STATUS_LABELS)};
    const STATUSES = ${JSON.stringify(STATUSES)};
    const STATUS_ALIASES = ${JSON.stringify(STATUS_ALIASES)};
    const DRAFT_KEY = "bilibili-favorites-planner-review:" + location.pathname + ":" + ${JSON.stringify(path.basename(inputPath))};
    let rows = JSON.parse(document.getElementById("initialRows").textContent);
    let draftRestored = false;
    let draftSavedAt = "";
    rows = loadDraftRows(rows);
    let categories = collectCategories(rows);
    let currentPage = 1;

    const els = {
      list: document.getElementById("list"),
      search: document.getElementById("searchInput"),
      status: document.getElementById("statusFilter"),
      pageSize: document.getElementById("pageSize"),
      stats: document.getElementById("stats"),
      pageInfo: document.getElementById("pageInfo"),
      prev: document.getElementById("prevPage"),
      next: document.getElementById("nextPage"),
      exportButton: document.getElementById("exportButton"),
      importButton: document.getElementById("importButton"),
      fileInput: document.getElementById("fileInput"),
      bulkPrimaryInput: document.getElementById("bulkPrimaryInput"),
      categoryDatalist: document.getElementById("categoryDatalist"),
      applyBulkPrimaryButton: document.getElementById("applyBulkPrimaryButton"),
      approveVisibleButton: document.getElementById("approveVisibleButton"),
      bulkMessage: document.getElementById("bulkMessage"),
      bulkStatusInputs: Array.from(document.querySelectorAll('input[data-role="bulk-status"]')),
    };

    function normalizeName(value) {
      return String(value || "").replace(/[\\r\\n\\t]+/g, " ").trim();
    }

    function normalizeReviewStatus(value) {
      const status = String(value || "needs_review");
      const normalized = STATUS_ALIASES[status] || status;
      return STATUSES.includes(normalized) ? normalized : "needs_review";
    }

    function sameRowIdentity(left, right) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
      const leftKeys = left.map(rowKey).sort();
      const rightKeys = right.map(rowKey).sort();
      return leftKeys.every((key, index) => key === rightKeys[index]);
    }

    function loadDraftRows(fallbackRows) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return fallbackRows;
        const draft = JSON.parse(raw);
        if (!draft || !Array.isArray(draft.rows) || !sameRowIdentity(fallbackRows, draft.rows)) {
          return fallbackRows;
        }
        draftRestored = true;
        draftSavedAt = draft.savedAt || "";
        return draft.rows.map((row) => ({
          ...row,
          review_status: normalizeReviewStatus(row.review_status),
        }));
      } catch {
        return fallbackRows;
      }
    }

    function saveDraft() {
      try {
        draftSavedAt = new Date().toLocaleString("zh-CN", { hour12: false });
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: draftSavedAt, rows }));
      } catch {
        // localStorage may be disabled for local files in some browsers.
      }
    }

    function addCategory(value) {
      const name = normalizeName(value);
      if (!name) return "";
      if (!categories.includes(name)) {
        categories.push(name);
        categories.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
      }
      return name;
    }

    function rowKey(row) {
      return String(row.bvid || "") + "::" + String(row.aid || "");
    }

    function collectCategories(items) {
      const set = new Set();
      for (const row of items) {
        [
          row.suggested_primary_folder,
          row.reviewed_primary_folder,
          ...(Array.isArray(row.suggested_secondary_folders) ? row.suggested_secondary_folders : []),
          ...(Array.isArray(row.reviewed_secondary_folders) ? row.reviewed_secondary_folders : []),
        ].forEach((value) => {
          const name = normalizeName(value);
          if (name) set.add(name);
        });
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    }

    function sourceFolderText(row) {
      return (row.source_folders || [])
        .map((folder) => [folder.folder_name, folder.folder_id].filter(Boolean).join(" "))
        .join(" ");
    }

    function tagsText(row) {
      return Array.isArray(row.tags) ? row.tags.join(" ") : "";
    }

    function rowHaystack(row) {
      const suggestedPrimary = normalizeName(row.suggested_primary_folder);
      return [
        row.title,
        row.uploader,
        row.bvid,
        row.url,
        suggestedPrimary === "待复核" ? "" : suggestedPrimary,
        row.reviewed_primary_folder,
        row.reason,
        sourceFolderText(row),
        tagsText(row),
        ...(Array.isArray(row.suggested_secondary_folders) ? row.suggested_secondary_folders : []),
        ...(Array.isArray(row.reviewed_secondary_folders) ? row.reviewed_secondary_folders : []),
      ].filter(Boolean).join(" ").toLowerCase();
    }

    function filteredRows() {
      const query = els.search.value.trim().toLowerCase();
      const status = els.status.value;
      return rows.filter((row) => {
        if (status !== "all" && row.review_status !== status) return false;
        if (query && !rowHaystack(row).includes(query)) return false;
        return true;
      });
    }

    function selectedBulkStatuses() {
      return new Set(els.bulkStatusInputs.filter((input) => input.checked).map((input) => input.value));
    }

    function bulkTargetRows(filtered) {
      const selected = selectedBulkStatuses();
      if (selected.size === 0) return [];
      return filtered.filter((row) => selected.has(row.review_status));
    }

    function statusClass(status) {
      return "status-" + String(status || "").replace(/[^a-z_]/g, "");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function renderStats(filtered) {
      const counts = new Map(STATUSES.map((status) => [status, 0]));
      for (const row of rows) {
        counts.set(row.review_status, (counts.get(row.review_status) || 0) + 1);
      }
      els.stats.innerHTML = [
        ["总数", rows.length],
        ["命中", filtered.length],
        ...STATUSES.map((status) => [STATUS_LABELS[status] || status, counts.get(status) || 0]),
      ].map(([label, count]) => '<span class="pill">' + escapeHtml(label) + ': ' + count + '</span>').join("");
    }

    function renderCategoryDatalist() {
      els.categoryDatalist.innerHTML = categories
        .map((name) => '<option value="' + escapeHtml(name) + '"></option>')
        .join("");
    }

    function setBulkMessage(text, tone = "") {
      els.bulkMessage.textContent = text;
      els.bulkMessage.className = "bulk-message" + (tone ? " " + tone : "");
    }

    function updateBulkPreview(filtered) {
      const count = filtered.length;
      const selected = selectedBulkStatuses();
      const targetCount = selected.size === 0 ? 0 : bulkTargetRows(filtered).length;
      const name = normalizeName(els.bulkPrimaryInput.value);
      if (selected.size === 0) {
        setBulkMessage("请至少选择一个批量状态", "warn");
        return;
      }
      if (!name) {
        const draftText = draftSavedAt ? " · 草稿已保存 " + draftSavedAt : "";
        setBulkMessage("命中 " + count + " 条，按状态将修改 " + targetCount + " 条" + draftText);
        return;
      }
      setBulkMessage("命中 " + count + " 条，将把 " + targetCount + " 条主分类设为“" + name + "”");
    }

    function render(options = {}) {
      if (!options.skipCommit) {
        commitVisibleDrafts();
      }
      const filtered = filteredRows();
      const pageSize = Number(els.pageSize.value);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;
      const start = (currentPage - 1) * pageSize;
      const pageRows = filtered.slice(start, start + pageSize);

      renderStats(filtered);
      renderCategoryDatalist();
      updateBulkPreview(filtered);
      els.list.innerHTML = "";
      if (pageRows.length === 0) {
        els.list.innerHTML = '<div class="empty">没有匹配的视频</div>';
      } else {
        for (const row of pageRows) {
          els.list.appendChild(renderRow(row));
        }
      }

      els.pageInfo.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页 · 显示 ' + pageRows.length + ' 条 · 命中 ' + filtered.length + ' 条';
      els.prev.disabled = currentPage <= 1;
      els.next.disabled = currentPage >= totalPages;
    }

    function renderRow(row) {
      const root = document.createElement("section");
      root.className = "row";

      const info = document.createElement("div");
      info.className = "group";
      info.innerHTML = '<div>' +
        '<p class="video-title"><a href="' + escapeHtml(row.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(row.title) + '</a></p>' +
        '<div class="meta"><span>' + escapeHtml(row.bvid) + '</span><span>UP：' + escapeHtml(row.uploader || "未知") + '</span><span class="' + statusClass(row.review_status) + '">' + escapeHtml(STATUS_LABELS[row.review_status] || row.review_status) + '</span></div>' +
        '<div class="label-line"><strong>来源夹：</strong></div>' +
        '<div class="folders">' + ((row.source_folders || []).length ? (row.source_folders || []).map((folder) => '<span class="folder-chip">' + escapeHtml(folder.folder_name) + '</span>').join("") : '<span class="folder-chip">无</span>') + '</div>' +
        '<div class="label-line"><strong>标签：</strong></div>' +
        '<div class="folders">' + (Array.isArray(row.tags) && row.tags.length ? row.tags.map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join("") : '<span class="tag">无</span>') + '</div>' +
        '</div>';

      const suggestion = document.createElement("div");
      suggestion.className = "group";
      suggestion.innerHTML = '<div class="suggestion">' +
        '<div><strong>建议主分类</strong>：' + escapeHtml(row.suggested_primary_folder || "") + '</div>' +
        '<div><strong>建议次分类</strong>：' + escapeHtml((row.suggested_secondary_folders || []).join(", ") || "无") + '</div>' +
        '<div><strong>置信度</strong>：' + escapeHtml(row.confidence || "") + '</div>' +
        '<p class="reason">' + escapeHtml(row.reason || "") + '</p>' +
        '</div>';

      const reviewPrimary = document.createElement("div");
      reviewPrimary.className = "group";

      const statusField = fieldWrapper("状态");
      const statusSelect = document.createElement("select");
      for (const status of STATUSES) {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = STATUS_LABELS[status] || status;
        statusSelect.appendChild(option);
      }
      statusSelect.value = row.review_status || "needs_review";
      statusSelect.addEventListener("change", () => {
        row.review_status = statusSelect.value;
        saveDraft();
        render();
      });
      statusField.appendChild(statusSelect);

      const primaryField = fieldWrapper("主分类");
      primaryField.appendChild(createPrimaryCombo(row));

      reviewPrimary.append(statusField, primaryField);

      const reviewSecondary = document.createElement("div");
      reviewSecondary.className = "group";
      const secondaryField = fieldWrapper("次分类");
      secondaryField.appendChild(createSecondaryPicker(row));
      reviewSecondary.appendChild(secondaryField);

      root.append(info, suggestion, reviewPrimary, reviewSecondary);
      return root;
    }

    function fieldWrapper(labelText) {
      const wrapper = document.createElement("div");
      wrapper.className = "field";
      const label = document.createElement("label");
      label.textContent = labelText;
      wrapper.appendChild(label);
      return wrapper;
    }

    function createPrimaryCombo(row) {
      const combo = document.createElement("div");
      combo.className = "combo";
      const input = document.createElement("input");
      input.dataset.role = "primary-folder";
      input.dataset.rowKey = rowKey(row);
      input.value = row.reviewed_primary_folder || "";
      input.placeholder = "搜索或新增分类";
      const menu = document.createElement("div");
      menu.className = "combo-menu";
      combo.append(input, menu);

      function commit(value) {
        const name = addCategory(value);
        row.reviewed_primary_folder = name;
        input.value = name;
        menu.classList.remove("open");
        saveDraft();
        render();
      }

      function refreshMenu() {
        const query = input.value.trim().toLowerCase();
        const matches = categories.filter((name) => !query || name.toLowerCase().includes(query)).slice(0, 40);
        const exact = categories.some((name) => name === normalizeName(input.value));
        menu.innerHTML = "";
        for (const name of matches) {
          const option = document.createElement("div");
          option.className = "combo-option";
          option.textContent = name;
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            commit(name);
          });
          menu.appendChild(option);
        }
        const proposed = normalizeName(input.value);
        if (proposed && !exact) {
          const add = document.createElement("div");
          add.className = "combo-option add";
          add.textContent = "新增分类：" + proposed;
          add.addEventListener("mousedown", (event) => {
            event.preventDefault();
            commit(proposed);
          });
          menu.appendChild(add);
        }
        menu.classList.toggle("open", menu.children.length > 0);
      }

      input.addEventListener("input", refreshMenu);
      input.addEventListener("focus", refreshMenu);
      input.addEventListener("blur", () => {
        const value = normalizeName(input.value);
        row.reviewed_primary_folder = value;
        if (value) addCategory(value);
        saveDraft();
        setTimeout(() => menu.classList.remove("open"), 120);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(input.value);
        }
      });
      return combo;
    }

    function createSecondaryPicker(row) {
      if (!Array.isArray(row.reviewed_secondary_folders)) {
        row.reviewed_secondary_folders = [];
      }
      const wrapper = document.createElement("div");
      const chips = document.createElement("div");
      chips.className = "chips";
      const combo = document.createElement("div");
      combo.className = "combo";
      const input = document.createElement("input");
      input.placeholder = "搜索或新增次分类";
      const menu = document.createElement("div");
      menu.className = "combo-menu";
      combo.append(input, menu);
      wrapper.append(chips, combo);

      function renderChips() {
        chips.innerHTML = "";
        for (const name of row.reviewed_secondary_folders) {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.append(document.createTextNode(name));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "x";
          remove.title = "移除此视频的次分类";
          remove.addEventListener("click", () => {
            row.reviewed_secondary_folders = row.reviewed_secondary_folders.filter((item) => item !== name);
            saveDraft();
            render();
          });
          chip.appendChild(remove);
          chips.appendChild(chip);
        }
      }

      function commit(value) {
        const name = addCategory(value);
        if (!name) return;
        if (!row.reviewed_secondary_folders.includes(name)) {
          row.reviewed_secondary_folders.push(name);
        }
        input.value = "";
        menu.classList.remove("open");
        saveDraft();
        render();
      }

      function refreshMenu() {
        const query = input.value.trim().toLowerCase();
        const matches = categories
          .filter((name) => !row.reviewed_secondary_folders.includes(name))
          .filter((name) => !query || name.toLowerCase().includes(query))
          .slice(0, 40);
        const exact = categories.some((name) => name === normalizeName(input.value));
        menu.innerHTML = "";
        for (const name of matches) {
          const option = document.createElement("div");
          option.className = "combo-option";
          option.textContent = name;
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            commit(name);
          });
          menu.appendChild(option);
        }
        const proposed = normalizeName(input.value);
        if (proposed && !exact) {
          const add = document.createElement("div");
          add.className = "combo-option add";
          add.textContent = "新增分类：" + proposed;
          add.addEventListener("mousedown", (event) => {
            event.preventDefault();
            commit(proposed);
          });
          menu.appendChild(add);
        }
        menu.classList.toggle("open", menu.children.length > 0);
      }

      input.addEventListener("input", refreshMenu);
      input.addEventListener("focus", refreshMenu);
      input.addEventListener("blur", () => setTimeout(() => menu.classList.remove("open"), 120));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(input.value);
        }
      });
      renderChips();
      return wrapper;
    }

    function commitVisibleDrafts() {
      for (const input of document.querySelectorAll('input[data-role="primary-folder"]')) {
        const row = rows.find((item) => rowKey(item) === input.dataset.rowKey);
        if (!row) continue;
        const value = normalizeName(input.value);
        row.reviewed_primary_folder = value;
        if (value) addCategory(value);
      }
      saveDraft();
    }

    function serializeJsonl(items) {
      return items.map((row) => JSON.stringify(row)).join("\\n") + "\\n";
    }

    function exportRows() {
      commitVisibleDrafts();
      saveDraft();
      const blob = new Blob([serializeJsonl(rows)], { type: "application/jsonl;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "reviewed-classification.jsonl";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function parseImportedJsonl(text) {
      return text.split(/\\r?\\n/)
        .filter((line) => line.trim().length > 0)
        .map((line, index) => {
          try {
            const row = JSON.parse(line);
            row.review_status = normalizeReviewStatus(row.review_status);
            return row;
          } catch (error) {
            throw new Error("第 " + (index + 1) + " 行 JSON 无效：" + error.message);
          }
        });
    }

    function applyBulkPrimary() {
      commitVisibleDrafts();
      const name = addCategory(els.bulkPrimaryInput.value);
      if (!name) {
        setBulkMessage("请先输入主分类", "warn");
        return;
      }
      const filtered = filteredRows();
      const selected = selectedBulkStatuses();
      if (selected.size === 0) {
        setBulkMessage("请至少选择一个批量状态", "warn");
        return;
      }
      const targets = bulkTargetRows(filtered);
      if (targets.length === 0) {
        setBulkMessage("当前筛选结果中没有符合批量状态的行", "warn");
        return;
      }
      for (const row of targets) {
        row.reviewed_primary_folder = name;
      }
      saveDraft();
      render({ skipCommit: true });
      setBulkMessage("已将 " + targets.length + " 条主分类设为“" + name + "”。状态未改变", "ok");
    }

    function approveVisible() {
      commitVisibleDrafts();
      const filtered = filteredRows();
      const pageSize = Number(els.pageSize.value);
      const start = (currentPage - 1) * pageSize;
      let changed = 0;
      for (const row of filtered.slice(start, start + pageSize)) {
        if (row.reviewed_primary_folder) {
          row.review_status = "approved";
          changed += 1;
        }
      }
      if (changed === 0) {
        alert("当前页没有已填写主分类的视频");
        return;
      }
      saveDraft();
      if (filteredRows().length === 0 && els.status.value !== "all") {
        els.status.value = "all";
        currentPage = 1;
        render();
        setBulkMessage("当前状态筛选已无结果，已切回全部状态", "ok");
        return;
      }
      render();
    }

    els.search.addEventListener("input", () => { commitVisibleDrafts(); currentPage = 1; render(); });
    els.status.addEventListener("change", () => { commitVisibleDrafts(); currentPage = 1; render(); });
    els.pageSize.addEventListener("change", () => { commitVisibleDrafts(); currentPage = 1; render(); });
    els.prev.addEventListener("click", () => { commitVisibleDrafts(); currentPage -= 1; render(); });
    els.next.addEventListener("click", () => { commitVisibleDrafts(); currentPage += 1; render(); });
    els.exportButton.addEventListener("click", exportRows);
    els.importButton.addEventListener("click", () => els.fileInput.click());
    els.applyBulkPrimaryButton.addEventListener("click", applyBulkPrimary);
    els.bulkPrimaryInput.addEventListener("input", () => updateBulkPreview(filteredRows()));
    for (const input of els.bulkStatusInputs) {
      input.addEventListener("change", () => updateBulkPreview(filteredRows()));
    }
    els.approveVisibleButton.addEventListener("click", approveVisible);
    els.bulkPrimaryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyBulkPrimary();
      }
    });
    els.fileInput.addEventListener("change", async () => {
      const file = els.fileInput.files[0];
      if (!file) return;
      try {
        rows = parseImportedJsonl(await file.text());
        categories = collectCategories(rows);
        currentPage = 1;
        saveDraft();
        render();
      } catch (error) {
        alert(error.message);
      } finally {
        els.fileInput.value = "";
      }
    });

    document.addEventListener("click", (event) => {
      for (const menu of document.querySelectorAll(".combo-menu.open")) {
        if (!menu.parentElement.contains(event.target)) {
          menu.classList.remove("open");
        }
      }
    });

    window.addEventListener("beforeunload", () => {
      commitVisibleDrafts();
      saveDraft();
    });

    render();
    if (draftRestored) {
      setBulkMessage("已恢复本地草稿" + (draftSavedAt ? "：" + draftSavedAt : ""), "ok");
    }
  </script>
</body>
</html>
`;
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "review.html";

if (!inputPath) {
  usage();
  process.exit(2);
}

try {
  const rows = parseJsonl(inputPath);
  const output = htmlDocument(rows, inputPath);
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`完成：已写入 ${path.resolve(outputPath)}`);
  console.log(`行数：${rows.length}`);
} catch (error) {
  console.error(`生成复核页失败：${error.message}`);
  process.exit(1);
}
