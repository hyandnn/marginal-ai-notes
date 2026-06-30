(async function init() {
  await window.CGIAStorage.loadSettings();
  window.CGIASelection.initSelection();
  window.CGIARouteManager.initRouteManager();
  await window.CGIANoteManager.loadNotesForPage(location.href);
})();
