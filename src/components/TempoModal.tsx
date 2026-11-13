import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Slider from "@react-native-community/slider";
import { tempoBounds } from "../lib/tempo";
import { fonts, light, TABLET_MIN } from "../theme";

export function TempoModal({
  visible,
  pieceBpm,
  bpm,
  onChange,
  onClose,
}: {
  visible: boolean;
  pieceBpm: number;
  bpm: number;
  onChange: (bpm: number) => void;
  onClose: () => void;
}) {
  const { min, max } = tempoBounds(pieceBpm);
  const percent = Math.round((bpm / Math.max(1, max)) * 100);
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= TABLET_MIN;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.card, tablet && styles.cardTablet]} onPress={() => undefined}>
          <Text style={styles.kicker}>TEMPO</Text>
          <Text style={styles.bpm}>{bpm} BPM</Text>
          <Text style={styles.hint}>
            {percent}% of the written {max} BPM. The slowest setting is {min}.
          </Text>
          <Slider
            minimumValue={min}
            maximumValue={max}
            step={1}
            value={bpm}
            minimumTrackTintColor="#0284c7"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#0284c7"
            onValueChange={onChange}
          />
          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", borderRadius: 24, backgroundColor: light.white, padding: 20, gap: 8 },
  cardTablet: { maxWidth: 440 },
  kicker: { fontFamily: fonts.bold, letterSpacing: 1.4, color: light.sky, fontSize: 12 },
  bpm: { fontFamily: fonts.bold, fontSize: 36, color: light.ink },
  hint: { fontFamily: fonts.regular, color: light.muted, lineHeight: 20 },
  done: { marginTop: 8, height: 46, borderRadius: 23, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: fonts.bold, color: "#fff" },
});
