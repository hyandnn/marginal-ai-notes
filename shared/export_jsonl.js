(function () {
  function downloadJsonlViaBackground(records, filenamePrefix, topic, settings, site) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("扩展上下文已失效。"));
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "DOWNLOAD_JSONL",
          records,
          filenamePrefix: filenamePrefix || "notes",
          topic: topic || "notes",
          site: site || "notes",
          settings: settings || null
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  function downloadJsonl(records, filenamePrefix, topic, settings, site) {
    if (!records || records.length === 0) {
      return Promise.reject(new Error("没有可导出的记录。"));
    }

    const resolvedSite =
      site || window.CGIANoteSchema?.exportFilenameSite(records) || "notes";
    const resolvedTopic =
      topic || window.CGIANoteSchema?.exportFilenameTopic(records) || "notes";

    let resolvedSettings = settings;
    if (resolvedSettings == null && typeof window !== "undefined" && window.CGIAStorage) {
      resolvedSettings = window.CGIAStorage.getSettingsSync();
    }

    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return downloadJsonlViaBackground(
        records,
        filenamePrefix,
        resolvedTopic,
        resolvedSettings,
        resolvedSite
      );
    }

    return Promise.reject(new Error("当前环境无法保存文件，请在扩展 Popup 中导出。"));
  }

  window.CGIAExport = {
    downloadJsonl
  };
})();
