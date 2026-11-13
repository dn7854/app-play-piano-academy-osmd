import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PieceScreen } from "../../src/components/PieceScreen";
import { fonts, light } from "../../src/theme";

class PieceErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[Piece] The score screen hit an error.", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.center}>
        <Text style={styles.error}>This score could not be opened.</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }
}

export default function PieceRoute() {
  const params = useLocalSearchParams<{ id: string; collection?: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] || "";
  const collection = typeof params.collection === "string" ? params.collection : params.collection?.[0];
  return (
    <PieceErrorBoundary key={id}>
      <PieceScreen key={id} id={id} collection={collection || undefined} />
    </PieceErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: light.bg, padding: 24, gap: 12 },
  error: { fontFamily: fonts.medium, color: light.ink, textAlign: "center" },
  backBtn: { backgroundColor: light.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontFamily: fonts.bold, color: "#fff" },
});
