(function () {
  const SETTINGS_KEY = "cgia_standalone_settings";
  const NOTES_KEY = "cgia_standalone_notes";

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

  let cachedSettings = { ...DEFAULT_SETTINGS };

  function isContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function safeGet(key) {
    return new Promise((resolve) => {
      if (!isContextValid()) return resolve(null);
      try {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(result);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function safeSet(obj) {
    return new Promise((resolve) => {
      if (!isContextValid()) return resolve(false);
      try {
        chrome.storage.local.set(obj, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[SETTINGS_KEY]) {
        cachedSettings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
        console.log("[CGIA-SA] settings updated:", cachedSettings.mode);
      }
    });
  } catch (e) {
    // ignore
  }

  async function loadSettings() {
    const result = await safeGet(SETTINGS_KEY);
    if (result) {
      cachedSettings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
    }
    return { ...cachedSettings };
  }

  async function saveSettings(settings) {
    cachedSettings = { ...DEFAULT_SETTINGS, ...settings };
    await safeSet({ [SETTINGS_KEY]: cachedSettings });
  }

  function getSettingsSync() {
    return { ...cachedSettings };
  }

  async function loadNotesForPage(pageUrl) {
    const result = await safeGet(NOTES_KEY);
    if (!result) return [];
    const all = result[NOTES_KEY] || {};
    return Object.values(all).filter((n) => n.pageUrl === pageUrl);
  }

  async function saveNote(note) {
    const result = await safeGet(NOTES_KEY);
    const all = (result && result[NOTES_KEY]) || {};
    all[note.noteId] = note;
    await safeSet({ [NOTES_KEY]: all });
  }

  async function deleteNote(noteId) {
    const result = await safeGet(NOTES_KEY);
    const all = (result && result[NOTES_KEY]) || {};
    delete all[noteId];
    await safeSet({ [NOTES_KEY]: all });
  }

  window.CGIAStorage = {
    loadSettings,
    saveSettings,
    getSettingsSync,
    loadNotesForPage,
    saveNote,
    deleteNote
  };
})();
