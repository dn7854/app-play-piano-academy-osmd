import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { config, embedPageUrl } from "../config";
import {
  PROTOCOL_VERSION,
  parseEmbedMessage,
  protocolCompatible,
  wholeFromSeconds,
  type LoadedScore,
  type ViewportMessage,
} from "../lib/protocol";
import { fonts, light } from "../theme";

type Mode = "hosted" | "bundled";

function xmlUrlFor(mode: Mode, remote: string | null, text: string | null) {
  if (mode === "hosted") return remote;
  if (text) return `data:application/xml;charset=utf-8,${encodeURIComponent(text)}`;
  return remote;
}

export function ScoreWebView({
  pieceId,
  remoteXmlUrl,
  xmlText,
  offline,
  scoreTime,
  bpm,
  playing,
  waitMode,
  orientation,
  device,
  onLoaded,
}: {
  pieceId: string;
  remoteXmlUrl: string | null;
  xmlText: string | null;
  offline: boolean;
  scoreTime: number;
  bpm: number;
  playing: boolean;
  waitMode: boolean;
  orientation: "portrait" | "landscape";
  device: "phone" | "tablet";
  onLoaded: (score: LoadedScore) => void;
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
  onLoadedRef.current = onLoaded;
  const sentLoad = useRef<string | null>(null);

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
    setNotice(message);
    setPhase("loading");
    setMode("bundled");
  }, []);

  useEffect(() => {
    fellBack.current = offline;
    sentLoad.current = null;
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

  const post = useCallback((message: object) => {
    webRef.current?.postMessage(JSON.stringify(message));
  }, []);

  const sendLoad = useCallback(() => {
    const musicXmlUrl = xmlUrlFor(mode, remoteXmlUrl, xmlText);
    if (!musicXmlUrl || !webRef.current) return;
    const key = `${mode}:${musicXmlUrl}`;
    if (sentLoad.current === key) return;
    sentLoad.current = key;
    post({ type: "load", musicXmlUrl });
  }, [mode, post, remoteXmlUrl, xmlText]);

  useEffect(() => {
    sendLoad();
  }, [sendLoad]);

  const sendTransport = useCallback(() => {
    const safeBpm = bpm > 0 ? bpm : 120;
    post({
      type: "transport",
      seconds: scoreTime,
      whole: wholeFromSeconds(scoreTime, safeBpm),
      bpm: safeBpm,
      playing,
      waitMode,
    });
  }, [bpm, playing, post, scoreTime, waitMode]);

  const sendViewport = useCallback(() => {
    const message: ViewportMessage = { type: "viewport", orientation, device, playing };
    post(message);
  }, [device, orientation, playing, post]);

  useEffect(() => {
    if (phase === "loading" && mode === "hosted") return;
    sendTransport();
  }, [sendTransport, phase, mode]);

  useEffect(() => {
    sendViewport();
  }, [sendViewport]);

  function onMessage(event: WebViewMessageEvent) {
    const message = parseEmbedMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.kind === "ready") {
      if (mode === "hosted" && !protocolCompatible(message.protocolVersion)) {
        fallback(`The hosted score speaks protocol ${String(message.protocolVersion)}. This app needs ${PROTOCOL_VERSION}, so it opened the built-in score.`);
        return;
      }
      if (readyTimer.current) clearTimeout(readyTimer.current);
      sendLoad();
      sendViewport();
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
      sendTransport();
      sendViewport();
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

  const missingOffline = mode === "bundled" && !xmlText && !remoteXmlUrl;
  const source =
    mode === "hosted"
      ? { uri: embedPageUrl(pieceId) }
      : html
        ? { html, baseUrl: "https://d8r-academy.local" }
        : null;

  return (
    <View style={styles.wrap}>
      {source && !missingOffline ? (
        <WebView
          key={`${mode}-${pieceId}`}
          ref={webRef}
          source={source}
          onMessage={onMessage}
          onError={() => fallback("The score page could not be reached.")}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 400) {
              fallback(`The hosted score returned ${event.nativeEvent.statusCode}. Using the copy saved in the app.`);
            }
          }}
          onLoadEnd={() => {
            if (mode === "bundled") sendLoad();
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
