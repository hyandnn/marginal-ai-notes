(function () {
  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("扩展上下文已失效，请刷新页面。"));
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("扩展未返回响应，请确认插件已启用。"));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function askModelStream(payload, onChunk) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("扩展上下文已失效，请刷新页面。"));
        return;
      }

      const settings = window.CGIAStorage.getSettingsSync();

      if (settings.mode === "api" && !settings.apiKey?.trim()) {
        reject(new Error("请先在扩展设置中填写 API Key，或将模式切换为 Mock。"));
        return;
      }

      let port;
      try {
        port = chrome.runtime.connect({ name: "ask-stream" });
      } catch (err) {
        reject(err);
        return;
      }

      let answer = "";

      port.onMessage.addListener((msg) => {
        if (msg.type === "chunk") {
          if (typeof onChunk === "function") {
            onChunk(msg.delta, msg.full);
          }
          answer = msg.full;
        } else if (msg.type === "done") {
          resolve({
            noteId: msg.noteId || payload.noteId,
            answer: msg.answer || answer,
            status: msg.status || "completed"
          });
          port.disconnect();
        } else if (msg.type === "error") {
          reject(new Error(msg.error || "请求失败"));
          port.disconnect();
        }
      });

      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
      });

      port.postMessage({ type: "ASK_STREAM", payload, settings });
    });
  }

  async function askModel(payload) {
    return askModelStream(payload);
  }

  window.CGIAApiClient = { askModel, askModelStream };
})();
