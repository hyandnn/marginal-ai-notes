const SETTINGS_KEY = "cgia_standalone_settings";

const PROVIDER_PRESETS = {
  deepseek: {
    apiModel: "deepseek-chat",
    apiBaseUrl: "https://api.deepseek.com"
  },
  openai: {
    apiModel: "gpt-4.1-mini",
    apiBaseUrl: "https://api.openai.com"
  }
};

const DEFAULT_SETTINGS = {
  mode: "mock",
  apiKey: "",
  apiModel: "deepseek-chat",
  apiBaseUrl: "https://api.deepseek.com",
  language: "zh-CN",
  maxSelectedTextLength: 3000,
  surroundingTextMaxLength: 1200,
  requestTimeoutMs: 30000,
  autoRestoreNotes: true,
  includeFullMessage: true,
  includeMainConversation: true,
  fullMessageMaxLength: 4000,
  mainConversationMaxMessages: 6
};

function detectProviderPreset(settings) {
  const base = (settings.apiBaseUrl || "").replace(/\/+$/, "");
  if (base.includes("deepseek.com")) return "deepseek";
  if (base.includes("openai.com")) return "openai";
  return "custom";
}

function loadForm(settings) {
  document.getElementById("mode").value = settings.mode;
  document.getElementById("providerPreset").value = detectProviderPreset(settings);
  document.getElementById("apiKey").value = settings.apiKey || "";
  document.getElementById("apiModel").value = settings.apiModel;
  document.getElementById("apiBaseUrl").value = settings.apiBaseUrl;
  document.getElementById("requestTimeoutMs").value = settings.requestTimeoutMs;
  document.getElementById("maxSelectedTextLength").value = settings.maxSelectedTextLength;
  document.getElementById("surroundingTextMaxLength").value = settings.surroundingTextMaxLength;
  document.getElementById("autoRestoreNotes").checked = settings.autoRestoreNotes;
  document.getElementById("includeFullMessage").checked = settings.includeFullMessage;
  document.getElementById("includeMainConversation").checked = settings.includeMainConversation;
}

function readForm() {
  const timeoutVal = parseInt(document.getElementById("requestTimeoutMs").value, 10);
  const maxSelVal = parseInt(document.getElementById("maxSelectedTextLength").value, 10);
  const maxSurrVal = parseInt(document.getElementById("surroundingTextMaxLength").value, 10);

  if (Number.isNaN(timeoutVal) || timeoutVal < 5000) {
    throw new Error("请求超时必须 >= 5000 毫秒");
  }

  return {
    mode: document.getElementById("mode").value,
    apiKey: document.getElementById("apiKey").value.trim(),
    apiModel: document.getElementById("apiModel").value.trim(),
    apiBaseUrl: document.getElementById("apiBaseUrl").value.trim(),
    language: "zh-CN",
    maxSelectedTextLength: maxSelVal,
    surroundingTextMaxLength: maxSurrVal,
    requestTimeoutMs: timeoutVal,
    autoRestoreNotes: document.getElementById("autoRestoreNotes").checked,
    includeFullMessage: document.getElementById("includeFullMessage").checked,
    includeMainConversation: document.getElementById("includeMainConversation").checked,
    fullMessageMaxLength: 4000,
    mainConversationMaxMessages: 6
  };
}

function setMessage(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? "#c0392b" : "#2e7d32";
}

document.getElementById("providerPreset").addEventListener("change", (e) => {
  const preset = PROVIDER_PRESETS[e.target.value];
  if (!preset) return;
  document.getElementById("apiModel").value = preset.apiModel;
  document.getElementById("apiBaseUrl").value = preset.apiBaseUrl;
});

chrome.storage.local.get(SETTINGS_KEY, (result) => {
  const settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  loadForm(settings);
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const msg = document.getElementById("saveMsg");
  try {
    const settings = readForm();
    if (settings.mode === "api" && !settings.apiKey) {
      throw new Error("API 模式下请填写 API Key。");
    }
    if (settings.mode === "api" && !settings.apiModel) {
      throw new Error("请填写模型名称。");
    }
    if (settings.mode === "api" && !settings.apiBaseUrl) {
      throw new Error("请填写 API 地址。");
    }

    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
      setMessage(msg, "设置已保存。");
      setTimeout(() => {
        msg.textContent = "";
      }, 2000);
    });
  } catch (e) {
    setMessage(msg, e.message, true);
  }
});

document.getElementById("testBtn").addEventListener("click", () => {
  const testMsg = document.getElementById("testMsg");
  const testBtn = document.getElementById("testBtn");

  try {
    const settings = readForm();
    if (settings.mode === "mock") {
      setMessage(testMsg, "Mock 模式无需测试。", false);
      return;
    }
    if (!settings.apiKey) {
      throw new Error("请先填写 API Key。");
    }

    testBtn.disabled = true;
    setMessage(testMsg, "测试中…", false);

    chrome.runtime.sendMessage({ type: "TEST_CONNECTION", settings }, (response) => {
      testBtn.disabled = false;

      if (chrome.runtime.lastError) {
        setMessage(testMsg, chrome.runtime.lastError.message, true);
        return;
      }
      if (response?.error) {
        setMessage(testMsg, response.error, true);
        return;
      }
      setMessage(testMsg, response?.message || "连接成功。", false);
    });
  } catch (e) {
    testBtn.disabled = false;
    setMessage(testMsg, e.message, true);
  }
});
