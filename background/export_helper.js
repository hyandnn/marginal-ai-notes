function makeExportFilename(prefix, topic) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const safe = (topic || "notes")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 30);
  return `${prefix}-${y}${m}${day}-${safe}.jsonl`;
}

function recordsToJsonlContent(records) {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

function downloadJsonlContent(content, filename, recordDir) {
  const blob = new Blob([content], { type: "application/x-ndjson;charset=utf-8" });
  const url = URL.createObjectURL(blob);
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
        URL.revokeObjectURL(url);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}
