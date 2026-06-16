(function () {
  const { truncateAroundSelection, truncateSimple, sortByDocumentOrder, selectionAnchorElement } =
    window.CGIAAdapterShared;

  const UI_NOISE_SNIPPETS = [
    "内容由豆包 AI 生成，请仔细甄别",
    "请仔细甄别",
    "下载电脑版"
  ];

  const MESSAGE_LIST_SELECTORS = [
    '[data-table-spillover="true"][data-table-spillover-force-disable="true"]',
    '[class*="message-list"]',
    '[data-testid="message-list"]',
    ".scroll-view-OEiNXD"
  ];

  function match(hostname) {
    return hostname === "www.doubao.com" || hostname === "doubao.com";
  }

  function getMessageListRoot() {
    for (const selector of MESSAGE_LIST_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return document.body;
  }

  function isUiNoise(el) {
    const text = (el.innerText || "").trim();
    if (!text) return true;
    return UI_NOISE_SNIPPETS.some(
      (snippet) => text === snippet || (text.length < 40 && text.includes(snippet))
    );
  }

  function getRole(messageEl) {
    if (messageEl.classList.contains("justify-end")) return "user";
    if (messageEl.matches('[class*="bg-g-send-msg-bubble"]')) return "user";
    if (messageEl.matches('[class*="bg-g-receive-msg-bubble"]')) return "assistant";
    if (messageEl.hasAttribute("data-message-id")) {
      return messageEl.classList.contains("justify-end") ? "user" : "assistant";
    }
    return "assistant";
  }

  function extractMessageText(messageEl) {
    const markdown = messageEl.querySelector(".flow-markdown-body");
    if (markdown) return markdown.innerText || "";
    const userText = messageEl.querySelector(
      ".whitespace-pre-wrap.wrap-anywhere:not(.gh-user-query-markdown)"
    );
    if (userText) return userText.innerText || "";
    return messageEl.innerText || "";
  }

  function getAllMessages() {
    const root = getMessageListRoot();
    let nodes = Array.from(root.querySelectorAll("[data-message-id]"));

    if (nodes.length === 0) {
      const bubbles = [
        ...root.querySelectorAll('[class*="bg-g-send-msg-bubble"]'),
        ...root.querySelectorAll('[class*="bg-g-receive-msg-bubble"]')
      ];
      nodes = sortByDocumentOrder(bubbles);
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

      return (
        el.closest("[data-message-id]") ||
        el.closest('[class*="bg-g-receive-msg-bubble"]') ||
        el.closest('[class*="bg-g-send-msg-bubble"]')
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
    if (el.closest('[class*="input"]')?.closest("footer")) return true;
    return false;
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
    shouldIgnoreElement
  });
})();
