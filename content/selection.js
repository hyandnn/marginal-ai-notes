(function () {
  let selectionButtonEl = null;
  let currentSelectionInfo = null;

  function hideSelectionButton() {
    if (selectionButtonEl) {
      selectionButtonEl.remove();
      selectionButtonEl = null;
    }
    currentSelectionInfo = null;
  }

  function removeSelectionButtonOnly() {
    if (selectionButtonEl) {
      selectionButtonEl.remove();
      selectionButtonEl = null;
    }
  }

  function shouldIgnoreSelection(selection) {
    if (!selection || selection.rangeCount === 0) return true;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return true;

    const el =
      anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode;

    if (!el) return true;

    const ignoreTags = ["TEXTAREA", "INPUT"];
    if (ignoreTags.includes(el.tagName)) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest(".cgia-note")) return true;
    if (el.closest(".cgia-selection-button")) return true;

    return false;
  }

  function getSurroundingText(selection, maxLength) {
    try {
      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer;

      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      let paragraph = container;
      while (paragraph && paragraph !== document.body) {
        const tag = paragraph.tagName;
        if (["P", "LI", "DIV", "SECTION", "ARTICLE", "BLOCKQUOTE"].includes(tag)) {
          break;
        }
        paragraph = paragraph.parentElement;
      }

      const fullText = (paragraph || container).innerText || "";
      return truncateAroundSelection(
        fullText,
        selection.toString().trim(),
        maxLength
      );
    } catch (e) {
      return selection.toString().trim();
    }
  }

  function truncateAroundSelection(surroundingText, selectedText, maxLength) {
    const text = surroundingText.trim();
    if (text.length <= maxLength) return text;

    const idx = text.indexOf(selectedText);
    if (idx === -1) {
      return text.slice(0, maxLength) + "\n\n[上下文已截断]";
    }

    const half = Math.floor((maxLength - selectedText.length) / 2);
    const start = Math.max(0, idx - half);
    const end = Math.min(text.length, idx + selectedText.length + half);

    const prefix = start > 0 ? "[前文已截断]\n" : "";
    const suffix = end < text.length ? "\n[后文已截断]" : "";

    return prefix + text.slice(start, end) + suffix;
  }

  function truncateSimple(text, maxLength) {
    const t = (text || "").trim();
    if (t.length <= maxLength) return t;
    return t.slice(0, maxLength) + "\n[已截断]";
  }

  // 选区所在的整条 ChatGPT 消息节点（依赖 data-message-author-role 属性，可能随官方改版失效）
  function getMessageElement(selection) {
    try {
      const node = selection.anchorNode;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return el ? el.closest("[data-message-author-role]") : null;
    } catch (e) {
      return null;
    }
  }

  function getFullMessageText(messageEl, selectedText, maxLength) {
    if (!messageEl) return "";
    try {
      return truncateAroundSelection(messageEl.innerText || "", selectedText, maxLength);
    } catch (e) {
      return "";
    }
  }

  // 选区所在消息之前的最近 maxMessages 条主对话（user/assistant 交替）
  function getMainConversation(messageEl, maxMessages, perMessageMax) {
    try {
      const all = Array.from(document.querySelectorAll("[data-message-author-role]"));
      if (all.length === 0) return [];

      let endIdx = messageEl ? all.indexOf(messageEl) : all.length;
      if (endIdx === -1) endIdx = all.length;

      return all
        .slice(Math.max(0, endIdx - maxMessages), endIdx)
        .map((el) => ({
          role: el.getAttribute("data-message-author-role") === "user" ? "user" : "assistant",
          content: truncateSimple(el.innerText, perMessageMax)
        }))
        .filter((m) => m.content);
    } catch (e) {
      return [];
    }
  }

  function hashStringFNV1a(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  function onMouseUp(e) {
    const target = e && e.target;
    if (
      target &&
      target.closest &&
      (target.closest(".cgia-selection-button") || target.closest(".cgia-note"))
    ) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    if (shouldIgnoreSelection(selection) || text.length < 2) {
      hideSelectionButton();
      return;
    }

    const settings = window.CGIAStorage.getSettingsSync();
    if (text.length > settings.maxSelectedTextLength) {
      hideSelectionButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const messageEl = getMessageElement(selection);

    currentSelectionInfo = {
      selectedText: text,
      selectedTextHash: hashStringFNV1a(text),
      surroundingText: getSurroundingText(selection, settings.surroundingTextMaxLength),
      fullMessageText: settings.includeFullMessage
        ? getFullMessageText(messageEl, text, settings.fullMessageMaxLength)
        : "",
      mainConversation: settings.includeMainConversation
        ? getMainConversation(messageEl, settings.mainConversationMaxMessages, 800)
        : [],
      rect
    };

    showSelectionButton(rect);
  }

  function showSelectionButton(rect) {
    removeSelectionButtonOnly();

    const btn = document.createElement("button");
    btn.className = "cgia-selection-button";
    btn.textContent = "旁注追问";

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    const btnWidth = 90;
    if (left + btnWidth > window.innerWidth - 10) {
      left = window.innerWidth - btnWidth - 10;
    }

    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (currentSelectionInfo) {
          window.CGIANoteManager.createNote(currentSelectionInfo);
        }
      } catch (err) {
        console.error("[CGIA] createNote failed:", err);
      }
      hideSelectionButton();
    });

    document.body.appendChild(btn);
    selectionButtonEl = btn;
  }

  function initSelection() {
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", (e) => {
      if (selectionButtonEl && !selectionButtonEl.contains(e.target)) {
        hideSelectionButton();
      }
    });
    document.addEventListener("keydown", (e) => {
      // ESC 仅关闭临时悬浮按钮，不关闭已创建旁注
      if (e.key === "Escape") {
        hideSelectionButton();
      }
    });
  }

  window.CGIASelection = {
    initSelection,
    hideSelectionButton
  };
})();
