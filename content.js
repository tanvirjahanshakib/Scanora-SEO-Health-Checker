// Scanora content script — runs in the inspected page, uses the shared
// ScanoraAnalyzer library (injected first) and adds page-only data
// (load timing) that a fetched/parsed document can't provide.

(function () {
  if (window.__scanoraInjected) return;
  window.__scanoraInjected = true;

  function analyzePerformance() {
    let loadMs = null;
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) loadMs = Math.round(nav.loadEventEnd - nav.startTime);
    } catch (e) { /* Performance API unavailable */ }
    return { loadMs };
  }

  function collectSnapshot() {
    const snapshot = window.ScanoraAnalyzer.analyze(document, location.href);
    snapshot.performance = analyzePerformance();
    return snapshot;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "SCANORA_SCAN") {
      try {
        sendResponse({ ok: true, data: collectSnapshot() });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    }
    return true;
  });
})();
