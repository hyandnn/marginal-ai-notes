const SETTINGS_KEY = "cgia_standalone_settings";
const NOTES_KEY = "cgia_standalone_notes";

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
  mainConversationMaxMessages: 6,
  defaultNoteType: "general",
  jsonlRecordDir: "Record"
};

function detectProviderPreset(settings) {
  const base = (settings.apiBaseUrl || "").replace(/\/+$/, "");
  if (base.includes("deepseek.com")) return "deepseek";
  if (base.includes("openai.com")) return "openai";
  return "custom";
}

function populateDefaultNoteTypeSelect(selected) {
  const sel = document.getElementById("defaultNoteType");
  sel.innerHTML = "";
  window.CGIANoteSchema.NOTE_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
  sel.value = selected || "general";
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
  populateDefaultNoteTypeSelect(settings.defaultNoteType);
  document.getElementById("jsonlRecordDir").value = settings.jsonlRecordDir || "Record";
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
    mainConversationMaxMessages: 6,
    defaultNoteType: document.getElementById("defaultNoteType").value,
    jsonlRecordDir: document.getElementById("jsonlRecordDir").value.trim() || "Record"
  };
}

function setMessage(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? "#c0392b" : "#2e7d32";
}

function loadAllNotesFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(NOTES_KEY, (result) => {
      const all = Object.values(result[NOTES_KEY] || {});
      resolve(
        all.map((n) => window.CGIANoteSchema.normalizeNote(n, DEFAULT_SETTINGS))
      );
    });
  });
}

async function refreshNoteCount() {
  const notes = await loadAllNotesFromStorage();
  const visible = notes.filter((n) => n.status !== "hidden");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || "";
    const pageCount = visible.filter((n) => n.pageUrl === url).length;
    document.getElementById("noteCount").textContent =
      `便签：共 ${visible.length} 条（当前页 ${pageCount} 条）`;
  });
}

function exportNotesList(notes, prefix) {
  const visible = notes.filter((n) => n.status !== "hidden");
  if (visible.length === 0) {
    throw new Error("没有可导出的便签。");
  }
  const records = visible.map((n) => window.CGIANoteSchema.noteToJsonlRecord(n));
  const topic = records.length === 1 ? records[0].main_topic : "notes";
  return window.CGIAExport.downloadJsonl(records, prefix, topic).then(() => visible.length);
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
  refreshNoteCount();
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

document.getElementById("exportAllBtn").addEventListener("click", async () => {
  const msg = document.getElementById("exportMsg");
  try {
    const notes = await loadAllNotesFromStorage();
    const count = await exportNotesList(notes, "notes");
    setMessage(msg, `已保存 ${count} 条到 Record 目录。`);
  } catch (e) {
    setMessage(msg, e.message, true);
  }
});

document.getElementById("exportPageBtn").addEventListener("click", async () => {
  const msg = document.getElementById("exportMsg");
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) throw new Error("无法获取当前页面 URL。");

    const notes = await loadAllNotesFromStorage();
    const pageNotes = notes.filter((n) => n.pageUrl === url);
    const count = await exportNotesList(pageNotes, "page");
    setMessage(msg, `已保存当前页 ${count} 条到 Record 目录。`);
  } catch (e) {
    setMessage(msg, e.message, true);
  }
});
