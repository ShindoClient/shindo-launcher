const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

function report(url) {
  if (typeof url !== "string") return;
  if (url.startsWith(REDIRECT_URI)) {
    if (typeof window.__electrobunSendToHost === "function") {
      window.__electrobunSendToHost({ type: "oauth-redirect", url });
    }
  }
}

function notifyCurrentLocation() {
  try {
    report(window.location.href);
  } catch {
    /**/
  }
}

const originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  const result = originalPushState(...args);
  notifyCurrentLocation();
  return result;
};

const originalReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
  const result = originalReplaceState(...args);
  notifyCurrentLocation();
  return result;
};

window.addEventListener("popstate", () => notifyCurrentLocation());
window.addEventListener("hashchange", () => notifyCurrentLocation());
window.addEventListener("DOMContentLoaded", () => notifyCurrentLocation());
notifyCurrentLocation();
