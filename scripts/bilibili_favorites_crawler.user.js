// ==UserScript==
// @name         Bilibili Favorites Crawler
// @namespace    https://github.com/nj-zhangrui-arvin/bilibili-favorites-crawler
// @version      0.1.0
// @description  Read-only exporter for your own Bilibili favorites. Downloads evidence JSONL for the Planner.
// @match        https://space.bilibili.com/*/favlist*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const PANEL_ID = "bili-favorites-crawler-panel";
  const STORAGE_PREFIX = "bili-favorites-crawler-checkpoint:";
  const PANEL_RIGHT_PX = 18;
  const PANEL_BOTTOM_PX = 286;
  const config = {
    pageSize: 20,
    includeTags: false,
    requestDelayMs: 900,
    folderDelayMs: 1500,
    maxErrors: 3,
  };
  const testConfig = {
    maxFolders: 1,
    maxPagesPerFolder: 1,
    maxMetadataVideos: 10,
  };

  let running = false;
  let stopped = false;
  let progress = null;
  let activeMode = "full";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();
  const text = (value) => (value == null ? "" : String(value));
  const clean = (value) => text(value).replace(/[\r\n\t]+/g, " ").trim();
  const formatClock = (date) => date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "估算中";
    const seconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours) return `${hours}小时${minutes}分`;
    if (minutes) return `${minutes}分${rest}秒`;
    return `${rest}秒`;
  }

  function resetProgress(phase = "就绪") {
    progress = {
      phase,
      startedAt: Date.now(),
      phaseStartedAt: Date.now(),
      done: 0,
      total: 0,
      rows: 0,
      detail: "",
    };
    renderProgress();
  }

  function updateProgress(next) {
    const oldPhase = progress?.phase;
    progress = {
      startedAt: progress?.startedAt || Date.now(),
      phaseStartedAt: progress?.phaseStartedAt || Date.now(),
      done: progress?.done || 0,
      total: progress?.total || 0,
      rows: progress?.rows || 0,
      detail: progress?.detail || "",
      phase: progress?.phase || "就绪",
      ...next,
    };
    if (next.phase && next.phase !== oldPhase) {
      progress.phaseStartedAt = Date.now();
      progress.done = next.done || 0;
    }
    renderProgress();
  }

  function renderProgress() {
    const fill = document.querySelector(`#${PANEL_ID} [data-role="progress-fill"]`);
    const textNode = document.querySelector(`#${PANEL_ID} [data-role="progress-text"]`);
    const metaNode = document.querySelector(`#${PANEL_ID} [data-role="progress-meta"]`);
    if (!fill || !textNode || !metaNode || !progress) return;

    const hasTotal = Number.isFinite(progress.total) && progress.total > 0;
    const done = Math.max(0, Number(progress.done) || 0);
    const percent = hasTotal ? Math.min(100, Math.round((done / progress.total) * 100)) : 0;
    const elapsed = Date.now() - progress.startedAt;
    let etaText = "预计剩余：估算中";
    if (hasTotal && done > 0) {
      const phaseElapsed = Date.now() - progress.phaseStartedAt;
      const remaining = Math.max(0, (phaseElapsed / done) * (progress.total - done));
      const finishAt = new Date(Date.now() + remaining);
      etaText = `预计剩余：${formatDuration(remaining)}，约 ${formatClock(finishAt)} 完成`;
    }

    fill.style.width = `${percent}%`;
    textNode.textContent = hasTotal ? `${progress.phase}: ${done}/${progress.total} (${percent}%)` : `${progress.phase}: ${done}`;
    metaNode.textContent = `已用时：${formatDuration(elapsed)} · ${etaText} · 已采集 ${progress.rows || 0} 条${progress.detail ? ` · ${progress.detail}` : ""}`;
  }

  function log(message) {
    const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}`;
    console.log(`[bili-crawler] ${message}`);
    const node = document.querySelector(`#${PANEL_ID} [data-role="log"]`);
    if (node) {
      node.textContent = `${line}\n${node.textContent || ""}`.slice(0, 5000);
    }
  }

  function setStatus(message) {
    const node = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
    if (node) node.textContent = message;
  }

  function currentMid() {
    const match = location.href.match(/space\.bilibili\.com\/(\d+)/);
    return match ? match[1] : "";
  }

  function checkpointKey(mode = activeMode) {
    return `${STORAGE_PREFIX}${mode}:${currentMid() || "unknown"}`;
  }

  function loadCheckpoint(mode = activeMode) {
    try {
      const raw = localStorage.getItem(checkpointKey(mode));
      if (!raw) return null;
      const checkpoint = JSON.parse(raw);
      if (!checkpoint || checkpoint.version !== 1 || !Array.isArray(checkpoint.rows)) return null;
      return checkpoint;
    } catch (error) {
      console.warn("[bili-crawler] 读取检查点失败", error);
      return null;
    }
  }

  function saveCheckpoint(checkpoint) {
    localStorage.setItem(checkpointKey(checkpoint.mode || activeMode), JSON.stringify({
      ...checkpoint,
      mode: checkpoint.mode || activeMode,
      updatedAt: now(),
      page: location.href,
    }));
    renderCheckpointState();
  }

  function clearCheckpoint(mode = activeMode) {
    localStorage.removeItem(checkpointKey(mode));
    renderCheckpointState();
  }

  function renderCheckpointState() {
    const checkpoint = loadCheckpoint("full");
    const testCheckpoint = loadCheckpoint("test");
    const start = document.querySelector(`#${PANEL_ID} [data-role="start"]`);
    const test = document.querySelector(`#${PANEL_ID} [data-role="test"]`);
    const clear = document.querySelector(`#${PANEL_ID} [data-role="clear"]`);
    const resume = document.querySelector(`#${PANEL_ID} [data-role="resume"]`);
    if (start) start.textContent = checkpoint ? "继续采集" : "导出收藏夹 JSONL";
    if (test) test.textContent = testCheckpoint ? "继续测试" : "测试采集";
    if (clear) clear.disabled = (!checkpoint && !testCheckpoint) || running;
    if (resume) {
      const visibleCheckpoint = checkpoint || testCheckpoint;
      resume.textContent = visibleCheckpoint
        ? `可继续：${visibleCheckpoint.mode === "test" ? "测试" : "完整"} · ${visibleCheckpoint.phase === "metadata" ? "补充元数据" : "读取收藏夹"} · 已采集 ${visibleCheckpoint.rows.length} 条 · ${visibleCheckpoint.updatedAt || ""}`
        : "暂无未完成采集";
    }
  }

  function getIncludeTagsFromUi() {
    const checkbox = document.querySelector(`#${PANEL_ID} [data-role="include-tags"]`);
    return Boolean(checkbox?.checked);
  }

  function shouldStopForRisk(detail) {
    return /HTTP_403|HTTP_412|API_-101|csrf|captcha|验证码|登录|风控/i.test(detail);
  }

  async function apiGet(url, params = {}) {
    const endpoint = new URL(url, location.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") endpoint.searchParams.set(key, value);
    }
    const response = await fetch(endpoint.toString(), {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" },
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}_${endpoint.pathname}`);
    const payload = await response.json();
    if (payload.code !== 0) throw new Error(`API_${payload.code}_${payload.message || endpoint.pathname}`);
    return payload.data;
  }

  function download(name, content, type = "application/octet-stream") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_self";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent("click", {
      bubbles: false,
      cancelable: true,
      view: window,
    }));
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function normalizeFolder(row) {
    return {
      folder_id: text(row.id || row.fid || row.media_id || row.folder_id),
      folder_name: clean(row.title || row.name || row.folder_name),
      count: Number.isFinite(Number(row.media_count ?? row.count ?? row.cnt)) ? Number(row.media_count ?? row.count ?? row.cnt) : null,
    };
  }

  async function fetchFolders() {
    const upMid = currentMid();
    if (!upMid) throw new Error("无法从当前 URL 识别空间 mid");
    const data = await apiGet("https://api.bilibili.com/x/v3/fav/folder/created/list-all", {
      up_mid: upMid,
      type: 0,
    });
    const list = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
    return list.map(normalizeFolder).filter((folder) => folder.folder_id && folder.folder_name);
  }

  function normalizeVideo(item, folder) {
    const bvid = text(item.bvid || item.bv_id);
    const aid = text(item.id || item.aid || item.oid || item.archive?.aid);
    const unavailable = Boolean(item.attr === 9 || item.state < 0 || item.page === 0 && !bvid);
    return {
      bvid,
      aid,
      title: clean(item.title || item.name || "已失效视频"),
      url: bvid ? `https://www.bilibili.com/video/${bvid}` : "",
      uploader: clean(item.upper?.name || item.owner?.name || item.author),
      source_folders: [{ folder_name: folder.folder_name, folder_id: folder.folder_id }],
      tags: [],
      partition: clean(item.tname || item.type_name),
      description: text(item.intro || item.desc),
      invalid_or_unavailable: unavailable,
      fetch_status: unavailable ? "unavailable" : "ok",
      captured_at: now(),
    };
  }

  async function fetchFolderVideos(folder, folderProgressBase = 0, estimatedPages = 0, maxPages = Infinity) {
    const rows = [];
    let page = 1;
    while (!stopped) {
      const data = await apiGet("https://api.bilibili.com/x/v3/fav/resource/list", {
        media_id: folder.folder_id,
        pn: page,
        ps: config.pageSize,
        keyword: "",
        order: "mtime",
        type: 0,
        tid: 0,
        platform: "web",
      });
      const medias = Array.isArray(data?.medias) ? data.medias : [];
      for (const item of medias) rows.push(normalizeVideo(item, folder));
      log(`${folder.folder_name}: 第 ${page} 页，${medias.length} 条`);
      updateProgress({
        done: folderProgressBase + page,
        total: estimatedPages,
        rows: (progress?.rows || 0) + medias.length,
        detail: `${folder.folder_name} 第 ${page} 页`,
      });
      if (!medias.length || medias.length < config.pageSize || page >= Number(data?.info?.page_count || Infinity)) break;
      if (page >= maxPages) break;
      page += 1;
      await sleep(config.requestDelayMs);
    }
    return rows;
  }

  function applyEnrichedVideo(rows, enriched) {
    for (const row of rows) {
      if (row.bvid !== enriched.bvid) continue;
      const sourceFolders = row.source_folders;
      Object.assign(row, enriched);
      row.source_folders = sourceFolders;
    }
  }

  async function enrichVideo(row) {
    if (!row.bvid || row.invalid_or_unavailable || stopped) return row;
    try {
      const view = await apiGet("https://api.bilibili.com/x/web-interface/view", { bvid: row.bvid });
      row.aid = row.aid || text(view.aid);
      row.partition = row.partition || clean(view.tname);
      row.description = row.description || text(view.desc);
      row.uploader = row.uploader || clean(view.owner?.name);
      await sleep(config.requestDelayMs);
      if (config.includeTags) {
        const tags = await apiGet("https://api.bilibili.com/x/tag/archive/tags", { bvid: row.bvid });
        row.tags = Array.isArray(tags) ? tags.map((tag) => clean(tag.tag_name || tag.name)).filter(Boolean) : [];
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      row.fetch_status = "error";
      row.fetch_error = detail;
      if (shouldStopForRisk(detail)) throw error;
    }
    return row;
  }

  function jsonl(rows) {
    return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  }

  function summary(folders, rows) {
    const ok = rows.filter((row) => !row.invalid_or_unavailable).length;
    const unavailable = rows.length - ok;
    return [
      "# Bilibili Favorites Crawl Summary",
      "",
      `- Captured at: ${now()}`,
      `- Page: ${location.href}`,
      `- Folders: ${folders.length}`,
      `- Rows: ${rows.length}`,
      `- Trackable rows: ${ok}`,
      `- Unavailable rows: ${unavailable}`,
      `- Include tags: ${config.includeTags}`,
      "",
      "## Folders",
      ...folders.map((folder) => `- ${folder.folder_name} (${folder.folder_id}): ${folder.count ?? "unknown"}`),
      "",
    ].join("\n");
  }

  async function runCrawler(mode = "full") {
    if (running) return;
    activeMode = mode;
    const isTest = mode === "test";
    const existing = loadCheckpoint(mode);
    config.includeTags = existing ? Boolean(existing.includeTags) : getIncludeTagsFromUi();
    if (existing) {
      if (!confirm(`检测到未完成的${isTest ? "测试" : "完整"}采集进度，将从上次检查点继续。继续？`)) return;
    } else if (!confirm(isTest
      ? `将只读测试采集前 ${testConfig.maxFolders} 个收藏夹、每个 ${testConfig.maxPagesPerFolder} 页、最多 ${testConfig.maxMetadataVideos} 个元数据。${config.includeTags ? "会额外抓标签，速度更慢。" : "默认不额外抓标签。"}继续？`
      : `将只读导出当前账号的 B 站收藏夹数据，不会创建/删除/移动收藏。${config.includeTags ? "会额外抓标签，速度更慢。" : "默认不额外抓标签。"}继续？`)) {
      return;
    }
    running = true;
    stopped = false;
    let errorCount = 0;
    let state = existing;
    try {
      setStatus("运行中");
      if (!state) {
        resetProgress("读取收藏夹");
        log(isTest ? "开始测试采集" : "开始读取收藏夹");
        const allFolders = await fetchFolders();
        const folders = isTest ? allFolders.slice(0, testConfig.maxFolders) : allFolders;
        const estimatedPages = folders.reduce((sum, folder) => {
          const count = Number(folder.count);
          const pages = Number.isFinite(count) && count > 0 ? Math.ceil(count / config.pageSize) : 1;
          return sum + (isTest ? Math.min(pages, testConfig.maxPagesPerFolder) : pages);
        }, 0);
        state = {
          version: 1,
          mode,
          includeTags: config.includeTags,
          phase: "folders",
          startedAt: Date.now(),
          folders,
          estimatedPages,
          completedFolderPages: 0,
          folderIndex: 0,
          metadataIndex: 0,
          rows: [],
        };
        saveCheckpoint(state);
      } else {
        resetProgress(state.phase === "metadata" ? "补充元数据" : "读取收藏夹");
        progress.startedAt = state.startedAt || Date.now();
        log(`继续采集：${state.phase === "metadata" ? "补充元数据" : "读取收藏夹"}，已采集 ${state.rows.length} 条`);
        config.includeTags = Boolean(state.includeTags);
      }

      if (state.phase === "folders") {
        updateProgress({
          phase: "读取收藏夹",
          done: state.completedFolderPages || 0,
          total: state.estimatedPages || 0,
          rows: state.rows.length,
          detail: `${state.folders.length} 个收藏夹`,
        });
        for (let index = state.folderIndex || 0; index < state.folders.length; index += 1) {
          if (stopped) {
            saveCheckpoint(state);
            setStatus("已暂停");
            log("已暂停，可刷新页面后继续");
            return;
          }
          const folder = state.folders[index];
          log(`收藏夹 ${index + 1}/${state.folders.length}: ${folder.folder_name}`);
          const rawFolderEstimatedPages = Number.isFinite(Number(folder.count)) && Number(folder.count) > 0 ? Math.ceil(Number(folder.count) / config.pageSize) : 1;
          const folderEstimatedPages = isTest ? Math.min(rawFolderEstimatedPages, testConfig.maxPagesPerFolder) : rawFolderEstimatedPages;
          try {
            const before = state.rows.length;
            const folderRows = await fetchFolderVideos(folder, state.completedFolderPages || 0, state.estimatedPages || 0, isTest ? testConfig.maxPagesPerFolder : Infinity);
            if (stopped) {
              saveCheckpoint(state);
              setStatus("已暂停");
              log(`已暂停：${folder.folder_name} 未标记完成，下次会从这个收藏夹重新读取`);
              return;
            }
            state.rows.push(...folderRows);
            state.folderIndex = index + 1;
            state.completedFolderPages = (state.completedFolderPages || 0) + folderEstimatedPages;
            saveCheckpoint(state);
            updateProgress({ rows: state.rows.length, detail: `${folder.folder_name} 完成，新增 ${state.rows.length - before} 条` });
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            log(`读取失败 ${folder.folder_name}: ${detail}`);
            saveCheckpoint(state);
            if (shouldStopForRisk(detail) || ++errorCount >= config.maxErrors) throw error;
          }
          updateProgress({ done: Math.min(state.completedFolderPages || 0, state.estimatedPages || 0), total: state.estimatedPages || 0, rows: state.rows.length });
          await sleep(config.folderDelayMs);
        }
        state.phase = "metadata";
        state.metadataIndex = 0;
        saveCheckpoint(state);
      }

      const uniqueByBvid = new Map();
      for (const row of state.rows) {
        if (!row.bvid || uniqueByBvid.has(row.bvid)) continue;
        uniqueByBvid.set(row.bvid, row);
      }
      const metadataRows = isTest ? Array.from(uniqueByBvid.values()).slice(0, testConfig.maxMetadataVideos) : Array.from(uniqueByBvid.values());
      updateProgress({
        phase: "补充元数据",
        done: state.metadataIndex || 0,
        total: metadataRows.length,
        rows: state.rows.length,
        detail: `${metadataRows.length} 个唯一视频`,
      });
      for (const [index, row] of metadataRows.entries()) {
        if (index < (state.metadataIndex || 0)) continue;
        if (stopped) {
          saveCheckpoint(state);
          setStatus("已暂停");
          log("已暂停，可刷新页面后继续");
          return;
        }
        log(`补充元数据 ${index + 1}/${uniqueByBvid.size}: ${row.bvid}`);
        const enriched = await enrichVideo({ ...row });
        applyEnrichedVideo(state.rows, enriched);
        state.metadataIndex = index + 1;
        saveCheckpoint(state);
        updateProgress({
          done: index + 1,
          total: metadataRows.length,
          rows: state.rows.length,
          detail: row.bvid,
        });
        await sleep(config.requestDelayMs);
      }

      const evidenceRows = state.rows;
      const prefix = isTest ? "bilibili-favorites-test" : "bilibili-favorites";
      download(`${prefix}-evidence.jsonl`, jsonl(evidenceRows), "application/jsonl;charset=utf-8");
      clearCheckpoint(mode);
      log(`完成：folders=${state.folders.length}, rows=${evidenceRows.length}`);
      setStatus("完成");
      updateProgress({
        phase: "完成",
        done: evidenceRows.length,
        total: evidenceRows.length,
        rows: evidenceRows.length,
        detail: "文件已下载",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log(`已停止: ${detail}`);
      setStatus("已停止");
      alert(`导出已停止：${detail}`);
    } finally {
      running = false;
    }
  }

  function stopCrawler() {
    stopped = true;
    setStatus("暂停中");
    log("已请求暂停，当前请求结束后保存进度");
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed",
      `right:${PANEL_RIGHT_PX}px`,
      `bottom:${PANEL_BOTTOM_PX}px`,
      "z-index:2147483647",
      "width:320px",
      "background:#101820",
      "color:#e8f0f7",
      "border:1px solid #2c3d4d",
      "border-radius:8px",
      "box-shadow:0 12px 30px rgba(0,0,0,.35)",
      "font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "padding:10px",
    ].join(";");
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:8px">
        <span style="flex:1">Bilibili 收藏夹采集器</span>
        <span data-role="status" style="color:#7dd3fc">就绪</span>
        <button data-role="toggle" title="折叠/展开" style="padding:1px 6px">折叠</button>
      </div>
      <div data-role="body">
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button data-role="start" style="flex:1">导出收藏夹 JSONL</button>
          <button data-role="test">测试采集</button>
          <button data-role="stop">暂停</button>
          <button data-role="clear" title="清除未完成进度并从头开始">取消重来</button>
        </div>
        <div data-role="resume" style="color:#9fb0c0;margin-bottom:6px">暂无未完成采集</div>
        <label style="display:flex;align-items:center;gap:5px;color:#9fb0c0;margin-bottom:6px">
          <input data-role="include-tags" type="checkbox" style="width:auto;min-height:auto">
          <span>抓标签（更慢，审核更准）</span>
        </label>
        <div style="height:8px;background:#22313f;border-radius:999px;overflow:hidden;margin-bottom:6px">
          <div data-role="progress-fill" style="width:0%;height:100%;background:#38bdf8;transition:width .2s"></div>
        </div>
        <div data-role="progress-text" style="color:#e8f0f7;margin-bottom:2px">就绪</div>
        <div data-role="progress-meta" style="color:#9fb0c0;margin-bottom:8px">已用时：0秒 · 预计剩余：估算中 · 已采集 0 条</div>
        <div style="color:#9fb0c0;margin-bottom:6px">只读导出；默认不抓标签详情；不会保存 Cookie/csrf。</div>
        <pre data-role="log" style="max-height:180px;overflow:auto;white-space:pre-wrap;background:#0b1117;border:1px solid #243442;border-radius:6px;padding:6px;margin:0"></pre>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-role="start"]').addEventListener("click", () => runCrawler("full"));
    panel.querySelector('[data-role="test"]').addEventListener("click", () => runCrawler("test"));
    panel.querySelector('[data-role="stop"]').addEventListener("click", stopCrawler);
    panel.querySelector('[data-role="clear"]').addEventListener("click", () => {
      if (running) return;
      if (!confirm("确定清除未完成采集进度？下次会从 0 开始。")) return;
      clearCheckpoint("full");
      clearCheckpoint("test");
      resetProgress();
      log("已清除未完成采集进度");
    });
    panel.querySelector('[data-role="toggle"]').addEventListener("click", () => {
      const body = panel.querySelector('[data-role="body"]');
      const toggle = panel.querySelector('[data-role="toggle"]');
      const collapsed = body.style.display === "none";
      body.style.display = collapsed ? "" : "none";
      toggle.textContent = collapsed ? "折叠" : "展开";
      panel.style.width = collapsed ? "320px" : "260px";
    });
    resetProgress();
    renderCheckpointState();
  }

  mountPanel();
})();
