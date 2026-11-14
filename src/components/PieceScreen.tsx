import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import Slider from "@react-native-community/slider";
import * as Network from "expo-network";
import { ApiError, fetchCollection, fetchPdfUrl, fetchPiece } from "../api/client";
import { cachePath, cachePiece, readPieceMeta, type CachedPiece } from "../api/cache";
import type { PieceDetail, PieceSummary } from "../api/types";
import { KeyboardDock } from "./KeyboardDock";
import { Paywall } from "./Paywall";
import { SidePanel } from "./SidePanel";
import { TempoModal } from "./TempoModal";
import { useMidiController } from "../hooks/useMidiController";
import { recordDiagnostic } from "../lib/diagnostics";
import { notesFromEmbed, type EmbedLayoutName, type LoadedScore } from "../lib/protocol";
import { matchAnyExpected, soundingNotes, type TimedNote } from "../lib/notes";
import { clampTempo } from "../lib/tempo";
import { usePlayback } from "../playback/usePlayback";
import { usePitch } from "../pitch/usePitch";
import { usePitchSensitivity } from "../pitch/sensitivity";
import { usePurchases } from "../purchases";
import { setAudioSession } from "../audio/session";
import { showsKeyboard, showsScore } from "../lib/studioView";
import { ACOUSTIC_MIC_KEY, MIDI_TOGGLE_KEY, usePersistedBoolean, usePersistedStudioView } from "../lib/studioPrefs";
import { config } from "../config";
import * as FileSystem from "expo-file-system/legacy";
import { ScoreWebView } from "../score/ScoreWebView";
import { TABLET_MIN, fonts, light, studioNav } from "../theme";

function groupBacking(files: { label: string; bpm: number | null; url: string }[]) {
  const groups: { label: string; files: { label: string; bpm: number | null; url: string }[] }[] = [];
  for (const file of files) {
    const found = groups.find((group) => group.label === file.label);
    if (found) found.files.push(file);
    else groups.push({ label: file.label, files: [file] });
  }
  return groups;
}

