(function () {
  const SCHEMA_VERSION = 1;

  const NOTE_TYPES = [
    { value: "general", label: "通用" },
    { value: "concept", label: "解释概念" },
    { value: "debug", label: "调试记录" },
    { value: "code", label: "代码方案" },
    { value: "paper", label: "论文/学习" },
    { value: "interview", label: "面试准备" },
    { value: "todo", label: "TODO" }
  ];

  const MARKS = [
    { value: "important", label: "重要" },
    { value: "concept", label: "概念" },
    { value: "reusable-code", label: "代码" },
    { value: "todo", label: "待办" }
  ];

  const VALID_NOTE_TYPES = new Set(NOTE_TYPES.map((t) => t.value));
  const VALID_MARKS = new Set(MARKS.map((m) => m.value));

  function parseTagsInput(raw) {
    return (raw || "")
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function formatTags(tags) {
    return (tags || []).join(", ");
  }

  function buildFollowups(messages) {
    const followups = [];
    const msgs = messages || [];

    for (let i = 0; i < msgs.length; i++) {
      const user = msgs[i];
      if (user?.role !== "user") continue;
      const assistant = msgs[i + 1];
      if (assistant?.role !== "assistant") continue;

      followups.push({
        q: user.content,
        a: assistant.content,
        time: user.createdAt || new Date().toISOString()
      });
      i += 1;
    }

    return followups;
  }

  function noteToJsonlRecord(note) {
    const noteType = VALID_NOTE_TYPES.has(note.noteType) ? note.noteType : "general";
    const marks = (note.marks || []).filter((m) => VALID_MARKS.has(m));

    return {
      schema_version: SCHEMA_VERSION,
      id: `rec_${note.noteId}`,
      time: note.updatedAt || note.createdAt || new Date().toISOString(),
      source: note.siteId || "unknown",
      url: note.pageUrl || "",
      main_topic: note.mainTopic || "",
      main_question: note.mainQuestion || "",
      selected_text: note.selectedText || "",
      followups: buildFollowups(note.messages),
      note_type: noteType,
      marks,
      tags: note.tags || [],
      status: "draft"
    };
  }

  function normalizeNote(note, defaults = {}) {
    return {
      ...note,
      noteType: VALID_NOTE_TYPES.has(note.noteType)
        ? note.noteType
        : defaults.defaultNoteType || "general",
      marks: Array.isArray(note.marks)
        ? note.marks.filter((m) => VALID_MARKS.has(m))
        : [],
      tags: Array.isArray(note.tags) ? note.tags : [],
      mainTopic: note.mainTopic || "",
      mainQuestion: note.mainQuestion || ""
    };
  }

  window.CGIANoteSchema = {
    SCHEMA_VERSION,
    NOTE_TYPES,
    MARKS,
    VALID_NOTE_TYPES,
    VALID_MARKS,
    parseTagsInput,
    formatTags,
    buildFollowups,
    noteToJsonlRecord,
    normalizeNote
  };
})();
