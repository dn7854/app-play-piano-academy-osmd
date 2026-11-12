/* D8R Piano Academy score embed. Protocol version 1.
   Bundled fallback for /academy-studio/embed/{pieceId}.
   seconds = whole * 240 / bpm. */
(function () {
  var PROTOCOL = 1;
  var state = {
    bpm: 120,
    playing: false,
    waitMode: false,
    orientation: "portrait",
    device: "phone",
    userZoom: 1,
    seconds: 0,
  };
  var osmd = null;
  var shownPage = 1;
  var loadingUrl = "";
  var gradients = {};

  function post(message) {
    message.source = "d8r-academy";
    var data = JSON.stringify(message);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(data);
    }
  }

  function status(text, visible) {
    var node = document.getElementById("status");
    if (!node) return;
    node.textContent = text || "";
    node.className = visible ? "" : "hidden";
  }

  function pageNodes() {
    var stage = document.getElementById("stage");
    if (!stage) return [];
    return Array.prototype.slice.call(stage.querySelectorAll("svg, canvas")).filter(function (el) {
      return /Page\d+$/.test(el.id || "");
    });
  }

  function showPage(page) {
    shownPage = page;
    pageNodes().forEach(function (el) {
      var match = /(\d+)$/.exec(el.id || "");
      el.style.display = match && Number(match[1]) === page ? "block" : "none";
    });
  }

  function cursorGradient(wait) {
    var key = wait ? "52,211,153" : "56,189,248";
    if (gradients[key]) return gradients[key];
    var canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 1;
    var ctx = canvas.getContext("2d");
    if (!ctx) return "";
    var gradient = ctx.createLinearGradient(0, 0, 128, 0);
    gradient.addColorStop(0, "rgba(" + key + ",0)");
    gradient.addColorStop(0.18, "rgba(" + key + ",0.35)");
    gradient.addColorStop(0.5, "rgba(" + key + ",0.7)");
    gradient.addColorStop(0.82, "rgba(" + key + ",0.35)");
    gradient.addColorStop(1, "rgba(" + key + ",0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 1);
    gradients[key] = canvas.toDataURL();
    return gradients[key];
  }

  function paintCursor() {
    if (!osmd || !osmd.cursor || !osmd.cursor.cursorElement) return;
    var el = osmd.cursor.cursorElement;
    var height = Number(el.getAttribute("height")) || 48;
    var left = parseFloat(el.dataset.osmdLeft || el.style.left) || 0;
    if (!el.dataset.osmdLeft) el.dataset.osmdLeft = String(left);
    var width = 72;
    el.style.display = "block";
    el.style.width = width + "px";
    el.style.height = height + "px";
    el.style.left = left - width / 2 + "px";
    el.src = cursorGradient(state.waitMode);
    el.style.filter = state.waitMode
      ? "drop-shadow(0 0 10px rgba(52,211,153,1)) drop-shadow(0 0 22px rgba(16,185,129,0.95))"
      : "drop-shadow(0 0 10px rgba(125,211,252,1)) drop-shadow(0 0 24px rgba(14,165,233,0.95))";
  }

  function systemHeight() {
    var el = osmd && osmd.cursor && osmd.cursor.cursorElement;
    var height = el ? parseFloat(el.getAttribute("height") || "") : NaN;
    if (height > 24) return height * 1.45;
    return (1152 * 297) / 210 / 6;
  }

  function applyScale() {
    var scroller = document.getElementById("scroller");
    var page = document.getElementById("page");
    var stage = document.getElementById("stage");
    if (!scroller || !page || !stage) return;
    var pageW = 1152;
    var pageH = (1152 * 297) / 210;
    var fit = Math.min(1, Math.max(0.2, (scroller.clientWidth - 12) / pageW));
    var zoom = state.playing ? 1 : state.userZoom;
    var scale = fit;
    if (state.orientation === "landscape") {
      var systems = state.device === "tablet" ? 2.7 : 1.05;
      var staff = (scroller.clientHeight * 0.9) / (systemHeight() * systems);
      scale = Math.max(fit, Math.min(3.2, staff));
    }
    scale *= zoom;
    stage.style.width = pageW + "px";
    stage.style.height = pageH + "px";
    stage.style.transform = "scale(" + scale + ")";
    stage.style.transformOrigin = "top left";
    page.style.width = pageW * scale + "px";
    page.style.height = pageH * scale + "px";
  }

  function follow() {
    if (!state.playing || !osmd || !osmd.cursor || !osmd.cursor.cursorElement) return;
    var scroller = document.getElementById("scroller");
    var el = osmd.cursor.cursorElement;
    if (!scroller) return;
    var er = el.getBoundingClientRect();
    var sr = scroller.getBoundingClientRect();
    var delta = er.top + er.height / 2 - (sr.top + sr.height * 0.42);
    if (Math.abs(delta) > 28) scroller.scrollTop += delta;
  }

  function place(seconds) {
    if (!osmd || !osmd.cursor) return;
    var whole = (seconds * state.bpm) / 240;
    var cursor = osmd.cursor;
    var it = cursor.Iterator;
    if (!it) return;
    var current = (it.CurrentEnrolledTimestamp && it.CurrentEnrolledTimestamp.RealValue) || 0;
    if (current > whole + 0.01) {
      cursor.reset();
      it = cursor.Iterator;
    }
    var guard = 0;
    while (it && !it.EndReached && guard++ < 20000) {
      it.moveToNextVisibleVoiceEntry(false);
      var stamp = (it.CurrentEnrolledTimestamp && it.CurrentEnrolledTimestamp.RealValue) || 0;
      if (stamp > whole + 0.01) {
        if (it.moveToPreviousVisibleVoiceEntry) it.moveToPreviousVisibleVoiceEntry(false);
        break;
      }
    }
    try {
      cursor.show();
    } catch (err) {
      /* cursor can throw before the first render settles */
    }
    paintCursor();
    var page = cursor.currentPageNumber || 1;
    if (page !== shownPage) showPage(page);
    follow();
  }

  function noteMidi(note) {
    if (!note) return null;
    try {
      if (typeof note.isRest === "function" && note.isRest()) return null;
    } catch (err) {
      return null;
    }
    if (typeof note.halfTone === "number" && note.halfTone > 0) return note.halfTone;
    return null;
  }

  function durationWhole(note) {
    var length = note.Length || note.length;
    if (length && typeof length.RealValue === "number" && length.RealValue > 0) return length.RealValue;
    return 0.25;
  }

  function collect(bpm) {
    var cursor = osmd.cursor;
    cursor.reset();
    var it = cursor.Iterator;
    var steps = [];
    var measures = [];
    var seen = {};
    var guard = 0;
    while (it && !it.EndReached && guard++ < 20000) {
      var whole = (it.CurrentEnrolledTimestamp && it.CurrentEnrolledTimestamp.RealValue) || 0;
      var seconds = (whole * 240) / bpm;
      var measureObj = it.CurrentMeasure;
      var measure = (measureObj && (measureObj.MeasureNumber || measureObj.measureNumber)) || measures.length + 1;
      if (!seen[measure]) {
        seen[measure] = true;
        measures.push({ number: measure, whole: whole, seconds: seconds });
      }
      var notes = [];
      var entries = it.CurrentVoiceEntries || [];
      for (var e = 0; e < entries.length; e++) {
        var entryNotes = (entries[e] && entries[e].Notes) || [];
        for (var n = 0; n < entryNotes.length; n++) {
          var midi = noteMidi(entryNotes[n]);
          if (midi == null) continue;
          var dur = durationWhole(entryNotes[n]);
          notes.push({
            midi: midi,
            whole: whole,
            seconds: seconds,
            durationWhole: dur,
            durationSeconds: (dur * 240) / bpm,
            measure: measure,
            staff: null,
          });
        }
      }
      if (notes.length) {
        var longest = notes[0].durationWhole;
        for (var i = 1; i < notes.length; i++) longest = Math.max(longest, notes[i].durationWhole);
        steps.push({
          whole: whole,
          seconds: seconds,
          durationWhole: longest,
          durationSeconds: (longest * 240) / bpm,
          measure: measure,
          notes: notes,
        });
      }
      it.moveToNextVisibleVoiceEntry(false);
    }
    cursor.reset();
    return { measures: measures, steps: steps };
  }

  function setRule(key, value) {
    try {
      osmd.EngravingRules[key] = value;
    } catch (err) {
      /* older OSMD builds omit a few rules */
    }
  }

  async function loadScore(url) {
    if (!url || url === loadingUrl) return;
    loadingUrl = url;
    status("Rendering the score…", true);
    var stage = document.getElementById("stage");
    var OSMD = window.opensheetmusicdisplay && window.opensheetmusicdisplay.OpenSheetMusicDisplay;
    if (!OSMD || !stage) {
      post({ type: "error", message: "The score engine is missing from this copy." });
      status("The score engine is missing.", true);
      return;
    }
    try {
      var response = await fetch(url);
      if (!response.ok) throw new Error("MusicXML " + response.status);
      var xml = await response.text();
      stage.innerHTML = "";
      osmd = new OSMD(stage, {
        autoResize: false,
        backend: "svg",
        drawTitle: true,
        drawSubtitle: false,
        drawComposer: true,
        drawLyricist: false,
        drawMeasureNumbers: true,
        drawMeasureNumbersOnlyAtSystemStart: true,
        followCursor: false,
        disableCursor: false,
        drawingParameters: "compacttight",
        pageFormat: "A4_P",
        newSystemFromXML: true,
        newPageFromXML: true,
        stretchLastSystemLine: true,
        cursorsOptions: [{ type: 0, color: "#38bdf8", alpha: 0.45, follow: false }],
      });
      setRule("PageBackgroundColor", "#fffcf2");
      setRule("RenderXMeasuresPerLineAkaSystem", 0);
      setRule("PageTopMargin", 8);
      setRule("PageLeftMargin", 6);
      setRule("PageRightMargin", 6);
      await osmd.load(xml);
      var sheetBpm = (osmd.Sheet && (osmd.Sheet.userStartTempoInBPM || osmd.Sheet.DefaultStartTempoInBpm)) || state.bpm || 120;
      state.bpm = sheetBpm > 0 ? sheetBpm : 120;
      osmd.zoom = 1;
      osmd.render();
      showPage(1);
      applyScale();
      var timeline = collect(state.bpm);
      try {
        osmd.cursor.show();
      } catch (err) {
        /* show after the first transport message */
      }
      paintCursor();
      status("", false);
      post({
        type: "loaded",
        protocolVersion: PROTOCOL,
        bpm: state.bpm,
        measures: timeline.measures,
        steps: timeline.steps,
      });
      place(state.seconds || 0);
    } catch (err) {
      loadingUrl = "";
      var message = err && err.message ? err.message : "The score could not be rendered.";
      status(message, true);
      post({ type: "error", message: message });
    }
  }

  function onHost(raw) {
    var message = raw;
    if (typeof message === "string") {
      try {
        message = JSON.parse(message);
      } catch (err) {
        return;
      }
    }
    if (!message || typeof message !== "object") return;
    if (message.type === "load" && message.musicXmlUrl) {
      void loadScore(message.musicXmlUrl);
      return;
    }
    if (message.type === "transport") {
      if (typeof message.bpm === "number" && message.bpm > 0) state.bpm = message.bpm;
      state.playing = Boolean(message.playing);
      state.waitMode = Boolean(message.waitMode);
      state.seconds = typeof message.seconds === "number" ? message.seconds : state.seconds;
      applyScale();
      if (osmd) place(state.seconds);
      return;
    }
    if (message.type === "viewport") {
      state.orientation = message.orientation === "landscape" ? "landscape" : "portrait";
      state.device = message.device === "tablet" ? "tablet" : "phone";
      state.playing = Boolean(message.playing);
      applyScale();
      if (osmd && state.playing) follow();
    }
  }

  var scroller = document.getElementById("scroller");
  var pinch = null;
  function distance(event) {
    var a = event.touches[0];
    var b = event.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  if (scroller) {
    scroller.addEventListener(
      "touchstart",
      function (event) {
        if (state.playing || event.touches.length !== 2) return;
        pinch = { dist: distance(event), zoom: state.userZoom };
      },
      { passive: true },
    );
    scroller.addEventListener(
      "touchmove",
      function (event) {
        if (!pinch || state.playing || event.touches.length !== 2) return;
        event.preventDefault();
        var next = pinch.zoom * (distance(event) / pinch.dist);
        state.userZoom = Math.min(2.6, Math.max(0.7, next));
        applyScale();
      },
      { passive: false },
    );
    scroller.addEventListener("touchend", function () {
      pinch = null;
    });
  }

  window.addEventListener("message", function (event) {
    onHost(event.data);
  });
  document.addEventListener("message", function (event) {
    onHost(event.data);
  });
  (window.__d8rQueue || []).forEach(onHost);
  window.__d8rQueue = [];
  post({ type: "ready", protocolVersion: PROTOCOL });
})();
