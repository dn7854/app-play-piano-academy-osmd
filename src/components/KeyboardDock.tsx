import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { openingAnchor, type TimedNote } from "../lib/notes";
import { fonts } from "../theme";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SABER = 12;
const BLACK = new Set([1, 3, 6, 8, 10]);

function isBlack(midi: number) {
  return BLACK.has(((midi % 12) + 12) % 12);
}

export function keyboardMetrics(tablet: boolean, landscape: boolean) {
  if (landscape && !tablet) return { white: 32, black: 20, keyH: 100, blackH: 62, fallH: 84 };
  if (tablet) return { white: 42, black: 26, keyH: 156, blackH: 96, fallH: 120 };
  return { white: 34, black: 21, keyH: 128, blackH: 78, fallH: 108 };
}

function layoutKeys(whiteW: number, blackW: number) {
  const whites: { midi: number; x: number }[] = [];
  const blacks: { midi: number; x: number }[] = [];
  let x = 0;
  for (let midi = 21; midi <= 108; midi++) {
    if (isBlack(midi)) blacks.push({ midi, x: x - blackW / 2 });
    else {
      whites.push({ midi, x });
      x += whiteW;
    }
  }
  return { whites, blacks, width: x };
}

function xOf(layout: ReturnType<typeof layoutKeys>, midi: number, whiteW: number, blackW: number) {
  const black = layout.blacks.find((key) => key.midi === midi);
  if (black) return black.x;
  const white = layout.whites.find((key) => key.midi === midi);
  return white ? white.x : 0;
}

