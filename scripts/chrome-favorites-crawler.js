(() => {
  const config = {
    pageSize: 20,
    includeTags: false,
    requestDelayMs: 900,
    folderDelayMs: 1500,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();
  const text = (value) => (value == null ? "" : String(value));
  const clean = (value) => text(value).replace(/[\r\n\t]+/g, " ").trim();

  function currentMid() {
    const match = location.href.match(/space\.bilibili\.com\/(\d+)/);
    return match ? match[1] : "";
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
    document.body.appendChild(link);
    link.click();
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
    if (!upMid) throw new Error("Cannot detect space mid from current URL");
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

  async function fetchFolderVideos(folder) {
    const rows = [];
    let page = 1;
    while (true) {
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
      console.log(`[bili-crawler] ${folder.folder_name}: page ${page}, items ${medias.length}`);
      if (!medias.length || medias.length < config.pageSize || page >= Number(data?.info?.page_count || Infinity)) break;
      page += 1;
      await sleep(config.requestDelayMs);
    }
    return rows;
  }

  async function enrichVideo(row) {
    if (!row.bvid || row.invalid_or_unavailable) return row;
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
      row.fetch_status = "error";
      row.fetch_error = error instanceof Error ? error.message : String(error);
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
      "",
      "## Folders",
      ...folders.map((folder) => `- ${folder.folder_name} (${folder.folder_id}): ${folder.count ?? "unknown"}`),
      "",
    ].join("\n");
  }

  async function run() {
    console.log("[bili-crawler] start");
    const folders = await fetchFolders();
    const rows = [];
    for (let index = 0; index < folders.length; index += 1) {
      const folder = folders[index];
      console.log(`[bili-crawler] folder ${index + 1}/${folders.length}: ${folder.folder_name}`);
      rows.push(...await fetchFolderVideos(folder));
      await sleep(config.folderDelayMs);
    }
    const uniqueByBvid = new Map();
    for (const row of rows) {
      if (!row.bvid || uniqueByBvid.has(row.bvid)) continue;
      uniqueByBvid.set(row.bvid, row);
    }
    for (const [index, row] of Array.from(uniqueByBvid.values()).entries()) {
      console.log(`[bili-crawler] enrich ${index + 1}/${uniqueByBvid.size}: ${row.bvid}`);
      await enrichVideo(row);
      await sleep(config.requestDelayMs);
    }
    const evidenceRows = rows.map((row) => row.bvid && uniqueByBvid.has(row.bvid) ? { ...row, ...uniqueByBvid.get(row.bvid), source_folders: row.source_folders } : row);
    download("bilibili-favorites-inventory.jsonl", jsonl(rows), "application/jsonl;charset=utf-8");
    download("bilibili-favorites-evidence.jsonl", jsonl(evidenceRows), "application/jsonl;charset=utf-8");
    download("bilibili-favorites-crawl-summary.md", summary(folders, evidenceRows), "text/markdown;charset=utf-8");
    console.log("[bili-crawler] done", { folders: folders.length, rows: evidenceRows.length });
  }

  run().catch((error) => {
    console.error("[bili-crawler] failed", error);
    alert(`Bilibili favorites crawl failed: ${error instanceof Error ? error.message : String(error)}`);
  });
})();
