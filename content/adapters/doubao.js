(function () {
  const { truncateAroundSelection, truncateSimple, sortByDocumentOrder, selectionAnchorElement } =
    window.CGIAAdapterShared;

  const UI_NOISE_SNIPPETS = [
    "内容由豆包 AI 生成，请仔细甄别",
    "请仔细甄别",
    "下载电脑版",
    "复制",
    "分享"
  ];

  const MESSAGE_LIST_SELECTORS = [
    '[data-table-spillover="true"][data-table-spillover-force-disable="true"]',
    '[data-testid="message-list"]',
    '[class*="message-list"]',
    '[class*="chat-scroll"]',
    ".scroll-view-OEiNXD",
    "main"
  ];

  const ASSISTANT_BUBBLE_SELECTORS = [
    '[class*="bg-g-receive-msg-bubble"]',
    '[class*="receive-msg-bubble"]',
    '[class*="assistant-message"]',
    '[data-message-author="assistant"]'
  ];

  const USER_BUBBLE_SELECTORS = [
    '[class*="bg-g-send-msg-bubble"]',
    '[class*="send-msg-bubble"]',
    '[class*="user-message"]',
    '[data-message-author="user"]'
  ];

  function match(hostname) {
    return hostname === "www.doubao.com" || hostname === "doubao.com";
  }

  function getMessageListRoot() {
    for (const selector of MESSAGE_LIST_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el !== document.body) return el;
    }
    return document.body;
  }

  function isUiNoise(el) {
    const text = (el.innerText || "").trim();
    if (!text) return true;
    if (text.length < 24 && UI_NOISE_SNIPPETS.some((s) => text.includes(s))) return true;
    return UI_NOISE_SNIPPETS.some(
      (snippet) => text === snippet || (text.length < 40 && text.includes(snippet))
    );
  }

  function getRole(messageEl) {
    if (messageEl.classList.contains("justify-end")) return "user";
    if (messageEl.matches('[class*="bg-g-send-msg-bubble"], [class*="send-msg-bubble"]')) {
      return "user";
    }
    if (messageEl.matches('[class*="bg-g-receive-msg-bubble"], [class*="receive-msg-bubble"]')) {
      return "assistant";
    }
    const author = messageEl.getAttribute("data-message-author");
    if (author === "user" || author === "assistant") return author;
    if (messageEl.hasAttribute("data-message-id")) {
      return messageEl.classList.contains("justify-end") ? "user" : "assistant";
    }
    if (messageEl.querySelector(".flow-markdown-body")) return "assistant";
    return "assistant";
  }

  function extractMessageText(messageEl) {
    const markdown = messageEl.querySelector(".flow-markdown-body, [class*='markdown-body']");
    if (markdown) return markdown.innerText || "";
    const userText = messageEl.querySelector(
      ".whitespace-pre-wrap.wrap-anywhere:not(.gh-user-query-markdown), [class*='user-query']"
    );
    if (userText) return userText.innerText || "";
    return messageEl.innerText || "";
  }

  function collectBubbleNodes(root) {
    const nodes = [];
    for (const sel of [...ASSISTANT_BUBBLE_SELECTORS, ...USER_BUBBLE_SELECTORS]) {
      nodes.push(...root.querySelectorAll(sel));
    }
    return sortByDocumentOrder(nodes);
  }

  function getAllMessages() {
    const root = getMessageListRoot();
    let nodes = Array.from(root.querySelectorAll("[data-message-id]"));

    if (nodes.length === 0) {
      nodes = collectBubbleNodes(root);
    }

    if (nodes.length === 0) {
      nodes = Array.from(root.querySelectorAll(".flow-markdown-body"))
        .map((md) => md.closest("[data-message-id]") || md.closest("div[class*='msg']") || md.parentElement)
        .filter(Boolean);
    }

    const seen = new Set();
    const unique = [];

    for (const el of nodes) {
      const key = el.getAttribute("data-message-id") || el;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isUiNoise(el)) continue;
      unique.push(el);
    }

    return sortByDocumentOrder(unique);
  }

  function getMessageElement(selection) {
    try {
      const el = selectionAnchorElement(selection);
      if (!el) return null;

      const fromMarkdown = el.closest(".flow-markdown-body, [class*='markdown-body']");
      if (fromMarkdown) {
        return (
          fromMarkdown.closest("[data-message-id]") ||
          fromMarkdown.closest('[class*="receive-msg-bubble"]') ||
          fromMarkdown.closest('[class*="send-msg-bubble"]') ||
          fromMarkdown.parentElement
        );
      }

      return (
        el.closest("[data-message-id]") ||
        el.closest('[class*="bg-g-receive-msg-bubble"]') ||
        el.closest('[class*="receive-msg-bubble"]') ||
        el.closest('[class*="bg-g-send-msg-bubble"]') ||
        el.closest('[class*="send-msg-bubble"]')
      );
    } catch (e) {
      return null;
    }
  }

  function getMessageText(messageEl, selectedText, maxLength) {
    return truncateAroundSelection(
      extractMessageText(messageEl),
      selectedText,
      maxLength
    );
  }

  function getMainConversation(messageEl, maxMessages, perMessageMax) {
    try {
      const all = getAllMessages();
      if (all.length === 0) return [];

      let endIdx = messageEl ? all.indexOf(messageEl) : all.length;
      if (endIdx === -1) endIdx = all.length;

      return all
        .slice(Math.max(0, endIdx - maxMessages), endIdx)
        .map((el) => ({
          role: getRole(el),
          content: truncateSimple(extractMessageText(el), perMessageMax)
        }))
        .filter((m) => m.content);
    } catch (e) {
      return [];
    }
  }

  function shouldIgnoreElement(el) {
    if (el.closest("#flow_chat_sidebar")) return true;
    if (el.closest('[data-testid="chat_input"]')) return true;
    if (el.closest('[class*="chat-input"]')) return true;
    if (el.closest('[class*="input"]')?.closest("footer")) return true;
    if (el.closest("textarea")) return true;
    return false;
  }

  function getConversationTitle() {
    const titleSelectors = [
      '#flow_chat_sidebar a[id^="conversation_"][aria-current="page"]',
      "#flow_chat_sidebar a.active",
      '[class*="conversation-title"]',
      '[class*="chat-title"]',
      "header h1",
      "header [class*='title']"
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const titleEl = el.querySelector('[class*="title"], [class*="overallTitle"]');
      const text = (titleEl || el).innerText.trim();
      if (text && text !== "豆包") return text;
    }

    const title = document.title.replace(/\s*[-–—]\s*豆包.*$/i, "").trim();
    if (title && title !== "豆包") return title;

    return "";
  }

  window.CGIAAdapters.register({
    id: "doubao",
    name: "豆包",
    match,
    getMessageElement,
    getAllMessages,
    getRole,
    getMessageText,
    getMainConversation,
    getConversationTitle,
    shouldIgnoreElement
  });
})();
