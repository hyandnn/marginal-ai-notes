importScripts(
  "prompt_builder.js",
  "llm_client.js",
  "stream_mock.js",
  "export_helper.js"
);

const SETTINGS_KEY = "cgia_standalone_settings";

const DEFAULT_SETTINGS = {
  mode: "mock",
  apiKey: "",
  apiModel: "deepseek-chat",
  apiBaseUrl: "https://api.deepseek.com",
  requestTimeoutMs: 30000,
  jsonlRecordDir: "Record"
};

async function loadSettings(override) {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const base = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
  if (override && Object.keys(override).length > 0) {
    return { ...base, ...override };
  }
  return base;
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

async function streamAsk(payload, settingsOverride, emit) {
  if (!payload.userQuestion?.trim()) {
    throw new Error("问题不能为空。");
  }
  if (!payload.selectedText?.trim()) {
    throw new Error("选中文本不能为空。");
  }

  const settings = await loadSettings(settingsOverride);

  if (settings.mode === "mock") {
    const answer = mockAnswer(payload);
    await simulateStream(answer, (delta, full) => emit({ type: "chunk", delta, full }));
    return answer;
  }

  const prompt = buildPrompt(payload);
  return askModelStream(prompt, settings, (delta, full) =>
    emit({ type: "chunk", delta, full })
  );
}

async function handleAsk(payload, settingsOverride) {
  let answer = "";
  await streamAsk(payload, settingsOverride, (msg) => {
    if (msg.type === "chunk") answer = msg.full;
  });
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

async function handleDownloadJsonl(records, filenamePrefix, topic, site, settingsOverride) {
  if (!records?.length) {
    throw new Error("没有可导出的记录。");
  }
  const settings = await loadSettings(settingsOverride);
  const filename = makeExportFilename(
    filenamePrefix || "notes",
    topic,
    site || records[0]?.source || "notes"
  );
  const content = recordsToJsonlContent(records);
  await downloadJsonlContent(content, filename, settings.jsonlRecordDir);
  return { filename, count: records.length };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ask-stream") return;

  port.onMessage.addListener((message) => {
    if (message.type !== "ASK_STREAM") return;

    (async () => {
      try {
        const answer = await streamAsk(message.payload, message.settings, (msg) => {
          try {
            port.postMessage(msg);
          } catch (e) {
            // 端口可能已断开
          }
        });
        port.postMessage({
          type: "done",
          noteId: message.payload.noteId,
          answer,
          status: "completed"
        });
      } catch (err) {
        port.postMessage({ type: "error", error: err.message || String(err) });
      }
    })();
  });
});

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

  if (message.type === "DOWNLOAD_JSONL") {
    handleDownloadJsonl(
      message.records,
      message.filenamePrefix,
      message.topic,
      message.site,
      message.settings
    )
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }

  return false;
});
