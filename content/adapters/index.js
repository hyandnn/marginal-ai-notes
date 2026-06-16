(function () {
  const adapters = [];

  function register(adapter) {
    adapters.push(adapter);
  }

  function getAdapterForPage(pageUrl) {
    let hostname;
    try {
      hostname = new URL(pageUrl || location.href).hostname;
    } catch (e) {
      hostname = location.hostname;
    }

    return adapters.find((a) => a.match(hostname)) || null;
  }

  function getCurrentAdapter() {
    return getAdapterForPage(location.href);
  }

  window.CGIAAdapters = {
    register,
    getAdapterForPage,
    getCurrentAdapter,
    list: () => adapters.slice()
  };
})();
