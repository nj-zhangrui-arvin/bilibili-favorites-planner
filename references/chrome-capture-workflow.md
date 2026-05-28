# Chrome Capture Workflow

Use this when capturing the user's own Bilibili favorites from an already logged-in Chrome session.

## Recommended: Tampermonkey Panel

1. Install `scripts/bilibili_favorites_crawler.user.js` in Tampermonkey.
2. Open `https://space.bilibili.com/<mid>/favlist` in Chrome.
3. Click `导出收藏夹 JSONL` in the bottom-right crawler panel.
4. Wait for `bilibili-favorites-evidence.jsonl` to download.
5. Move or copy the downloaded file into the project artifact folder.
6. Run `validate-crawler-output.mjs`.

## Debug Fallback: DevTools Console

1. Open DevTools Console.
2. Paste the contents of `scripts/chrome-favorites-crawler.js`.
3. Wait for the same evidence JSONL download.

Troubleshooting:

- If no folders are found, refresh the Bilibili favorites page and run again.
- If API returns login errors, confirm Chrome is logged in and the page belongs to the current user.
- If rate limits or 412/403 appear, stop and retry later; do not loop aggressively.
- Tags are disabled by default to reduce request volume. Set `includeTags: true` only when tags are essential.

The script runs in the page context and uses `fetch(..., { credentials: "include" })`. It must not print or export cookies.
