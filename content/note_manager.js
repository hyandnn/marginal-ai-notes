(function () {
  const activeNotes = new Map(); // noteId -> { note, el }
  let topZIndex = 2147483000;

  const DEFAULT_SIZE = { width: 360, height: 420 };

  // ---------- helpers ----------

  function createNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function calculateNotePosition(selectionRect, noteWidth = 360, noteHeight = 420) {
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x, y;

    // 优先右侧
    if (selectionRect.right + margin + noteWidth <= vw) {
      x = selectionRect.right + margin;
    } else if (selectionRect.left - margin - noteWidth >= 0) {
      // 左侧
      x = selectionRect.left - margin - noteWidth;
    } else {
      // 居中
      x = Math.max(10, (vw - noteWidth) / 2);
    }

    y = selectionRect.top;

    // 确保不超出视口
    x = Math.max(10, Math.min(x, vw - noteWidth - 10));
    y = Math.max(10, Math.min(y, vh - noteHeight - 10));

    return { x, y };
  }

  function clampPositionToViewport(position, size) {
    const w = (size && size.width) || DEFAULT_SIZE.width;
    const h = (size && size.height) || DEFAULT_SIZE.height;
    const x = Math.max(10, Math.min(position.x, window.innerWidth - w - 10));
    const y = Math.max(10, Math.min(position.y, window.innerHeight - h - 10));
    return { x, y };
  }

  function bringNoteToFront(noteEl) {
    topZIndex += 1;
    noteEl.style.zIndex = String(topZIndex);
  }

  // 标题取自选中文本：含空格的语言按单词数截断（≤5 个单词全显），
  // 中文等无空格文本按字数截断（≤5 字全显）。
  // 单词特别长导致放不下时，由 CSS 的 text-overflow: ellipsis 兜底。
  function makeNoteTitle(selectedText) {
    const t = (selectedText || "").trim().replace(/\s+/g, " ");
    if (!t) return "局部追问";

    const words = t.split(" ");
    if (words.length > 1) {
      if (words.length <= 5) return t;
      return words.slice(0, 5).join(" ") + "...";
    }

    if (t.length <= 5) return t;
    return t.slice(0, 5) + "...";
  }

  // 折叠时窗口缩到原宽度的 85%，只留标题条
  function applyCollapsedWidth(noteEl, note) {
    const w = (note.size && note.size.width) || DEFAULT_SIZE.width;
    noteEl.style.width = note.collapsed ? `${Math.round(w * 0.85)}px` : `${w}px`;
  }

  // DOMParser 中转：绕过 chatgpt.com 的 Trusted Types CSP，
  // 同时对 marked 输出的 HTML 做安全隔离（只取 body 子节点）
  function markdownToFragment(md) {
    try {
      const html = typeof marked !== "undefined" ? marked.parse(md) : null;
      if (!html) throw new Error("marked not available");
      const doc = new DOMParser().parseFromString(html, "text/html");
      const frag = document.createDocumentFragment();
      Array.from(doc.body.childNodes).forEach((node) =>
        frag.appendChild(document.importNode(node, true))
      );
      return frag;
    } catch (e) {
      // 降级：纯文本
      const span = document.createElement("span");
      span.textContent = md;
      const frag = document.createDocumentFragment();
      frag.appendChild(span);
      return frag;
    }
  }

  function appendMessage(container, role, content) {
    const div = document.createElement("div");
    div.className = `cgia-message cgia-message-${role}`;
    if (role === "assistant") {
      div.appendChild(markdownToFragment(content));
    } else {
      div.textContent = content;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ---------- DOM ----------

  // chatgpt.com 启用 Trusted Types CSP，innerHTML 赋值会抛 TypeError，
  // 因此窗口 DOM 必须用 createElement 逐个构建。
  function buildNoteDom(note) {
    const el = document.createElement("div");
    el.className = "cgia-note";
    el.dataset.noteId = note.noteId;

    const header = document.createElement("div");
    header.className = "cgia-note-header";

    const title = document.createElement("span");
    title.className = "cgia-note-title";
    title.textContent = makeNoteTitle(note.selectedText);
    title.title = (note.selectedText || "").slice(0, 200); // hover 看完整内容

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "cgia-note-collapse";
    collapseBtn.title = "折叠";
    collapseBtn.textContent = "−";

    const closeBtn = document.createElement("button");
    closeBtn.className = "cgia-note-close";
    closeBtn.title = "关闭";
    closeBtn.textContent = "×";

    header.appendChild(title);
    header.appendChild(collapseBtn);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "cgia-note-body";

    const quote = document.createElement("div");
    quote.className = "cgia-quote";

    const messages = document.createElement("div");
    messages.className = "cgia-messages";

    const inputRow = document.createElement("div");
    inputRow.className = "cgia-input-row";

    const textarea = document.createElement("textarea");
    textarea.className = "cgia-question-input";
    textarea.placeholder = "输入问题…";

    const sendBtn = document.createElement("button");
    sendBtn.className = "cgia-send-button";
    sendBtn.textContent = "发送";

    inputRow.appendChild(textarea);
    inputRow.appendChild(sendBtn);

    body.appendChild(quote);
    body.appendChild(messages);
    body.appendChild(inputRow);

    el.appendChild(header);
    el.appendChild(body);

    // 原文引用：超过 300 字默认折叠，提供"展开引用"
    const quoteEl = el.querySelector(".cgia-quote");
    const fullQuote = note.selectedText || "";
    if (fullQuote.length > 300) {
      const short = fullQuote.slice(0, 300) + "…";
      quoteEl.textContent = short;
      const expandBtn = document.createElement("button");
      expandBtn.className = "cgia-quote-expand";
      expandBtn.textContent = "展开引用";
      let expanded = false;
      expandBtn.addEventListener("click", () => {
        expanded = !expanded;
        quoteEl.textContent = expanded ? fullQuote : short;
        quoteEl.appendChild(expandBtn);
        expandBtn.textContent = expanded ? "收起引用" : "展开引用";
      });
      quoteEl.appendChild(expandBtn);
    } else {
      quoteEl.textContent = fullQuote;
    }

    // position / size
    const size = note.size || DEFAULT_SIZE;
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
    const pos = clampPositionToViewport(note.position, size);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    // collapsed
    if (note.collapsed) {
      el.classList.add("collapsed");
      el.querySelector(".cgia-note-collapse").textContent = "+";
      applyCollapsedWidth(el, note);
    }

    // 历史消息
    const messagesEl = el.querySelector(".cgia-messages");
    (note.messages || []).forEach((m) => {
      if (m.role === "user" || m.role === "assistant") {
        appendMessage(messagesEl, m.role, m.content);
      }
    });

    return el;
  }

  // ---------- interactions ----------

  function initDrag(noteEl, note) {
    const header = noteEl.querySelector(".cgia-note-header");
    let dragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(noteEl.style.left) || 0;
      startTop = parseInt(noteEl.style.top) || 0;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      const w = noteEl.offsetWidth;
      const h = noteEl.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - w));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - h));

      noteEl.style.left = `${newLeft}px`;
      noteEl.style.top = `${newTop}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      note.position.x = parseInt(noteEl.style.left);
      note.position.y = parseInt(noteEl.style.top);
      note.updatedAt = new Date().toISOString();
      window.CGIAStorage.saveNote(note);
    });
  }

  function initCollapse(noteEl, note) {
    const btn = noteEl.querySelector(".cgia-note-collapse");
    btn.addEventListener("click", () => {
      note.collapsed = !note.collapsed;
      noteEl.classList.toggle("collapsed", note.collapsed);
      btn.textContent = note.collapsed ? "+" : "−";
      applyCollapsedWidth(noteEl, note);
      if (!note.collapsed && note.size) {
        noteEl.style.height = `${note.size.height}px`; // 展开时恢复保存的高度
      }
      note.updatedAt = new Date().toISOString();
      window.CGIAStorage.saveNote(note);
    });
  }

  function initClose(noteEl, note) {
    const btn = noteEl.querySelector(".cgia-note-close");
    btn.addEventListener("click", () => {
      note.status = "hidden";
      note.updatedAt = new Date().toISOString();
      window.CGIAStorage.saveNote(note);
      noteEl.remove();
      activeNotes.delete(note.noteId);
    });
  }

  async function handleSend(noteEl, note) {
    const input = noteEl.querySelector(".cgia-question-input");
    const sendBtn = noteEl.querySelector(".cgia-send-button");
    const messagesEl = noteEl.querySelector(".cgia-messages");

    const question = input.value.trim();
    if (!question) return;

    sendBtn.disabled = true;
    input.value = "";

    appendMessage(messagesEl, "user", question);

    try {
      const payload = {
        noteId: note.noteId,
        pageUrl: note.pageUrl,
        selectedText: note.selectedText,
        surroundingText: note.surroundingText,
        fullMessageText: note.fullMessageText || "",
        mainConversation: note.mainConversation || [],
        userQuestion: question,
        // conversationHistory 只含已完成的历史，不含当前问题
        conversationHistory: note.messages
          .filter((m) => m.status === "completed" && (m.role === "user" || m.role === "assistant"))
          .map((m) => ({ role: m.role, content: m.content })),
        options: { language: "zh-CN", answerStyle: "clear_and_step_by_step" }
      };

      const res = await window.CGIAApiClient.askModel(payload);
      appendMessage(messagesEl, "assistant", res.answer);

      note.messages.push(
        { role: "user", content: question, createdAt: new Date().toISOString(), status: "completed" },
        { role: "assistant", content: res.answer, createdAt: new Date().toISOString(), status: "completed" }
      );
      note.updatedAt = new Date().toISOString();
      window.CGIAStorage.saveNote(note);
    } catch (err) {
      const errDiv = document.createElement("div");
      errDiv.className = "cgia-error-msg";
      errDiv.textContent = `错误：${err.message}`;
      messagesEl.appendChild(errDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } finally {
      sendBtn.disabled = false;
    }
  }

  // 用户拖右下角缩放（CSS resize）后，停止 300ms 再持久化新尺寸
  function initResize(noteEl, note) {
    let saveTimer = null;
    const observer = new ResizeObserver(() => {
      if (note.collapsed) return; // 折叠态高度是 auto，不存档
      const w = noteEl.offsetWidth;
      const h = noteEl.offsetHeight;
      if (!w || !h) return;
      if (note.size && note.size.width === w && note.size.height === h) return;

      note.size = { width: w, height: h };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        note.updatedAt = new Date().toISOString();
        window.CGIAStorage.saveNote(note);
      }, 300);
    });
    observer.observe(noteEl);
  }

  function wireNote(noteEl, note) {
    noteEl.addEventListener("mousedown", () => bringNoteToFront(noteEl));
    initDrag(noteEl, note);
    initCollapse(noteEl, note);
    initClose(noteEl, note);
    initResize(noteEl, note);

    const sendBtn = noteEl.querySelector(".cgia-send-button");
    const input = noteEl.querySelector(".cgia-question-input");
    sendBtn.addEventListener("click", () => handleSend(noteEl, note));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend(noteEl, note);
      }
    });
  }

  function renderNote(note) {
    if (activeNotes.has(note.noteId)) return activeNotes.get(note.noteId).el;
    const el = buildNoteDom(note);
    document.body.appendChild(el);
    bringNoteToFront(el);
    wireNote(el, note);
    activeNotes.set(note.noteId, { note, el });
    return el;
  }

  // ---------- public API ----------

  function createNote(selectionInfo) {
    const now = new Date().toISOString();
    const position = calculateNotePosition(selectionInfo.rect);

    const note = {
      noteId: createNoteId(),
      pageUrl: location.href,
      selectedText: selectionInfo.selectedText,
      selectedTextHash: selectionInfo.selectedTextHash,
      surroundingText: selectionInfo.surroundingText,
      fullMessageText: selectionInfo.fullMessageText || "",
      mainConversation: selectionInfo.mainConversation || [],
      status: "visible",
      position,
      size: { ...DEFAULT_SIZE },
      collapsed: false,
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    window.CGIAStorage.saveNote(note);
    renderNote(note);
    return note;
  }

  async function loadNotesForPage(pageUrl) {
    const settings = window.CGIAStorage.getSettingsSync();
    if (!settings.autoRestoreNotes) return;

    const notes = await window.CGIAStorage.loadNotesForPage(pageUrl);
    notes.filter((n) => n.status === "visible").forEach((note) => renderNote(note));
  }

  function clearNotesForPage(pageUrl) {
    for (const [noteId, { note, el }] of activeNotes.entries()) {
      if (note.pageUrl === pageUrl) {
        el.remove();
        activeNotes.delete(noteId);
      }
    }
  }

  window.CGIANoteManager = {
    createNote,
    loadNotesForPage,
    clearNotesForPage
  };
})();
