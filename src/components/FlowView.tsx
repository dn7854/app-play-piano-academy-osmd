import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Difficulty, FlowSection, FlowTile, PieceSummary } from "../api/types";
import { usePurchases } from "../purchases";
import { dark, fonts, TABLET_MIN } from "../theme";

const TILE_GAP = 12;

const difficultyTone: Record<Exclude<Difficulty, null>, { color: string; bg: string }> = {
  Beginner: { color: "#6ee7b7", bg: "#052e24" },
  Intermediate: { color: dark.sky, bg: "#0b2230" },
  Advanced: { color: "#fcd34d", bg: "#2a2108" },
};

export function FlowView({ sections, onOpen }: { sections: FlowSection[]; onOpen: (piece: PieceSummary) => void }) {
  const { pro } = usePurchases();
  const { width } = useWindowDimensions();
  const contentWidth = Math.max(160, width - 40);
  const grid = width >= TABLET_MIN;
  const columns = width >= 1100 ? 4 : 3;
  const tileWidth = grid ? Math.max(148, Math.floor((contentWidth - TILE_GAP * (columns - 1)) / columns)) : 164;

  return (
    <View style={styles.sections}>
      {sections.map((section, index) => (
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
          {grid ? (
            <View style={styles.grid}>
              {section.tiles.map((tile) => (
                <ScoreTile key={tile.id} tile={tile} width={tileWidth} locked={tile.piece.isPremium && !pro} onOpen={onOpen} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              nestedScrollEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator={false}
              style={{ height: Math.round(tileWidth * 0.7) + 98 }}
              contentContainerStyle={styles.row}
            >
              {section.tiles.map((tile) => (
                <ScoreTile key={tile.id} tile={tile} width={tileWidth} locked={tile.piece.isPremium && !pro} onOpen={onOpen} />
              ))}
            </ScrollView>
          )}
        </View>
      ))}
    </View>
  );
}

function ScoreTile({
  tile,
  width,
  locked,
  onOpen,
}: {
  tile: FlowTile;
  width: number;
  locked: boolean;
  onOpen: (piece: PieceSummary) => void;
}) {
  const piece = tile.piece;
  const tone = piece.difficulty ? difficultyTone[piece.difficulty] : null;
  const label = [piece.title, piece.composer, piece.difficulty, locked ? "Premium" : null].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onOpen(piece)}
      style={[styles.tile, { width }]}
    >
      <Cover uri={piece.imageUrl} height={Math.round(width * 0.7)} locked={locked} />
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
    </Pressable>
  );
}

function Cover({ uri, height, locked }: { uri: string | null; height: number; locked: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;
  return (
    <View style={[styles.cover, { height }]}>
      {showImage && uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailedUri(uri)} />
      ) : (
        <Text style={styles.mark}>♪</Text>
      )}
      {locked ? (
        <View style={styles.lock}>
          <Text style={styles.lockText}>PRO</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 22 },
  section: { gap: 12 },
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
  row: { gap: TILE_GAP },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },
  tile: {
    backgroundColor: dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    overflow: "hidden",
  },
  cover: { backgroundColor: dark.line, alignItems: "center", justifyContent: "center" },
  mark: { fontFamily: fonts.bold, color: dark.muted, fontSize: 28 },
  lock: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: dark.sky,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockText: { fontFamily: fonts.bold, color: "#0f172a", fontSize: 10 },
  body: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 2 },
  title: { fontFamily: fonts.bold, color: dark.fg, fontSize: 15, lineHeight: 19 },
  composer: { fontFamily: fonts.regular, color: dark.muted, fontSize: 12 },
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
});
