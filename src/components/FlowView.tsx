import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Difficulty, FlowSection, FlowTile, PieceSummary } from "../api/types";
import { usePurchases } from "../purchases";
import { dark, fonts, TABLET_MIN } from "../theme";

const TILE_GAP = 10;
const TILE_W = 196;

const difficultyTone: Record<Exclude<Difficulty, null>, { color: string; bg: string }> = {
  Beginner: { color: "#6ee7b7", bg: "#052e24" },
  Intermediate: { color: dark.sky, bg: "#0b2230" },
  Advanced: { color: "#fcd34d", bg: "#2a2108" },
};

/** Phone: one scrolling line. Tablet: a second or third line once a section is long enough to read as levels. */
function lineCount(tileCount: number, tablet: boolean) {
  if (!tablet) return 1;
  if (tileCount >= 8) return 3;
  if (tileCount >= 4) return 2;
  return 1;
}

function chunk<T>(items: T[], parts: number): T[][] {
  if (parts <= 1) return [items];
  const size = Math.ceil(items.length / parts);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

export function FlowView({ sections, onOpen }: { sections: FlowSection[]; onOpen: (piece: PieceSummary) => void }) {
  const { pro } = usePurchases();
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= TABLET_MIN;

  return (
    <View style={styles.sections}>
      {sections.map((section, index) => {
        const rows = chunk(section.tiles, lineCount(section.tiles.length, tablet));
        return (
          <View key={section.id} style={styles.section}>
            <View style={styles.head}>
              <View style={styles.step}>
                <Text style={styles.stepText}>{index + 1}</Text>
              </View>
              <View style={styles.headText}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.description ? <Text style={styles.sectionBody}>{section.description}</Text> : null}
              </View>
            </View>
            <View style={styles.lines}>
              {rows.map((row, rowIndex) => (
                <ScrollView
                  key={`${section.id}-${rowIndex}`}
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.scroller}
                  contentContainerStyle={styles.row}
                >
                  {row.map((tile) => (
                    <ScoreTile key={tile.id} tile={tile} locked={tile.piece.isPremium && !pro} onOpen={onOpen} />
                  ))}
                </ScrollView>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ScoreTile({
  tile,
  locked,
  onOpen,
}: {
  tile: FlowTile;
  locked: boolean;
  onOpen: (piece: PieceSummary) => void;
}) {
  const piece = tile.piece;
  const tone = piece.difficulty ? difficultyTone[piece.difficulty] : null;
  const label = [piece.title, piece.composer, piece.difficulty, locked ? "Premium" : null].filter(Boolean).join(", ");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onOpen(piece)} style={styles.tile}>
      <Cover uri={piece.imageUrl} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {piece.title}
        </Text>
        <Text style={styles.composer} numberOfLines={1}>
          {piece.composer || "Piano"}
        </Text>
        {tone && piece.difficulty ? (
          <Text style={[styles.badge, { color: tone.color, backgroundColor: tone.bg }]}>{piece.difficulty}</Text>
        ) : null}
      </View>
      {!piece.isPremium ? <Text style={styles.freeText}>FREE</Text> : null}
    </Pressable>
  );
}

function Cover({ uri }: { uri: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) {
    return (
      <View style={styles.markWrap}>
        <Text style={styles.mark}>♪</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.thumb}
      resizeMode="cover"
      onError={() => setFailedUri(uri)}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  sections: { gap: 26 },
  section: { gap: 10, backgroundColor: "#0b2230", borderWidth: 1.5, borderColor: "#38bdf8", borderRadius: 18, padding: 14 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b2230",
    borderWidth: 1,
    borderColor: dark.cardEdge,
  },
  stepText: { fontFamily: fonts.bold, color: dark.sky, fontSize: 13 },
  headText: { flex: 1, gap: 2 },
  sectionTitle: { fontFamily: fonts.bold, color: dark.fg, fontSize: 20 },
  sectionBody: { fontFamily: fonts.regular, color: dark.muted, fontSize: 14, lineHeight: 20 },
  lines: { gap: 10 },
  scroller: { minHeight: 76 },
  row: { gap: TILE_GAP, paddingRight: 4 },
  tile: {
    width: TILE_W,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  thumb: { width: 44, height: 56, borderRadius: 8, backgroundColor: dark.line },
  markWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dark.line,
  },
  mark: { fontFamily: fonts.bold, color: dark.muted, fontSize: 14 },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, color: dark.fg, fontSize: 15, lineHeight: 19 },
  composer: { fontFamily: fonts.regular, color: dark.muted, fontSize: 12 },
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: 2,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  lockText: {
    fontFamily: fonts.bold,
    color: "#0f172a",
    backgroundColor: dark.sky,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
  },
  freeText: {
    fontFamily: fonts.bold,
    color: "#052e24",
    backgroundColor: "#34d399",
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    letterSpacing: 1,
  },
});
