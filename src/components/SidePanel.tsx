import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import type { PieceSummary } from "../api/types";
import { readDiagnostics } from "../lib/diagnostics";
import type { PitchReading } from "../pitch/usePitch";
import { STUDIO_VIEWS, type StudioView } from "../lib/studioView";

import { fonts, light, studioNav } from "../theme";

function DiagnosticsRow() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  async function show() {
    setText("Reading…");
    setOpen(true);
    const log = await readDiagnostics();
    setText(log || "No diagnostics yet.");
  }

  async function copy() {
    const message = text.trim() || "No diagnostics yet.";
    try {
      await Share.share({ message });
    } catch {
      // The field stays selectable if the share sheet is dismissed.
    }
  }

  return (
    <>
      <Pressable style={styles.row} onPress={() => void show()}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Diagnostics</Text>
          <Text style={styles.help}>Play-start errors and native exceptions. Copy from here after a crash.</Text>
        </View>
        <Text style={styles.rowValue}>Log</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.logScreen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.logHead}>
            <Text style={styles.title}>Diagnostics</Text>
            <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityLabel="Close diagnostics">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            multiline
            editable={false}
            selectTextOnFocus
            value={text}
            style={styles.logBody}
          />
          <Pressable style={styles.copy} onPress={() => void copy()}>
            <Text style={styles.copyText}>Copy</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function Toggle({
  title,
  detail,
  on,
  tone,
  onPress,
}: {
  title: string;
  detail: string;
  on: boolean;
  tone: "sky" | "green" | "indigo";
  onPress: () => void;
}) {
  const active = tone === "green" ? "#059669" : tone === "indigo" ? "#4f46e5" : "#0284c7";
  return (
    <Pressable onPress={onPress} style={[styles.toggle, on && { backgroundColor: active, borderColor: active }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, on && styles.onText]}>{title}</Text>
        <Text style={[styles.toggleDetail, on && styles.onText]}>{detail}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: on ? "#fff" : tone === "green" ? "#34d399" : tone === "indigo" ? "#6366f1" : "#38bdf8" }]} />
    </Pressable>
  );
}

