import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import type { PieceSummary } from "../api/types";
import type { MidiPort } from "../midi/useMidi";
import type { PitchReading } from "../pitch/usePitch";
import { fonts, light } from "../theme";

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
  tone: "sky" | "green";
  onPress: () => void;
}) {
  const active = tone === "green" ? "#059669" : "#0284c7";
  return (
    <Pressable onPress={onPress} style={[styles.toggle, on && { backgroundColor: active, borderColor: active }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, on && styles.onText]}>{title}</Text>
        <Text style={[styles.toggleDetail, on && styles.onText]}>{detail}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: on ? "#fff" : tone === "green" ? "#34d399" : "#38bdf8" }]} />
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
  micOn,
  sensitivity,
  tablet,
  pitch,
  midiPorts,
  midiError,
  midiReady,
  pdfEnabled,
  pro,
  others,
  onPlayMode,
  onWait,
  onTempo,
  onBacking,
  onMic,
  onSensitivity,
  onMidi,
  onPdf,
  onPiece,
  onClose,
}: {
  title: string;
  composer: string | null;
  playMode: boolean;
  waitMode: boolean;
  bpm: number;
  backingLabels: string[];
  backingIndex: number;
  micOn: boolean;
  sensitivity: number;
  tablet: boolean;
  pitch: PitchReading;
  midiPorts: MidiPort[];
  midiError: string | null;
  midiReady: boolean;
  pdfEnabled: boolean;
  pro: boolean;
  others: PieceSummary[];
  onPlayMode: () => void;
  onWait: () => void;
  onTempo: () => void;
  onBacking: (index: number) => void;
  onMic: () => void;
  onSensitivity: (value: number) => void;
  onMidi: () => void;
  onPdf: () => void;
  onPiece: (piece: PieceSummary) => void;
  onClose?: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>D8R PIANO ACADEMY</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.composer} numberOfLines={1}>{composer || "Piano"}</Text>
        </View>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close studio panel">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Toggle title="Play mode" detail="The app plays the written piano part." on={playMode} tone="sky" onPress={onPlayMode} />
        <Toggle title="Wait to play" detail="The piece holds until you play one of the green notes." on={waitMode} tone="green" onPress={onWait} />
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
          title="Mic pitch tracker"
          detail={pitch.message || (micOn ? (pitch.liveHz ? `${Math.round(pitch.liveHz)} Hz` : "Listening for any written note.") : "Use an acoustic piano for Wait to play.")}
          on={micOn}
          tone="green"
          onPress={onMic}
        />
        <View style={styles.sliderBlock}>
          <View style={styles.sliderHead}>
            <Text style={styles.section}>Mic sensitivity</Text>
            <Text style={styles.rowValue}>{Math.round(sensitivity * 100)}</Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={sensitivity}
            minimumTrackTintColor="#059669"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#059669"
            onSlidingComplete={onSensitivity}
          />
          <Text style={styles.help}>
            {tablet ? "iPad starts higher, because the microphone barely hears the piano." : "Raise this if the piano is quiet. Lower it if the room is noisy."}
          </Text>
        </View>
        <Pressable style={styles.row} onPress={onMidi}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>MIDI keyboard</Text>
            <Text style={styles.help}>{midiError || (midiPorts.length ? midiPorts.map((port) => port.name).join(", ") : midiReady ? "Connected, waiting for a keyboard." : "USB keyboards via CoreMIDI.")}</Text>
          </View>
          <Text style={styles.rowValue}>{midiPorts.length ? "On" : "Connect"}</Text>
        </Pressable>
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
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e7e0d2", flexDirection: "row", gap: 8 },
  kicker: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.6, color: light.sky },
  title: { fontFamily: fonts.bold, fontSize: 18, color: light.ink, marginTop: 4 },
  composer: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6, color: light.muted, textTransform: "uppercase", marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  closeText: { fontFamily: fonts.bold, color: light.muted },
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
});
