import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import Slider from "@react-native-community/slider";
import * as Network from "expo-network";
import { ApiError, downloadPiecePdf, fetchCollection, fetchPiece } from "../api/client";
import { cachePath, cachePiece, readPieceMeta, type CachedPiece } from "../api/cache";
import type { PieceDetail, PieceSummary } from "../api/types";
import { KeyboardDock } from "./KeyboardDock";
import { Paywall } from "./Paywall";
import { SidePanel } from "./SidePanel";
import { TempoModal } from "./TempoModal";
import { useMidi } from "../midi/useMidi";
import { flattenSteps, type LoadedScore } from "../lib/protocol";
import { matchAnyExpected, type TimedNote } from "../lib/notes";
import { clampTempo } from "../lib/tempo";
import { usePlayback } from "../playback/usePlayback";
import { usePitch } from "../pitch/usePitch";
import { usePitchSensitivity } from "../pitch/sensitivity";
import { usePurchases } from "../purchases";
import { setAudioSession } from "../audio/session";
import { config } from "../config";
import { ScoreWebView } from "../score/ScoreWebView";
import { TABLET_MIN, fonts, light } from "../theme";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function PieceScreen({ id, collection }: { id: string; collection?: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= TABLET_MIN;
  const landscape = width > height;
  const dockPanel = tablet && landscape;
  const { pro, appUserId } = usePurchases();
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [cached, setCached] = useState<CachedPiece | null>(null);
  const [others, setOthers] = useState<PieceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [panel, setPanel] = useState(dockPanel);
  const [playMode, setPlayMode] = useState(true);
  const [waitMode, setWaitMode] = useState(false);
  const [selectedBpm, setSelectedBpm] = useState(120);
  const [backingIndex, setBackingIndex] = useState(-1);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [score, setScore] = useState<LoadedScore | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [sensitivity, setSensitivity] = usePitchSensitivity(tablet);

  useEffect(() => {
    setPanel(dockPanel);
  }, [dockPanel]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setScore(null);
      const state = await Network.getNetworkStateAsync().catch(() => null);
      const online = state ? state.isConnected !== false && state.isInternetReachable !== false : true;
      if (!cancel) setOffline(!online);
      try {
        const detail = await fetchPiece(id);
        if (cancel) return;
        setPiece(detail);
        setSelectedBpm(detail.tempo || 120);
        const orchestra = detail.mp3Files.findIndex((file) => !/piano/i.test(file.label));
        setBackingIndex(orchestra);
        const files = await cachePiece(detail);
        if (!cancel) setCached(files);
        if (collection) {
          const group = await fetchCollection(collection).catch(() => null);
          if (group && !cancel) {
            setOthers(group.pieces.filter((item) => item.id !== detail.id && item.slug !== detail.slug));
          }
        }
      } catch (err) {
        const saved = await readPieceMeta(id);
        if (saved && !cancel) {
          setPiece(saved);
          setSelectedBpm(saved.tempo || 120);
          setCached(await cachePiece(saved));
          setOffline(true);
        } else if (!cancel) {
          setError(err instanceof ApiError ? err.message : "This score could not be opened.");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [collection, id]);

  const pieceBpm = score?.bpm || piece?.tempo || 120;
  const stepNotes = useMemo(() => (score ? flattenSteps(score.steps) : []), [score]);
  const notes: TimedNote[] = stepNotes.length ? stepNotes : cached?.midiNotes ?? [];
  const duration = Math.max(
    score?.steps.reduce((max, step) => Math.max(max, step.seconds + step.durationSeconds), 0) ?? 0,
    cached?.midiDuration ?? 0,
  );
  const backingFile = backingIndex >= 0 ? cached?.mp3[backingIndex] : null;
  const backing = backingFile ? { uri: backingFile.localUri || backingFile.remoteUrl, bpm: backingFile.bpm } : null;
  const gated = Boolean(piece?.isPremium) && !pro;

  const playback = usePlayback({
    notes,
    pieceBpm,
    duration,
    timeSignature: piece?.timeSignature ?? null,
    backing,
    playMode,
    waitMode,
    selectedBpm: clampTempo(pieceBpm, selectedBpm),
    gated,
    onPaywall: () => setPaywall(true),
  });

  const pitch = usePitch(micOn, sensitivity);
  const onNoteRef = useRef(playback.onNote);
  onNoteRef.current = playback.onNote;
  const midi = useMidi((note, down) => {
    if (down) onNoteRef.current(note, "midi");
  });
  const micAt = useRef(0);

  useEffect(() => {
    if (!micOn || !waitMode || !playback.playing) return;
    const hit = matchAnyExpected(pitch.liveHz, playback.waiting);
    if (hit == null) return;
    const now = Date.now();
    if (now - micAt.current < 450) return;
    micAt.current = now;
    onNoteRef.current(hit, "mic");
  }, [micOn, pitch.liveHz, playback.playing, playback.waiting, waitMode]);

  useEffect(() => {
    if (!micOn) void setAudioSession("playback");
  }, [micOn]);

  useEffect(() => {
    if (!seeking) setSeekValue(playback.scoreTime);
  }, [playback.scoreTime, seeking]);

  async function onPdf() {
    if (!piece) return;
    setPdfError(null);
    if (!pro) {
      setPaywall(true);
      return;
    }
    try {
      const destination = cachePath(piece.id, "pdf", piece.pdfUrl || piece.id);
      const uri = await downloadPiecePdf(piece.id, appUserId, destination.endsWith(".pdf") ? destination : `${destination}.pdf`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "The PDF could not be downloaded.");
    }
  }

  if (loading && !piece) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={light.sky} />
      </View>
    );
  }
  if (!piece) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "This score is not available."}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const shownBpm = clampTempo(pieceBpm, selectedBpm);
  const panelNode = (
    <SidePanel
      title={piece.title}
      composer={piece.composer}
      playMode={playMode}
      waitMode={waitMode}
      bpm={shownBpm}
      backingLabels={piece.mp3Files.map((file) => file.label)}
      backingIndex={backingIndex}
      micOn={micOn}
      sensitivity={sensitivity}
      tablet={tablet}
      pitch={pitch}
      midiPorts={midi.ports}
      midiError={midi.error}
      midiReady={midi.ready}
      pdfEnabled={piece.hasPdf}
      pro={pro}
      others={others}
      onPlayMode={() => setPlayMode((value) => !value)}
      onWait={() => setWaitMode((value) => !value)}
      onTempo={() => setTempoOpen(true)}
      onBacking={setBackingIndex}
      onMic={() => setMicOn((value) => !value)}
      onSensitivity={setSensitivity}
      onMidi={() => void midi.connect()}
      onPdf={() => void onPdf()}
      onPiece={(next) => router.replace({ pathname: "/piece/[id]", params: { id: next.slug || next.id, collection: collection ?? "" } })}
      onClose={dockPanel ? undefined : () => setPanel(false)}
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn} accessibilityLabel="Back to the library">
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{piece.title}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {piece.composer || "Piano"}
            {piece.isPremium && !pro ? ` · ${config.previewSeconds}s preview` : ""}
            {offline ? " · Saved on device" : ""}
          </Text>
        </View>
        {!dockPanel ? (
          <Pressable onPress={() => setPanel(true)} style={styles.iconBtn} accessibilityLabel="Open studio panel">
            <Text style={styles.iconText}>☰</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, flexDirection: dockPanel ? "row" : "column" }}>
        <View style={{ flex: 1 }}>
          <ScoreWebView
            pieceId={piece.id}
            remoteXmlUrl={piece.musicXmlUrl}
            xmlText={cached?.xmlText ?? null}
            offline={offline}
            scoreTime={playback.scoreTime}
            bpm={pieceBpm}
            playing={playback.playing}
            waitMode={waitMode}
            orientation={landscape ? "landscape" : "portrait"}
            device={tablet ? "tablet" : "phone"}
            onLoaded={setScore}
          />
          <View style={styles.seek}>
            <Pressable onPress={playback.toggle} style={[styles.play, playback.playing && styles.playOn]} accessibilityLabel={playback.playing ? "Pause" : "Play"}>
              <Text style={styles.playText}>{playback.countdown ?? (playback.playing ? "II" : "▶")}</Text>
            </Pressable>
            <Text style={styles.time}>{formatTime(seeking ? seekValue : playback.scoreTime)}</Text>
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={Math.max(1, duration)}
              value={seeking ? seekValue : playback.scoreTime}
              minimumTrackTintColor="#0284c7"
              maximumTrackTintColor="#d6d3c9"
              thumbTintColor="#0284c7"
              onSlidingStart={() => setSeeking(true)}
              onValueChange={setSeekValue}
              onSlidingComplete={(value) => {
                setSeeking(false);
                playback.seek(value, playback.playing);
              }}
            />
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
          {pdfError ? <Text style={styles.pdfError}>{pdfError}</Text> : null}
          {playback.ended ? <Text style={styles.ended}>End of the piece</Text> : null}
          <KeyboardDock
            notes={notes}
            scoreTime={playback.scoreTime}
            active={playback.active}
            waiting={playback.waiting}
            success={playback.success}
            wrong={playback.wrong}
            tablet={tablet}
            landscape={landscape}
            onKey={(note) => playback.onNote(note, "key")}
          />
        </View>
        {dockPanel ? <View style={{ width: 340, borderLeftWidth: 1, borderLeftColor: "#e7e0d2" }}>{panelNode}</View> : null}
      </View>
      {panel && !dockPanel ? (
        <View style={[styles.overlay, { top: insets.top + 56 }]}>
          <Pressable style={styles.dismiss} onPress={() => setPanel(false)} />
          <View style={styles.sheet}>{panelNode}</View>
        </View>
      ) : null}
      <TempoModal visible={tempoOpen} pieceBpm={pieceBpm} bpm={shownBpm} onChange={setSelectedBpm} onClose={() => setTempoOpen(false)} />
      {paywall ? <Paywall onClose={() => setPaywall(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: light.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: light.bg, padding: 24, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  headerTitle: { fontFamily: fonts.bold, color: light.ink, fontSize: 16 },
  headerSub: { fontFamily: fonts.medium, color: light.muted, fontSize: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e0d2", alignItems: "center", justifyContent: "center" },
  iconText: { fontFamily: fonts.bold, fontSize: 20, color: light.ink, marginTop: -2 },
  seek: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: light.bg },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0284c7", alignItems: "center", justifyContent: "center" },
  playOn: { backgroundColor: "#0f172a" },
  playText: { fontFamily: fonts.bold, color: "#fff", fontSize: 14 },
  time: { fontFamily: fonts.medium, color: light.muted, fontSize: 12, width: 36 },
  pdfError: { fontFamily: fonts.medium, color: "#be123c", paddingHorizontal: 12, paddingBottom: 4 },
  ended: { fontFamily: fonts.bold, color: light.sky, textAlign: "center", paddingBottom: 4 },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  dismiss: { flex: 1, backgroundColor: "rgba(15,23,42,0.28)" },
  sheet: { width: "86%", maxWidth: 420, backgroundColor: light.bg },
  error: { fontFamily: fonts.medium, color: light.ink, textAlign: "center" },
  backBtn: { backgroundColor: light.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontFamily: fonts.bold, color: "#fff" },
});