export function SidePanel({
  title,
  composer,
  playMode,
  waitMode,
  bpm,
  backingLabels,
  backingIndex,
  viewMode,
  onViewMode,
  micOn,
  zoom,
  sensitivity,
  tablet,
  pitch,
  midiOn,
  midiConnected,
  midiName,
  pdfEnabled,
  pro,
  showRight,
  showLeft,
  others,
  onPlayMode,
  onWait,
  onTempo,
  onBacking,
  onMic,
  onZoom,
  onSensitivity,
  onMidi,
  onPdf,
  onPiece,
  onRight,
  onLeft,
  onClose,
}: {
  title: string;
  composer: string | null;
  playMode: boolean;
  waitMode: boolean;
  bpm: number;
  backingLabels: string[];
  backingIndex: number;
  viewMode: StudioView;
  onViewMode: (mode: StudioView) => void;
  micOn: boolean;
  zoom: number;
  sensitivity: number;
  tablet: boolean;
  pitch: PitchReading;
  midiOn: boolean;
  midiConnected: boolean;
  midiName: string | null;
  pdfEnabled: boolean;
  pro: boolean;
  showRight: boolean;
  showLeft: boolean;
  others: PieceSummary[];
  onPlayMode: () => void;
  onWait: () => void;
  onTempo: () => void;
  onBacking: (index: number) => void;
  onMic: () => void;
  onZoom: (value: number) => void;
  onSensitivity: (value: number) => void;
  onMidi: () => void;
  onPdf: () => void;
  onPiece: (piece: PieceSummary) => void;
  onRight: () => void;
  onLeft: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [zoomLabel, setZoomLabel] = useState(zoom);
  const [sensLabel, setSensLabel] = useState(sensitivity);
  useEffect(() => setZoomLabel(zoom), [zoom]);
  useEffect(() => setSensLabel(sensitivity), [sensitivity]);
  return (
    <View style={styles.panel}>
      <View style={[styles.head, { paddingTop: insets.top }]}>
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.composer} numberOfLines={1}>{composer || "Piano"}</Text>
        </View>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close studio panel">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.sliderBlock}>
          <Text style={styles.section}>View</Text>
          <View style={styles.modes}>
            {STUDIO_VIEWS.map((item) => {
              const selected = viewMode === item.id;
              return (
                <Pressable key={item.id} onPress={() => onViewMode(item.id)} style={[styles.mode, selected && styles.modeOn]}>
                  <Text style={[styles.modeText, selected && styles.onText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={styles.section}>Play mode</Text>
        <Toggle title="Play mode" detail="The backing track plays. Sample piano notes stay off." on={playMode} tone="sky" onPress={onPlayMode} />
        <Toggle title="Wait to play" detail="The piece holds until you play one of the green notes." on={waitMode} tone="green" onPress={onWait} />
        <Text style={styles.section}>Keyboard tracks</Text>
        <Toggle title="Right hand" detail="First MIDI channel, shown in sky on the keyboard." on={showRight} tone="sky" onPress={onRight} />
        <Toggle title="Left hand" detail="Second MIDI channel, shown in indigo on the keyboard." on={showLeft} tone="indigo" onPress={onLeft} />
        <View style={styles.sliderBlock}>
          <View style={styles.sliderHead}>
            <Text style={styles.section}>Score zoom</Text>
            <Text style={styles.rowValue}>{Math.round(zoomLabel * 100)}%</Text>
          </View>
          <Slider
            minimumValue={0.5}
            maximumValue={3}
            step={0.05}
            value={zoomLabel}
            minimumTrackTintColor="#0284c7"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#0284c7"
            onValueChange={setZoomLabel}
            onSlidingComplete={onZoom}
          />
        </View>
        <Pressable style={styles.row} onPress={onTempo}>
          <Text style={styles.rowLabel}>Tempo</Text>
          <Text style={styles.rowValue}>{bpm} BPM</Text>
        </Pressable>
        <Text style={styles.section}>Backing track</Text>
        <View style={styles.choices}>
          {["None", ...backingLabels].map((label, index) => {
            const selected = backingIndex === index - 1;
            return (
              <Pressable key={label + index} onPress={() => onBacking(index - 1)} style={[styles.choice, selected && styles.choiceOn]}>
                <Text style={[styles.choiceText, selected && styles.onText]} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Toggle
          title="Acoustic piano"
          detail={pitch.message || (micOn ? (pitch.liveHz ? `Microphone · ${Math.round(pitch.liveHz)} Hz` : "Microphone is listening for written notes.") : "Microphone stays off until this is on.")}
          on={micOn}
          tone="green"
          onPress={onMic}
        />
        {micOn ? (
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHead}>
              <Text style={styles.section}>Mic sensitivity</Text>
              <Text style={styles.rowValue}>{Math.round(sensLabel * 100)}</Text>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={sensLabel}
              minimumTrackTintColor="#059669"
              maximumTrackTintColor="#e2e8f0"
              thumbTintColor="#059669"
              onValueChange={setSensLabel}
              onSlidingComplete={onSensitivity}
            />
            <Text style={styles.help}>
              {tablet ? "iPad starts higher, because the microphone barely hears the piano." : "Raise this if the piano is quiet. Lower it if the room is noisy."}
            </Text>
          </View>
        ) : null}
        <Toggle
          title="MIDI keyboard"
          detail={midiOn && midiConnected && midiName ? `Connected · ${midiName}` : "Not connected"}
          on={midiOn}
          tone="sky"
          onPress={onMidi}
        />
        <DiagnosticsRow />
        <Pressable style={[styles.row, !pdfEnabled && styles.disabled]} onPress={onPdf} disabled={!pdfEnabled}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>PDF download</Text>
            <Text style={styles.help}>{pro ? "Save or share the score." : "Pro only."}</Text>
          </View>
          <Text style={styles.rowValue}>{pro ? "PDF" : "Pro"}</Text>
        </Pressable>
        {others.length ? (
          <>
            <Text style={styles.section}>Other pieces</Text>
            {others.map((piece) => (
              <Pressable key={piece.id} style={styles.piece} onPress={() => onPiece(piece)}>
                <Text style={styles.pieceTitle} numberOfLines={1}>{piece.title}</Text>
                <Text style={styles.help} numberOfLines={1}>
                  {piece.composer || "Piano"}
                  {piece.isPremium ? " · Pro" : ""}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: light.bg },
  head: {
    paddingHorizontal: studioNav.padH,
    paddingBottom: studioNav.padB,
    backgroundColor: studioNav.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headText: { flex: 1, justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: studioNav.title },
  composer: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: studioNav.muted },
  close: {
    width: studioNav.icon,
    height: studioNav.icon,
    borderRadius: studioNav.icon / 2,
    borderWidth: 1,
    borderColor: studioNav.buttonEdge,
    backgroundColor: studioNav.button,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontFamily: fonts.bold, color: studioNav.title, fontSize: 16, marginTop: -1 },
  body: { padding: 16, gap: 10, paddingBottom: 32 },
  toggle: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: light.ink },
  toggleDetail: { fontFamily: fonts.regular, fontSize: 12, color: light.muted, marginTop: 2 },
  onText: { color: "#fff" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontFamily: fonts.bold, color: light.ink, fontSize: 14 },
  rowValue: { fontFamily: fonts.bold, color: light.sky, fontSize: 14 },
  section: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: light.muted, textTransform: "uppercase", marginTop: 4 },
  modes: { flexDirection: "row", gap: 6 },
  mode: { flex: 1, height: 36, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  modeText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "#64748b" },
  choices: { gap: 6 },
  choice: { borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  choiceOn: { backgroundColor: "#059669", borderColor: "#059669" },
  choiceText: { fontFamily: fonts.semibold, color: "#065f46" },
  sliderBlock: { gap: 2 },
  sliderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  help: { fontFamily: fonts.regular, color: light.muted, fontSize: 12, lineHeight: 16 },
  disabled: { opacity: 0.45 },
  piece: { borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  pieceTitle: { fontFamily: fonts.bold, color: light.ink, fontSize: 14 },
  logScreen: { flex: 1, backgroundColor: light.bg, paddingHorizontal: 16, gap: 12 },
  logHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logBody: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 12, fontFamily: fonts.regular, fontSize: 12, color: light.ink, textAlignVertical: "top" },
  copy: { height: 44, borderRadius: 14, backgroundColor: "#0284c7", alignItems: "center", justifyContent: "center" },
  copyText: { fontFamily: fonts.bold, color: "#fff", fontSize: 14 },
});
