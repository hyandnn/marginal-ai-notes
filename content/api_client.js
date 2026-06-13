(function () {
  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("扩展上下文已失效，请刷新 ChatGPT 页面。"));
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

  async function askModel(payload) {
    const settings = window.CGIAStorage.getSettingsSync();

    if (settings.mode === "mock") {
      return sendRuntimeMessage({ type: "ASK", payload, settings });
    }

    if (!settings.apiKey?.trim()) {
      throw new Error("请先在扩展设置中填写 API Key，或将模式切换为 Mock。");
    }

    return sendRuntimeMessage({ type: "ASK", payload, settings });
  }

  window.CGIAApiClient = { askModel };
})();
