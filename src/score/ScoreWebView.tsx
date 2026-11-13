import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { config, embedPageUrl } from "../config";
import {
  PROTOCOL_VERSION,
  parseEmbedEvent,
  protocolCompatible,
  type EmbedCommand,
  type EmbedLayoutName,
  type LoadedScore,
  type NoteTapped,
} from "../lib/protocol";
import { fonts, light } from "../theme";

type Mode = "hosted" | "bundled";

function dispatchScript(command: EmbedCommand) {
  const payload = JSON.stringify(command);
  return `window.dispatchEvent(new MessageEvent("message", { data: ${payload} })); true;`;
}

export function ScoreWebView({
  pieceId,
  remoteXmlUrl,
  xmlText,
  offline,
  scoreTime,
  bpm,
  timeSignature,
  keySignature,
  measuresPerSystem,
  playing,
  waitMode,
  layout,
  zoom,
  onLoaded,
  onNoteTapped,
}: {
  pieceId: string;
  remoteXmlUrl: string | null;
  xmlText: string | null;
  offline: boolean;
  scoreTime: number;
  bpm: number;
  timeSignature: string;
  keySignature: string;
  measuresPerSystem: number | null;
  playing: boolean;
  waitMode: boolean;
  layout: EmbedLayoutName;
  zoom: number;
  onLoaded: (score: LoadedScore) => void;
  onNoteTapped: (tap: NoteTapped) => void;
}) {
  const webRef = useRef<WebView>(null);
  const [mode, setMode] = useState<Mode>(offline ? "bundled" : "hosted");
  const [html, setHtml] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState(offline ? "Offline. Opening the saved score view." : "Opening the score…");
  const fellBack = useRef(offline);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onTapRef = useRef(onNoteTapped);
  onLoadedRef.current = onLoaded;
  onTapRef.current = onNoteTapped;
  const sentLoad = useRef<string | null>(null);
  const heardReady = useRef(false);

  const clearTimers = () => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    if (loadedTimer.current) clearTimeout(loadedTimer.current);
    readyTimer.current = null;
    loadedTimer.current = null;
  };

  const fallback = useCallback((message: string) => {
    if (fellBack.current) return;
    fellBack.current = true;
    clearTimers();
    sentLoad.current = null;
    heardReady.current = false;
    setNotice(message);
    setPhase("loading");
    setHtml(null);
    setMode("bundled");
  }, []);

  const send = useCallback((command: EmbedCommand) => {
    try {
      webRef.current?.injectJavaScript(dispatchScript(command));
    } catch {
      // The score view can be dismissed while a command is in flight.
    }
  }, []);

  const sendLoad = useCallback(() => {
    if (!heardReady.current || !webRef.current) return;
    const meta = {
      pieceId,
      bpm,
      timeSignature,
      keySignature,
      measuresPerSystem,
    };
    if (remoteXmlUrl && !offline) {
      const key = `url:${remoteXmlUrl}`;
      if (sentLoad.current === key) return;
      sentLoad.current = key;
      send({ type: "load", musicXmlUrl: remoteXmlUrl, ...meta });
      return;
    }
    if (!xmlText) return;
    const key = `xml:${xmlText.length}:${pieceId}`;
    if (sentLoad.current === key) return;
    sentLoad.current = key;
    const command = JSON.stringify({ type: "load", ...meta });
    try {
    webRef.current.injectJavaScript(`
      (function () {
        var xml = ${JSON.stringify(xmlText)};
        var url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
        var command = ${command};
        command.musicXmlUrl = url;
        window.dispatchEvent(new MessageEvent("message", { data: command }));
      })();
      true;
    `);
    } catch {
      // The offline score view was not ready.
    }
  }, [bpm, keySignature, measuresPerSystem, offline, pieceId, remoteXmlUrl, send, timeSignature, xmlText]);

  useEffect(() => {
    fellBack.current = offline;
    sentLoad.current = null;
    heardReady.current = false;
    setPhase("loading");
    setHtml(null);
    setMode(offline ? "bundled" : "hosted");
    setNotice(offline ? "Offline. Opening the saved score view." : "Opening the score…");
  }, [pieceId, offline]);

  useEffect(() => {
    if (mode !== "hosted") return;
    readyTimer.current = setTimeout(() => {
      fallback("The hosted score view did not respond. Using the copy saved in the app.");
    }, config.embedReadyTimeoutMs);
    return clearTimers;
  }, [mode, pieceId, fallback]);

  useEffect(() => {
    if (mode !== "bundled") return;
    let cancel = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(require("../../assets/academy-embed/index.html"));
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error("missing embed");
        const text = await FileSystem.readAsStringAsync(asset.localUri);
        if (!cancel) setHtml(text);
      } catch {
        if (!cancel) {
          setPhase("error");
          setNotice("The saved score view could not be opened.");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, pieceId]);

  useEffect(() => {
    if (!heardReady.current) return;
    send({ type: "setLayout", layout });
  }, [layout, send, phase]);

  useEffect(() => {
    if (!heardReady.current) return;
    send({ type: "setPlaybackActive", active: playing });
  }, [playing, send]);

  useEffect(() => {
    if (!heardReady.current) return;
    send({ type: "setZoom", zoom });
  }, [zoom, send]);

  useEffect(() => {
    if (!heardReady.current) return;
    send({ type: "cursor", time: scoreTime, color: waitMode ? "green" : "sky" });
  }, [scoreTime, send, waitMode]);

  useEffect(() => {
    sendLoad();
  }, [sendLoad]);

  function onMessage(event: WebViewMessageEvent) {
    const message = parseEmbedEvent(event.nativeEvent.data);
    if (!message) return;
    if (message.kind === "ready") {
      if (mode === "hosted" && !protocolCompatible(message.protocolVersion)) {
        fallback(`The hosted score speaks protocol ${String(message.protocolVersion)}. This app needs ${PROTOCOL_VERSION}, so it opened the built-in score.`);
        return;
      }
      if (readyTimer.current) clearTimeout(readyTimer.current);
      heardReady.current = true;
      send({ type: "setLayout", layout });
      send({ type: "setPlaybackActive", active: playing });
      send({ type: "setZoom", zoom });
      sendLoad();
      if (mode === "hosted" && !loadedTimer.current) {
        loadedTimer.current = setTimeout(() => {
          fallback("The hosted score did not finish loading. Using the copy saved in the app.");
        }, config.embedLoadedTimeoutMs);
      }
      return;
    }
    if (message.kind === "loaded") {
      if (loadedTimer.current) clearTimeout(loadedTimer.current);
      setPhase("ready");
      onLoadedRef.current(message.score);
      send({ type: "cursor", time: scoreTime, color: waitMode ? "green" : "sky" });
      return;
    }
    if (message.kind === "noteTapped") {
      onTapRef.current(message.tap);
      return;
    }
    if (message.kind === "error") {
      if (mode === "hosted") fallback(message.message);
      else {
        setPhase("error");
        setNotice(message.message);
      }
    }
  }

  const missingOffline = mode === "bundled" && !xmlText && (!remoteXmlUrl || offline);
  const source =
    mode === "hosted"
      ? { uri: embedPageUrl(pieceId) }
      : html
        ? { html, baseUrl: "https://danijelbrecelj.com" }
        : null;

  return (
    <View style={styles.wrap}>
      {source && !missingOffline ? (
        <WebView
          key={`${mode}-${pieceId}`}
          ref={webRef}
          source={source}
          onMessage={onMessage}
          onLoadEnd={() => {
            try {
              webRef.current?.injectJavaScript(dispatchScript({ type: "hello" }));
            } catch {
              fallback("The score page could not be reached.");
            }
          }}
          onError={() => fallback("The score page could not be reached.")}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 400) {
              fallback(`The hosted score returned ${event.nativeEvent.statusCode}. Using the copy saved in the app.`);
            }
          }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          style={styles.web}
        />
      ) : null}
      {phase !== "ready" ? (
        <View style={styles.overlay} pointerEvents="none">
          {phase === "error" || missingOffline ? (
            <Text style={styles.message}>
              {missingOffline ? "This score isn't on the device yet. Open it once while you're online." : notice}
            </Text>
          ) : (
            <>
              <ActivityIndicator color={light.sky} />
              <Text style={styles.message}>{notice}</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: light.stage },
  web: { flex: 1, backgroundColor: light.stage },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 28,
    backgroundColor: "rgba(255,252,242,0.9)",
  },
  message: {
    fontFamily: fonts.medium,
    color: light.ink,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },
});
