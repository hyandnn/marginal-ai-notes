(function () {
  let currentUrl = location.href;
  let initialized = false;

  function onRouteChanged(newUrl) {
    if (newUrl === currentUrl) return;

    const oldUrl = currentUrl;
    currentUrl = newUrl;

    console.log("[CGIA] route changed:", oldUrl, "->", newUrl);

    window.CGIANoteManager.clearNotesForPage(oldUrl);
    window.CGIANoteManager.loadNotesForPage(newUrl);
    window.CGIASelection.hideSelectionButton();
  }

  function patchHistoryMethod(methodName) {
    const original = history[methodName];
    history[methodName] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => {
        onRouteChanged(location.href);
      });
      return result;
    };
  }

  function initRouteManager() {
    // 防止 SPA 重渲染导致重复注册
    if (initialized) return;
    initialized = true;

    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("popstate", () => {
      onRouteChanged(location.href);
    });

    // MutationObserver 作为兜底，检测 URL 变化但未被 pushState 捕获的情况
    const observer = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        onRouteChanged(location.href);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: false
    });
  }

  window.CGIARouteManager = { initRouteManager };
})();
