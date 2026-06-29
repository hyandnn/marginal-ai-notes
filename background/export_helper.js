function makeExportFilename(prefix, topic, site) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const safeSite = (site || "notes")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 16);
  const safe = (topic || "notes")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 30);
  return `${safeSite}-${y}${m}${day}-${safe}.jsonl`;
}

function recordsToJsonlContent(records) {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function makeJsonlDataUrl(content) {
  const bytes = new TextEncoder().encode(content || "");
  const b64 = uint8ToBase64(bytes);
  // octet-stream 避免 Chrome 把后缀改成 .ndjson 或 .txt
  return `data:application/octet-stream;base64,${b64}`;
}

function downloadJsonlContent(content, filename, recordDir) {
  const hasBlobUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const url = hasBlobUrl
    ? URL.createObjectURL(
        new Blob([content], { type: "application/octet-stream" })
      )
    : makeJsonlDataUrl(content);
  const dir = (recordDir || "Record").replace(/^\/+|\/+$/g, "");
  const path = dir ? `${dir}/${filename}` : filename;

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename: path,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        if (hasBlobUrl) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            // ignore
          }
        }
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}
