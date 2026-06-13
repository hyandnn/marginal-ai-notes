function getChatCompletionsUrl(baseUrl) {
  const base = (baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function extractErrorMessage(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    if (data.error && data.error.message) return data.error.message;
    if (data.detail) return String(data.detail);
  } catch (e) {
    // ignore
  }
  return bodyText.slice(0, 200) || "未知错误";
}

async function askModel(prompt, settings) {
  const apiKey = (settings.apiKey || "").trim();
  if (!apiKey) {
    throw new Error("请先在扩展设置中填写 API Key。");
  }

  const model = (settings.apiModel || "deepseek-chat").trim();
  const url = getChatCompletionsUrl(settings.apiBaseUrl);
  const timeoutMs = settings.requestTimeoutMs ?? 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024
      }),
      signal: controller.signal
    });

    const bodyText = await res.text();

    if (!res.ok) {
      throw new Error(`模型 API 返回 ${res.status}：${extractErrorMessage(bodyText)}`);
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      throw new Error("模型 API 返回了无法解析的 JSON。");
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型 API 未返回有效回答。");
    }

    return content;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("请求超时，请检查网络或稍后重试。");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
