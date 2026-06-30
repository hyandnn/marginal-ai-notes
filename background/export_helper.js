function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function makeMarkdownDataUrl(content) {
  const bytes = new TextEncoder().encode(content || "");
  const b64 = uint8ToBase64(bytes);
  return `data:text/markdown;charset=utf-8;base64,${b64}`;
}

function normalizeExportDir(exportDir) {
  const raw = (exportDir || "Notes").trim();
  if (raw.includes("..")) {
    throw new Error(
      "保存路径不能包含 ..。若要写入 ~/Note/00_Inbox，请用符号链接：ln -s ~/Note/00_Inbox ~/Downloads/Note/00_Inbox，然后填写 Note/00_Inbox。"
    );
  }
  if (/^[\\/]|^[A-Za-z]:/.test(raw)) {
    throw new Error("保存路径必须是相对 Chrome 下载目录的子路径。");
  }
  return raw.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/") || "Notes";
}

function downloadMarkdownContent(content, filename, exportDir) {
  const hasBlobUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const url = hasBlobUrl
    ? URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }))
    : makeMarkdownDataUrl(content);
  const dir = normalizeExportDir(exportDir);
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
