importScripts("prompt_builder.js", "llm_client.js");

const SETTINGS_KEY = "cgia_standalone_settings";

const DEFAULT_SETTINGS = {
  mode: "mock",
  apiKey: "",
  apiModel: "deepseek-chat",
  apiBaseUrl: "https://api.deepseek.com",
  requestTimeoutMs: 30000
};

async function loadSettings(override) {
  if (override) {
    return { ...DEFAULT_SETTINGS, ...override };
  }
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

function mockAnswer(req) {
  const historySummary = req.conversationHistory?.length
    ? `（本次携带 ${req.conversationHistory.length} 条历史）`
    : "";

  return (
    `这是 mock 回答。${historySummary}\n\n` +
    `你选中的内容是：${req.selectedText.slice(0, 120)}\n\n` +
    `你的问题是：${req.userQuestion}\n\n` +
    "请在扩展设置中切换到 API 模式并填写 API Key 后即可调用真实模型。"
  );
}

async function handleAsk(payload, settingsOverride) {
  if (!payload.userQuestion?.trim()) {
    throw new Error("问题不能为空。");
  }
  if (!payload.selectedText?.trim()) {
    throw new Error("选中文本不能为空。");
  }

  const settings = await loadSettings(settingsOverride);

  if (settings.mode === "mock") {
    return {
      noteId: payload.noteId,
      answer: mockAnswer(payload),
      status: "completed"
    };
  }

  const prompt = buildPrompt(payload);
  const answer = await askModel(prompt, settings);

  return {
    noteId: payload.noteId,
    answer,
    status: "completed"
  };
}

async function handleTestConnection(settingsOverride) {
  const settings = await loadSettings(settingsOverride);

  if (settings.mode === "mock") {
    return { ok: true, message: "当前为 Mock 模式，无需测试 API。" };
  }

  const answer = await askModel("请只回复：连接成功", settings);
  const preview = (answer || "").slice(0, 80);

  return {
    ok: true,
    message: `连接成功。模型回复：${preview}`
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ASK") {
    handleAsk(message.payload, message.settings)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }

  if (message.type === "TEST_CONNECTION") {
    handleTestConnection(message.settings)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }

  return false;
});