function pickBacking(
  group: { files: { label: string; bpm: number | null; url: string }[] } | undefined,
  targetBpm: number,
) {
  if (!group || group.files.length === 0) return null;
  const numeric = group.files.filter((file) => file.bpm != null && file.bpm > 0);
  const pool = numeric.length ? numeric : group.files;
  return pool.reduce((best, file) =>
    Math.abs((file.bpm ?? targetBpm) - targetBpm) < Math.abs((best.bpm ?? targetBpm) - targetBpm) ? file : best,
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function PlayMark({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <View style={styles.pauseMark}>
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </View>
    );
  }
  return <View style={styles.playMark} />;
}

export function PieceScreen({ id, collection }: { id: string; collection?: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= TABLET_MIN;
  const landscape = width > height;
  const { pro, appUserId } = usePurchases();
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [cached, setCached] = useState<CachedPiece | null>(null);
  const [others, setOthers] = useState<PieceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [panel, setPanel] = useState(false);
  const [playMode, setPlayMode] = useState(true);
  const waitMode = !playMode;
  const [zoom, setZoom] = useState(landscape ? 1.85 : 1);

  useEffect(() => {
    setZoom(landscape ? 1.85 : 1);
  }, [landscape]);

  const [showRight, setShowRight] = useState(true);
  const [showLeft, setShowLeft] = useState(true);
  const [resultOpen, setResultOpen] = useState(false);
  const [selectedBpm, setSelectedBpm] = useState(120);
  const [backingIndex, setBackingIndex] = useState(-1);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [score, setScore] = useState<LoadedScore | null>(null);
  const acoustic = usePersistedBoolean(ACOUSTIC_MIC_KEY, false);
  const midiToggle = usePersistedBoolean(MIDI_TOGGLE_KEY, false);
  const [viewMode, setViewMode] = usePersistedStudioView();
  const micOn = acoustic.hydrated && acoustic.value;
  const midiEnabled = midiToggle.hydrated && midiToggle.value;
  const [sensitivity, setSensitivity] = usePitchSensitivity(tablet);

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
        const orchestra = groupBacking(detail.mp3Files).findIndex((group) => !/piano/i.test(group.label));
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
  const stepNotes = useMemo(() => (score ? notesFromEmbed(score.notes) : []), [score]);
  const notes: TimedNote[] = stepNotes.length ? stepNotes : cached?.midiNotes ?? [];
  const duration = Math.max(
    score?.notes.reduce((max, note) => Math.max(max, note.seconds), 0) ?? 0,
    cached?.midiDuration ?? 0,
  );
  const groups = useMemo(() => groupBacking(piece?.mp3Files ?? []), [piece]);
  const chosen = pickBacking(groups[backingIndex], clampTempo(pieceBpm, selectedBpm));
  const cachedTrack = chosen ? cached?.mp3.find((file) => file.remoteUrl === chosen.url) : null;
  const backing = chosen ? { uri: cachedTrack?.localUri || chosen.url, bpm: chosen.bpm } : null;
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

  const midiNotes = cached?.midiNotes ?? [];
  const visibleNotes = useMemo<TimedNote[]>(() => {
    if (!midiNotes.length) return notes;
    return midiNotes
      .filter((node) => (node.track === 0 ? showRight : node.track === 1 ? showLeft : false))
      .map((node) => ({ time: node.time, duration: node.duration, note: node.note }));
  }, [midiNotes, notes, showLeft, showRight]);
  const visibleActive = useMemo(
    () => (playMode ? soundingNotes(visibleNotes, playback.scoreTime) : []),
    [playMode, visibleNotes, playback.scoreTime],
  );
  const visibleWaiting = playback.waiting.filter((midiNo) => visibleNotes.some((node) => node.note === midiNo));

  useEffect(() => {
    if (playback.ended) setResultOpen(true);
  }, [playback.ended]);

  const pitch = usePitch(micOn, sensitivity);
  const onNoteRef = useRef(playback.onNote);
  onNoteRef.current = playback.onNote;
  const onMidi = useCallback((event: { type: string; noteNumber: number }) => {
    if (event.type === "note-on") onNoteRef.current(event.noteNumber, "midi");
  }, []);
  const midi = useMidiController(midiEnabled, onMidi);
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

  const playEdge = useRef(false);
  useEffect(() => {
    const on = playback.playing || playback.countdown != null;
    if (on && !playEdge.current) {
      recordDiagnostic(
        "play",
        `start midi=${midiEnabled ? "on" : "off"} connected=${midi.isConnected ? "yes" : "no"} name=${midi.deviceName || "none"} mic=${micOn ? "on" : "off"} keep-awake=not-called haptics=not-called`,
      );
    }
    playEdge.current = on;
  }, [midi.deviceName, midi.isConnected, midiEnabled, micOn, playback.countdown, playback.playing]);

  useEffect(() => {
    if (!seeking) setSeekValue(playback.scoreTime);
  }, [playback.scoreTime, seeking]);

  async function onPdf() {
    if (!piece) return;
    setPdfError(null);
    if (piece.pdf.requiresPurchase && !pro) {
      setPaywall(true);
      return;
    }
    try {
      const pdfUrl = await fetchPdfUrl(piece.id, appUserId);
      const destination = cachePath(piece.id, "pdf", pdfUrl);
      const file = await FileSystem.downloadAsync(pdfUrl, destination.endsWith(".pdf") ? destination : `${destination}.pdf`);
      const uri = file.uri;
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
      zoom={zoom}
      bpm={shownBpm}
      backingLabels={groups.map((group) => group.label)}
      backingIndex={backingIndex}
      viewMode={viewMode}
      onViewMode={setViewMode}
      micOn={micOn}
      sensitivity={sensitivity}
      tablet={tablet}
      pitch={pitch}
      midiOn={midiEnabled}
      midiConnected={midi.isConnected}
      midiName={midi.isConnected ? midi.deviceName : null}
      pdfEnabled={piece.pdf.available}
      pro={pro}
      showRight={showRight}
      showLeft={showLeft}
      others={others}
      onPlayMode={() => {
        playback.stop();
        setPlayMode(true);
      }}
      onWait={() => {
        playback.stop();
        setPlayMode(false);
      }}
      onZoom={setZoom}
      onTempo={() => setTempoOpen(true)}
      onBacking={setBackingIndex}
      onMic={() => acoustic.setValue(!acoustic.value)}
      onSensitivity={setSensitivity}
      onRight={() => setShowRight((value) => !value)}
      onLeft={() => setShowLeft((value) => !value)}
      onMidi={() => midiToggle.setValue(!midiToggle.value)}
      onPdf={() => void onPdf()}
      onPiece={(next) => router.replace({ pathname: "/piece/[id]", params: { id: next.slug || next.id, collection: collection ?? "" } })}
      onClose={() => setPanel(false)}
    />
  );

  const counting = playback.countdown != null;
  const transportOn = playback.playing || counting;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
        <Pressable onPress={() => setPanel(true)} style={styles.iconBtn} accessibilityLabel="Open studio panel">
          <Text style={styles.iconText}>☰</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.stage}>
          <View
            pointerEvents={showsScore(viewMode) ? "auto" : "none"}
            style={showsScore(viewMode) ? styles.score : styles.scoreParked}
          >
            <ScoreWebView
              pieceId={piece.id}
              remoteXmlUrl={piece.musicXmlUrl}
              xmlText={cached?.xmlText ?? null}
              offline={offline}
              scoreTime={playback.scoreTime}
              bpm={pieceBpm}
              timeSignature={piece.timeSignature}
              keySignature={piece.keySignature}
              measuresPerSystem={piece.measuresPerSystem}
              playing={playback.playing}
              waitMode={waitMode}
              layout={(landscape ? (tablet ? "landscape-tablet" : "landscape-phone") : "portrait") satisfies EmbedLayoutName}
              zoom={zoom}
              onLoaded={setScore}
              onNoteTapped={(tap) => playback.seek(tap.time, playback.playing)}
            />
          </View>
          <View style={styles.seek}>
            <Pressable onPress={playback.toggle} style={styles.play} accessibilityLabel={transportOn ? "Pause" : "Play"}>
              <PlayMark playing={transportOn} />
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
          {showsKeyboard(viewMode) ? (
            <KeyboardDock
              notes={visibleNotes}
              scoreTime={playback.scoreTime}
              active={visibleActive}
              waiting={visibleWaiting}
              success={playback.success}
              wrong={playback.wrong}
              tablet={tablet}
              landscape={landscape}
              waterfall={!showsScore(viewMode)}
              waitMode={waitMode}
              onKey={(note) => playback.onNote(note, "key")}
            />
          ) : null}
        </View>
      </View>
      </View>
      {counting ? (
        <View pointerEvents="none" style={styles.countdown}>
          <Text style={[styles.countdownNum, { fontSize: Math.min(168, Math.round(width * 0.42)) }]}>{playback.countdown}</Text>
        </View>
      ) : null}
      {panel ? (
        <View style={styles.overlay}>
          <Pressable style={styles.dismiss} onPress={() => setPanel(false)} />
          <View style={styles.sheet}>{panelNode}</View>
        </View>
      ) : null}
      <Modal visible={resultOpen} transparent animationType="fade" onRequestClose={() => setResultOpen(false)}>
        <Pressable style={styles.resultScrim} onPress={() => setResultOpen(false)}>
          <Pressable style={styles.resultCard} onPress={() => undefined}>
            <Text style={styles.resultTitle}>Piece complete</Text>
            <Text style={styles.resultBody}>{playback.correctHits} of {notes.length} notes played correctly</Text>
            <Pressable style={styles.resultDone} onPress={() => setResultOpen(false)}>
              <Text style={styles.resultDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <TempoModal visible={tempoOpen} pieceBpm={pieceBpm} bpm={shownBpm} onChange={setSelectedBpm} onClose={() => setTempoOpen(false)} />
      {paywall ? <Paywall onClose={() => setPaywall(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: light.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: light.bg, padding: 24, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: studioNav.padH,
    paddingBottom: studioNav.padB,
    backgroundColor: studioNav.bg,
    zIndex: 8,
    elevation: 8,
  },
  headerTitle: { fontFamily: fonts.bold, color: studioNav.title, fontSize: 16, lineHeight: 20 },
  headerSub: { fontFamily: fonts.medium, color: studioNav.muted, fontSize: 12, lineHeight: 16 },
  iconBtn: {
    width: studioNav.icon,
    height: studioNav.icon,
    borderRadius: studioNav.icon / 2,
    backgroundColor: studioNav.button,
    borderWidth: 1,
    borderColor: studioNav.buttonEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontFamily: fonts.bold, fontSize: 20, color: studioNav.title, marginTop: -2 },
  stage: { flex: 1, overflow: "hidden" },
  score: { flex: 1, zIndex: 1 },
  scoreParked: { position: "absolute", width: "100%", height: 1, opacity: 0, overflow: "hidden", zIndex: 0 },
  seek: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: light.bg, zIndex: 6, elevation: 6 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  playMark: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#fff",
  },
  pauseMark: { flexDirection: "row", alignItems: "center", gap: 4 },
  pauseBar: { width: 4, height: 14, borderRadius: 1, backgroundColor: "#fff" },
  countdown: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNum: {
    fontFamily: fonts.bold,
    color: "#ff7a18",
    textShadowColor: "rgba(255,122,24,0.7)",
    textShadowRadius: 28,
    textShadowOffset: { width: 0, height: 0 },
  },
  time: { fontFamily: fonts.medium, color: light.muted, fontSize: 12, width: 36 },
  pdfError: { fontFamily: fonts.medium, color: "#be123c", paddingHorizontal: 12, paddingBottom: 4 },
  resultScrim: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  resultCard: { width: "100%", maxWidth: 380, borderRadius: 24, backgroundColor: light.white, padding: 20, gap: 10, alignItems: "center" },
  resultTitle: { fontFamily: fonts.bold, fontSize: 22, color: light.ink },
  resultBody: { fontFamily: fonts.regular, fontSize: 15, color: light.muted, textAlign: "center" },
  resultDone: { marginTop: 8, height: 46, borderRadius: 23, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  resultDoneText: { fontFamily: fonts.bold, color: "#fff" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "row", zIndex: 40, elevation: 40 },
  dismiss: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { width: "86%", maxWidth: 420, backgroundColor: light.bg },
  error: { fontFamily: fonts.medium, color: light.ink, textAlign: "center" },
  backBtn: { backgroundColor: light.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontFamily: fonts.bold, color: "#fff" },
});
