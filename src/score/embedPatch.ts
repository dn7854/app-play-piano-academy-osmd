import { portraitPageScaleJs } from "../lib/embedScale";

/**
 * Runs inside the bundled score page. Portrait layout is tightened to the
 * WebView slot, and one finger can drag the page on both axes at once.
 * The website studio is not involved.
 */
export const APP_SCORE_PATCH = `(function () {
  function boot() {
  if (window.__d8rAppScore) return true;
  if (!document.documentElement) return false;
  window.__d8rAppScore = true;
  ${portraitPageScaleJs}
  var NATURAL_W = 1152;
  var NATURAL_H = NATURAL_W * 297 / 210;
  var layout = "portrait";
  var appliedW = 0;

  function readMessage(data) {
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (err) { return null; }
    }
    return data && typeof data === "object" ? data : null;
  }

  window.addEventListener("message", function (event) {
    var message = readMessage(event.data);
    if (message && message.type === "setLayout" && typeof message.layout === "string") {
      layout = message.layout;
    }
  });

  function nodes() {
    var cream = document.querySelector(".osmd-cream");
    if (!cream || !cream.parentElement) return null;
    var scroller = cream.closest(".touch-pan-y");
    if (!scroller) return null;
    return { scroller: scroller, stage: cream, wrap: cream.parentElement };
  }

  function refit() {
    if (layout !== "portrait") {
      appliedW = 0;
      return;
    }
    var sheet = nodes();
    if (!sheet) return;
    var margin = (sheet.scroller.clientWidth <= 768 ? 8 : 16) * 2;
    var availW = Math.max(0, sheet.scroller.clientWidth - margin);
    var availH = Math.max(0, sheet.scroller.clientHeight - margin);
    var wrapW = parseFloat(sheet.wrap.style.width);
    if (!wrapW || Math.abs(wrapW - appliedW) < 1) return;
    var desired = portraitPageScale(availW, availH, NATURAL_W, NATURAL_H, wrapW / NATURAL_W);
    if (desired == null) return;
    var nextW = NATURAL_W * desired;
    if (Math.abs(wrapW - nextW) < 1) {
      appliedW = wrapW;
      return;
    }
    appliedW = nextW;
    sheet.stage.style.transformOrigin = "top left";
    sheet.stage.style.transform = "scale(" + desired + ")";
    sheet.wrap.style.width = nextW + "px";
    sheet.wrap.style.height = (NATURAL_H * desired) + "px";
    sheet.wrap.style.setProperty("--osmd-scale", String(desired));
  }

  function arm(sheet) {
    if (sheet.scroller.dataset.d8rPan === "1") return;
    sheet.scroller.dataset.d8rPan = "1";
    sheet.scroller.style.touchAction = "none";
    var pan = null;
    sheet.scroller.addEventListener("touchstart", function (event) {
      if (event.touches.length !== 1) {
        pan = null;
        return;
      }
      var touch = event.touches[0];
      pan = {
        x: touch.clientX,
        y: touch.clientY,
        left: sheet.scroller.scrollLeft,
        top: sheet.scroller.scrollTop,
        moved: false,
      };
    }, { passive: true });
    sheet.scroller.addEventListener("touchmove", function (event) {
      if (!pan || event.touches.length !== 1) return;
      var touch = event.touches[0];
      var dx = touch.clientX - pan.x;
      var dy = touch.clientY - pan.y;
      if (Math.hypot(dx, dy) > 4) pan.moved = true;
      if (!pan.moved) return;
      event.preventDefault();
      sheet.scroller.scrollLeft = pan.left - dx;
      sheet.scroller.scrollTop = pan.top - dy;
    }, { passive: false });
    sheet.scroller.addEventListener("touchcancel", function () { pan = null; });
    sheet.scroller.addEventListener("pointerup", function (event) {
      var gesture = pan;
      pan = null;
      if (!gesture || !gesture.moved) return;
      var overflows = sheet.scroller.scrollWidth > sheet.scroller.clientWidth + 2;
      var dx = event.clientX - gesture.x;
      var dy = event.clientY - gesture.y;
      var flick = !overflows && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!flick) event.stopPropagation();
    }, true);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () { requestAnimationFrame(refit); });
      observer.observe(sheet.scroller);
    }
    var styles = new MutationObserver(function () { refit(); });
    styles.observe(sheet.wrap, { attributes: true, attributeFilter: ["style"] });
    refit();
  }

  function watch() {
    var sheet = nodes();
    if (sheet) arm(sheet);
  }
  watch();
  var waiting = new MutationObserver(watch);
  waiting.observe(document.documentElement, { childList: true, subtree: true });
  return true;
  }
  if (!boot()) document.addEventListener("DOMContentLoaded", boot);
})();`;