export function KeyboardDock({
  notes,
  scoreTime,
  active,
  waiting,
  success,
  wrong,
  tablet,
  landscape,
  waterfall,
  waitMode,
  onKey,
}: {
  notes: TimedNote[];
  scoreTime: number;
  active: number[];
  waiting: number[];
  success: number[];
  wrong: number[];
  tablet: boolean;
  landscape: boolean;
  waterfall: boolean;
  waitMode: boolean;
  onKey: (midi: number) => void;
}) {
  const metrics = keyboardMetrics(tablet, landscape);
  const layout = useMemo(() => layoutKeys(metrics.white, metrics.black), [metrics.white, metrics.black]);
  const scroller = useRef<ScrollView>(null);
  const centeredFor = useRef<TimedNote[] | null>(null);
  const [viewport, setViewport] = useState(0);
  const [lane, setLane] = useState(0);
  const [tapped, setTapped] = useState<number | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pixelsPerSecond = Math.max(lane * 0.85, 220);
  const lookAhead = lane > 0 ? lane / pixelsPerSecond : 1.2;

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  useEffect(() => {
    if (viewport <= 0 || centeredFor.current === notes) return;
    const anchor = openingAnchor(notes);
    if (anchor == null) return;
    centeredFor.current = notes;
    const x = xOf(layout, anchor, metrics.white, metrics.black);
    const keyW = isBlack(anchor) ? metrics.black : metrics.white;
    scroller.current?.scrollTo({ x: Math.max(0, x + keyW / 2 - viewport / 2), animated: false });
  }, [layout, metrics.black, metrics.white, notes, viewport]);

  function press(midi: number) {
    onKey(midi);
    setTapped(midi);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapped(null), 280);
  }

  const falling = waterfall
    ? notes.filter((note) => note.time < scoreTime + lookAhead && note.time + note.duration > scoreTime - 0.05)
    : [];

  function keyStyle(midi: number, black: boolean) {
    const isWait = waiting.includes(midi);
    const isOn = active.includes(midi);
    const isOk = success.includes(midi);
    const isBad = wrong.includes(midi);
    if (isWait) return { backgroundColor: black ? "#059669" : "#34d399", shadowColor: "#34d399" };
    if (isOk) return { backgroundColor: black ? "#10b981" : "#6ee7b7", shadowColor: "#6ee7b7" };
    if (tapped === midi || isBad) return { backgroundColor: black ? "#ea580c" : "#fb923c", shadowColor: "#f97316" };
    if (isOn) return { backgroundColor: black ? "#38bdf8" : "#7dd3fc", shadowColor: "#38bdf8" };
    return null;
  }

  return (
    <View
      style={[styles.dock, waterfall && styles.dockFill, !waterfall && { paddingTop: SABER }]}
      onLayout={waterfall ? (event) => setLane(Math.max(0, event.nativeEvent.layout.height - metrics.keyH)) : undefined}
    >
      <View
        pointerEvents="none"
        style={[styles.saberLane, waterfall ? { bottom: metrics.keyH } : { top: 0 }]}
      >
        <View style={[styles.saberGlow, waitMode ? styles.glowWait : styles.glowPlay]} />
        <View style={[styles.saberCore, waitMode ? styles.coreWait : styles.corePlay]} />
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        style={waterfall ? styles.fill : undefined}
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        scrollEventThrottle={16}
      >
        <View style={{ width: layout.width, height: (waterfall ? lane : 0) + metrics.keyH }}>
          {waterfall && (
            <View style={[styles.fall, { height: lane, width: layout.width }]}>
              {falling.map((note, index) => {
                const yStart = lane - (note.time - scoreTime) * pixelsPerSecond;
                const height = Math.max(4, note.duration * pixelsPerSecond);
                const top = yStart - height;
                const waitingNote = waiting.includes(note.note);
                const width = isBlack(note.note) ? metrics.black : metrics.white - 4;
                return (
                  <View
                    key={`${note.note}-${note.time}-${index}`}
                    style={[
                      styles.beam,
                      {
                        left: xOf(layout, note.note, metrics.white, metrics.black) + (isBlack(note.note) ? 0 : 2),
                        top,
                        width,
                        height,
                        backgroundColor: waitingNote ? "rgba(52,211,153,0.92)" : "rgba(56,189,248,0.92)",
                        shadowColor: waitingNote ? "#34d399" : "#38bdf8",
                        borderColor: waitingNote ? "#d1fae5" : "#e0f2fe",
                      },
                    ]}
                  />
                );
              })}
              <View style={[styles.fade, { height: Math.min(72, lane * 0.22) }]} />
            </View>
          )}
          <View style={{ height: metrics.keyH }}>
            {layout.whites.map((key) => {
              const lit = keyStyle(key.midi, false);
              return (
                <Pressable
                  key={key.midi}
                  onPress={() => press(key.midi)}
                  style={[
                    styles.white,
                    { left: key.x, width: metrics.white - 2, height: metrics.keyH },
                    lit && styles.lit,
                    lit,
                  ]}
                >
                  {(waiting.includes(key.midi) || active.includes(key.midi)) && (
                    <Text style={styles.noteName}>{NAMES[key.midi % 12].replace("#", "")}</Text>
                  )}
                </Pressable>
              );
            })}
            {layout.blacks.map((key) => {
              const lit = keyStyle(key.midi, true);
              return (
                <Pressable
                  key={key.midi}
                  onPress={() => press(key.midi)}
                  style={[
                    styles.black,
                    { left: key.x, width: metrics.black, height: metrics.blackH },
                    lit && styles.lit,
                    lit,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { backgroundColor: "#070b12", borderTopWidth: 1, borderTopColor: "#164e63" },
  dockFill: { flex: 1, backgroundColor: "#05080f" },
  fill: { flex: 1 },
  fall: { position: "relative", overflow: "hidden", backgroundColor: "#05080f" },
  fade: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.72)" },
  saberLane: {
    position: "absolute",
    left: 0,
    right: 0,
    height: SABER,
    zIndex: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  saberGlow: { position: "absolute", left: 0, right: 0, height: 8, opacity: 0.55 },
  saberCore: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  glowPlay: { backgroundColor: "#38bdf8" },
  corePlay: { backgroundColor: "#38bdf8", shadowColor: "#38bdf8" },
  glowWait: { backgroundColor: "#34d399" },
  coreWait: { backgroundColor: "#34d399", shadowColor: "#34d399" },
  beam: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  white: {
    position: "absolute",
    backgroundColor: "#f8fafc",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 6,
  },
  black: {
    position: "absolute",
    backgroundColor: "#18181b",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 2,
  },
  lit: {
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  noteName: { fontFamily: fonts.bold, fontSize: 10, color: "#0f172a" },
});
