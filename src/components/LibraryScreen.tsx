import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, fetchCollection, fetchCollections, fetchPieces } from "../api/client";
import { recallJson, rememberJson } from "../api/cache";
import type { Collection, PieceSummary } from "../api/types";
import { dark, fonts } from "../theme";

function openPiece(piece: PieceSummary, collection?: string) {
  router.push({ pathname: "/piece/[id]", params: { id: piece.slug || piece.id, collection: collection ?? "" } });
}

function Card({ title, subtitle, meta, premium, onPress }: { title: string; subtitle: string; meta?: string; premium?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {premium ? <Text style={styles.pro}>PRO</Text> : null}
      </View>
    </Pressable>
  );
}

export function LibraryScreen({ slug }: { slug?: string }) {
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pieces, setPieces] = useState<PieceSummary[]>([]);
  const [title, setTitle] = useState(slug ? "Collection" : "Library");
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (slug) {
        const detail = await fetchCollection(slug);
        setTitle(detail.collection.title);
        setDescription(detail.collection.description);
        setPieces(detail.pieces);
        setCollections([]);
        await rememberJson(`collection-${slug}`, detail);
      } else {
        const [nextCollections, nextPieces] = await Promise.all([fetchCollections(), fetchPieces()]);
        setCollections(nextCollections);
        setPieces(nextPieces);
        setTitle("Library");
        await rememberJson("home", { collections: nextCollections, pieces: nextPieces });
      }
      setFromCache(false);
    } catch (err) {
      const cached = slug
        ? await recallJson<{ collection: Collection; pieces: PieceSummary[] }>(`collection-${slug}`)
        : await recallJson<{ collections: Collection[]; pieces: PieceSummary[] }>("home");
      if (cached && "pieces" in cached) {
        if ("collection" in cached && cached.collection) {
          setTitle(cached.collection.title);
          setDescription(cached.collection.description);
          setPieces(cached.pieces);
        } else if ("collections" in cached) {
          setCollections(cached.collections);
          setPieces(cached.pieces);
        }
        setFromCache(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : "The library could not be opened.");
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={dark.sky} />}
      >
        <Text style={styles.brand}>D8R</Text>
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.lede}>{description || "Scores to read and play, with the orchestra under your hands."}</Text>
        {fromCache ? <Text style={styles.cache}>Showing scores saved on this device.</Text> : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {loading && !pieces.length && !collections.length ? <ActivityIndicator color={dark.sky} /> : null}
        {collections.length ? <Text style={styles.section}>Collections</Text> : null}
        {collections.map((collection) => (
          <Card
            key={collection.id}
            title={collection.title}
            subtitle={collection.description || "Collection"}
            meta={collection.pieceCount ? `${collection.pieceCount} pieces` : undefined}
            onPress={() => router.push({ pathname: "/collection/[slug]", params: { slug: collection.slug } })}
          />
        ))}
        {pieces.length ? <Text style={styles.section}>{slug ? "Pieces" : "All scores"}</Text> : null}
        {pieces.map((piece) => (
          <Card
            key={piece.id}
            title={piece.title}
            subtitle={piece.composer || "Piano"}
            meta={piece.level || undefined}
            premium={piece.isPremium}
            onPress={() => openPiece(piece, slug)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  brand: { fontFamily: fonts.bold, color: dark.sky, letterSpacing: 3, fontSize: 13 },
  heading: { fontFamily: fonts.bold, color: dark.fg, fontSize: 36, marginTop: -6 },
  lede: { fontFamily: fonts.regular, color: dark.muted, fontSize: 15, lineHeight: 21 },
  cache: { fontFamily: fonts.medium, color: dark.sky, fontSize: 12 },
  section: { fontFamily: fonts.bold, color: dark.muted, letterSpacing: 1.4, fontSize: 12, marginTop: 8 },
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    padding: 16,
  },
  cardTitle: { fontFamily: fonts.bold, color: dark.fg, fontSize: 17 },
  cardSub: { fontFamily: fonts.regular, color: dark.muted, marginTop: 3 },
  meta: { fontFamily: fonts.medium, color: dark.sky, fontSize: 12 },
  pro: { fontFamily: fonts.bold, color: "#0f172a", backgroundColor: dark.sky, overflow: "hidden", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
  errorBox: { borderRadius: 16, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#1f1316", padding: 14, gap: 10 },
  error: { fontFamily: fonts.regular, color: "#fecdd3", lineHeight: 20 },
  retry: { alignSelf: "flex-start", backgroundColor: dark.fg, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bold, color: dark.bg },
});
