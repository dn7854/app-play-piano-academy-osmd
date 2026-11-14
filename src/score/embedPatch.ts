import { pageContainScaleJs } from "../lib/embedScale";

/**
 * Runs inside the bundled score page. Every layout fits one A4 page inside
 * the WebView slot, and one finger can drag the page on both axes at once.
 * The website studio is not involved.
 */
export const APP_SCORE_PATCH = `(function () {
  function boot() {
  if (window.__d8rAppScore) return true;
  if (!document.documentElement) return false;
  window.__d8rAppScore = true;
  ${pageContainScaleJs}
  var NATURAL_W = 1152;
  var NATURAL_H = NATURAL_W * 297 / 210;
  var zoom = 1;

  function readMessage(data) {
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (err) { return null; }
    }
    return data && typeof data === "object" ? data : null;
  }

  window.addEventListener("message", function (event) {
    var message = readMessage(event.data);
    if (!message) return;
    if (message.type === "setZoom" && typeof message.zoom === "number" && message.zoom > 0) {
      zoom = message.zoom;
      schedule();
    } else if (message.type === "setLayout") {
      schedule();
    }
  });

  function nodes() {
    var cream = document.querySelector(".osmd-cream");
    if (!cream || !cream.parentElement) return null;
    var scroller = cream.closest(".touch-pan-y");
    if (!scroller) return null;
    return { scroller: scroller, stage: cream, wrap: cream.parentElement };
  }

  var frame = 0;
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      refit();
    });
  }

  function refit() {
    var sheet = nodes();
    if (!sheet) return;
    var wrapW = parseFloat(sheet.wrap.style.width);
    if (!wrapW) return;
    var availW = sheet.scroller.clientWidth;
    var availH = sheet.scroller.clientHeight;
    var desired = pageContainScale(availW, availH, NATURAL_W, NATURAL_H, zoom);
    if (desired == null) return;
    var nextW = Math.floor(NATURAL_W * desired);
    var nextH = Math.floor(NATURAL_H * desired);
    var curH = parseFloat(sheet.wrap.style.height) || 0;
    if (Math.abs(wrapW - nextW) < 2 && Math.abs(curH - nextH) < 2) return;
    sheet.stage.style.transformOrigin = "top left";
    sheet.stage.style.transform = "scale(" + desired + ")";
    sheet.wrap.style.width = nextW + "px";
    sheet.wrap.style.height = nextH + "px";
    sheet.wrap.style.flexShrink = "0";
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
      var observer = new ResizeObserver(function () { schedule(); });
      observer.observe(sheet.scroller);
    }
    var styles = new MutationObserver(function () { schedule(); });
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
