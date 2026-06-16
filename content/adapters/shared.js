(function () {
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

  function sortByDocumentOrder(nodes) {
    return nodes.slice().sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  function selectionAnchorElement(selection) {
    const node = selection.anchorNode;
    if (!node) return null;
    return node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  }

  window.CGIAAdapterShared = {
    truncateAroundSelection,
    truncateSimple,
    sortByDocumentOrder,
    selectionAnchorElement
  };
})();
