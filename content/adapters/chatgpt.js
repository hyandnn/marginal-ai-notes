(function () {
  const { truncateAroundSelection, truncateSimple, selectionAnchorElement } =
    window.CGIAAdapterShared;

  function match(hostname) {
    return hostname === "chatgpt.com" || hostname === "chat.openai.com";
  }

  function getMessageElement(selection) {
    try {
      const el = selectionAnchorElement(selection);
      return el ? el.closest("[data-message-author-role]") : null;
    } catch (e) {
      return null;
    }
  }

  function getAllMessages() {
    return Array.from(document.querySelectorAll("[data-message-author-role]"));
  }

  function getRole(messageEl) {
    return messageEl.getAttribute("data-message-author-role") === "user"
      ? "user"
      : "assistant";
  }

  function getMessageText(messageEl, selectedText, maxLength) {
    return truncateAroundSelection(messageEl.innerText || "", selectedText, maxLength);
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
          content: truncateSimple(el.innerText, perMessageMax)
        }))
        .filter((m) => m.content);
    } catch (e) {
      return [];
    }
  }

  function shouldIgnoreElement(el) {
    return false;
  }

  function getConversationTitle() {
    const title = document.title.replace(/\s*[-–—]\s*ChatGPT\s*$/i, "").trim();
    if (title && !/^chatgpt$/i.test(title) && !/^new chat$/i.test(title)) {
      return title;
    }

    const active = document.querySelector(
      'nav a[aria-current="page"], [data-testid="conversation-title"]'
    );
    if (active) {
      const text = (active.innerText || active.textContent || "").trim();
      if (text) return text;
    }

    return "";
  }

  window.CGIAAdapters.register({
    id: "chatgpt",
    name: "ChatGPT",
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
