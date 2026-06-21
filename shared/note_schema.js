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

  const NOTE_TYPE_LABELS = Object.fromEntries(NOTE_TYPES.map((t) => [t.value, t.label]));

  function simpleHash(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  function hashUrl(url) {
    return simpleHash(url || "");
  }

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

  function computeContentHashFromParts(url, selectedText, followups) {
    const payload = JSON.stringify({
      url: url || "",
      selected_text: selectedText || "",
      followups: (followups || []).map((f) => ({ q: f.q || "", a: f.a || "" }))
    });
    return `hash_${simpleHash(payload)}`;
  }

  function computeContentHashForNote(note) {
    return computeContentHashFromParts(
      note.pageUrl,
      note.selectedText,
      buildFollowups(note.messages)
    );
  }

  function computeContentHashForRecord(record) {
    if (record.content_hash) return record.content_hash;

    if (record.turns?.length) {
      const payload = JSON.stringify({
        url: record.url || "",
        turns: record.turns.map((t) => ({
          id: t.id || "",
          selected_text: t.selected_text || "",
          followups: (t.followups || []).map((f) => ({ q: f.q || "", a: f.a || "" }))
        }))
      });
      return `hash_${simpleHash(payload)}`;
    }

    return computeContentHashFromParts(
      record.url,
      record.selected_text,
      record.followups
    );
  }

  function noteHasFollowups(note) {
    return buildFollowups(note.messages).length > 0;
  }

  function noteIsEmpty(note) {
    return !(note.selectedText || "").trim();
  }

  function filterNotesForExport(notes, options = {}) {
    const { excludeEmpty = false, excludeNoFollowups = false } = options;
    return (notes || []).filter((n) => {
      if (n.status === "hidden") return false;
      if (excludeEmpty && noteIsEmpty(n)) return false;
      if (excludeNoFollowups && !noteHasFollowups(n)) return false;
      return true;
    });
  }

  function buildExportPreview(notes) {
    const typeCounts = {};
    const topics = [];
    const seenTopics = new Set();

    (notes || []).forEach((n) => {
      const t = VALID_NOTE_TYPES.has(n.noteType) ? n.noteType : "general";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      const topic = (n.mainTopic || "").trim();
      if (topic && !seenTopics.has(topic)) {
        seenTopics.add(topic);
        topics.push(topic);
      }
    });

    const urlGroups = {};
    (notes || []).forEach((n) => {
      const url = n.pageUrl || "";
      urlGroups[url] = (urlGroups[url] || 0) + 1;
    });
    const mergeableUrls = Object.values(urlGroups).filter((c) => c > 1).length;

    return {
      count: notes.length,
      typeCounts,
      topics: topics.slice(0, 8),
      moreTopics: Math.max(0, topics.length - 8),
      mergeableUrls,
      jsonlLines: notes.length
    };
  }

  function buildExportPreviewWithMerge(notes, mergeByUrl) {
    const base = buildExportPreview(notes);
    if (!mergeByUrl) return base;

    const groups = groupNotesByUrl(notes);
    return {
      ...base,
      jsonlLines: groups.length,
      mergeGroups: groups.filter((g) => g.notes.length > 1).length
    };
  }

  function groupNotesByUrl(notes) {
    const map = new Map();
    (notes || []).forEach((note) => {
      const url = note.pageUrl || "";
      if (!map.has(url)) map.set(url, []);
      map.get(url).push(note);
    });
    return Array.from(map.entries()).map(([url, groupNotes]) => ({
      url,
      notes: groupNotes.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      )
    }));
  }

  function turnFromNote(note) {
    const noteType = VALID_NOTE_TYPES.has(note.noteType) ? note.noteType : "general";
    const marks = (note.marks || []).filter((m) => VALID_MARKS.has(m));
    const followups = buildFollowups(note.messages);

    return {
      id: `rec_${note.noteId}`,
      time: note.updatedAt || note.createdAt || new Date().toISOString(),
      selected_text: note.selectedText || "",
      followups,
      note_type: noteType,
      marks,
      tags: note.tags || []
    };
  }

  function mergeNotesToRecord(notes) {
    if (!notes.length) return null;
    const sorted = [...notes].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    const first = sorted[0];
    const turns = sorted.map(turnFromNote);
    const allTags = [...new Set(sorted.flatMap((n) => n.tags || []))];
    const url = first.pageUrl || "";
    const latest = sorted.reduce((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0) > new Date(a.updatedAt || a.createdAt || 0)
        ? b
        : a
    );

    const record = {
      schema_version: SCHEMA_VERSION,
      id: `rec_url_${hashUrl(url)}`,
      time: latest.updatedAt || latest.createdAt || new Date().toISOString(),
      source: first.siteId || "unknown",
      url,
      main_topic: first.mainTopic || "",
      main_question: first.mainQuestion || "",
      selected_text: "",
      followups: [],
      note_type: first.noteType && VALID_NOTE_TYPES.has(first.noteType) ? first.noteType : "general",
      marks: [],
      tags: allTags,
      status: "draft",
      turns
    };
    record.content_hash = computeContentHashForRecord(record);
    return record;
  }

  function noteToJsonlRecord(note) {
    const noteType = VALID_NOTE_TYPES.has(note.noteType) ? note.noteType : "general";
    const marks = (note.marks || []).filter((m) => VALID_MARKS.has(m));
    const followups = buildFollowups(note.messages);

    const record = {
      schema_version: SCHEMA_VERSION,
      id: `rec_${note.noteId}`,
      time: note.updatedAt || note.createdAt || new Date().toISOString(),
      source: note.siteId || "unknown",
      url: note.pageUrl || "",
      main_topic: note.mainTopic || "",
      main_question: note.mainQuestion || "",
      selected_text: note.selectedText || "",
      followups,
      note_type: noteType,
      marks,
      tags: note.tags || [],
      status: "draft"
    };
    record.content_hash = computeContentHashForRecord(record);
    return record;
  }

  function notesToJsonlRecords(notes, options = {}) {
    const { mergeByUrl = false } = options;
    if (!mergeByUrl) {
      return notes.map((n) => noteToJsonlRecord(n));
    }

    return groupNotesByUrl(notes).map((g) => {
      if (g.notes.length === 1) return noteToJsonlRecord(g.notes[0]);
      return mergeNotesToRecord(g.notes);
    });
  }

  function exportFilenameTopic(records) {
    if (!records?.length) return "notes";
    if (records.length === 1) {
      return records[0].main_topic || records[0].selected_text || "notes";
    }
    const first = records[0];
    return first.main_topic || first.source || "notes";
  }

  function exportFilenameSite(records) {
    if (!records?.length) return "notes";
    const sites = [...new Set(records.map((r) => r.source).filter(Boolean))];
    if (sites.length === 1) return sites[0];
    return "multi";
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
    NOTE_TYPE_LABELS,
    VALID_NOTE_TYPES,
    VALID_MARKS,
    parseTagsInput,
    formatTags,
    buildFollowups,
    simpleHash,
    computeContentHashForNote,
    computeContentHashForRecord,
    noteHasFollowups,
    noteIsEmpty,
    filterNotesForExport,
    buildExportPreview,
    buildExportPreviewWithMerge,
    groupNotesByUrl,
    noteToJsonlRecord,
    notesToJsonlRecords,
    exportFilenameTopic,
    exportFilenameSite,
    normalizeNote
  };
})();
