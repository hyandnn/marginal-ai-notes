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

function buildRequestBody(model, prompt, stream) {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
    stream: !!stream
  };
}

async function askModel(prompt, settings) {
  let full = "";
  await askModelStream(prompt, settings, (_delta, accumulated) => {
    full = accumulated;
  });
  return full;
}

async function askModelStream(prompt, settings, onChunk) {
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
      body: JSON.stringify(buildRequestBody(model, prompt, true)),
      signal: controller.signal
    });

    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`模型 API 返回 ${res.status}：${extractErrorMessage(bodyText)}`);
    }

    if (!res.body) {
      throw new Error("模型 API 未返回可流式读取的响应。");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta, full);
          }
        } catch (e) {
          // 跳过无法解析的行
        }
      }
    }

    if (!full) {
      throw new Error("模型 API 未返回有效回答。");
    }

    return full;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("请求超时，请检查网络或稍后重试。");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
