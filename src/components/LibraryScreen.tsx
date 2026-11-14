import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { recallJson, rememberJson } from "../api/cache";
import {
  ApiError,
  fetchCollection,
  fetchCollections,
  fetchFlow,
  fetchPieces,
  flowEndpointMissing,
  normalizeFlow,
} from "../api/client";
import type { CollectionDetail, CollectionSummary, FlowSection, PieceSummary } from "../api/types";
import { dark, fonts } from "../theme";
import { FlowView } from "./FlowView";

function openPiece(piece: PieceSummary, collection?: string) {
  router.push({ pathname: "/piece/[id]", params: { id: piece.slug || piece.id, collection: collection ?? "" } });
}

function CoverThumb({ uri }: { uri: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const show = Boolean(uri) && failedUri !== uri;
  return (
    <View style={styles.thumb}>
      {show && uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailedUri(uri)} />
      ) : (
        <Text style={styles.thumbMark}>♪</Text>
      )}
    </View>
  );
}

function Card({
  title,
  subtitle,
  meta,
  premium,
  imageUrl,
  onPress,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  premium?: boolean;
  imageUrl: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <CoverThumb uri={imageUrl} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

type HomeMode = "flow" | "library";

export function LibraryScreen({ slug }: { slug?: string }) {
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [pieces, setPieces] = useState<PieceSummary[]>([]);
  const [title, setTitle] = useState(slug ? "Collection" : "Library");
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libLoading, setLibLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [sections, setSections] = useState<FlowSection[]>([]);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowLoading, setFlowLoading] = useState(!slug);
  const [flowHidden, setFlowHidden] = useState(true);
  const [flowFromCache, setFlowFromCache] = useState(false);
  const [flowSettled, setFlowSettled] = useState(Boolean(slug));
  const [mode, setMode] = useState<HomeMode>("library");
  const picked = useRef(false);
  const sectionsRef = useRef<FlowSection[]>([]);

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    setError(null);
    try {
      if (slug) {
        const detail = await fetchCollection(slug);
        setTitle(detail.title);
        setDescription(detail.description);
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
        ? await recallJson<CollectionDetail>(`collection-${slug}`)
        : await recallJson<{ collections: CollectionSummary[]; pieces: PieceSummary[] }>("home");
      if (cached && "pieces" in cached) {
        if ("title" in cached && slug) {
          setTitle(cached.title);
          setDescription(cached.description);
          setPieces(cached.pieces);
          setCollections([]);
        } else if ("collections" in cached) {
          setCollections(cached.collections);
          setPieces(cached.pieces);
          setTitle("Library");
        }
        setFromCache(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : "The library could not be opened.");
      }
    } finally {
      setLibLoading(false);
    }
  }, [slug]);

  const loadFlow = useCallback(async () => {
    if (slug) return;
    setFlowLoading(true);
    setFlowError(null);
    try {
      const next = await fetchFlow();
      sectionsRef.current = next;
      setSections(next);
      setFlowHidden(false);
      setFlowFromCache(false);
      await rememberJson("flow", next);
      if (!picked.current) setMode("flow");
    } catch (err) {
      const cached = normalizeFlow({ sections: await recallJson<unknown>("flow") });
      const stale = cached.length ? cached : sectionsRef.current;
      if (stale.length) {
        sectionsRef.current = stale;
        setSections(stale);
        setFlowFromCache(true);
        setFlowHidden(false);
        if (!picked.current) setMode("flow");
        return;
      }
      const offline = err instanceof ApiError && err.kind === "network";
      if (flowEndpointMissing(err) || offline) {
        sectionsRef.current = [];
        setSections([]);
        setFlowHidden(true);
        setFlowFromCache(false);
        setMode("library");
        return;
      }
      setFlowHidden(false);
      setFlowFromCache(false);
      setFlowError(err instanceof ApiError ? err.message : "The path could not be opened.");
      if (!picked.current) setMode("flow");
    } finally {
      setFlowLoading(false);
      setFlowSettled(true);
    }
  }, [slug]);

  const load = useCallback(async () => {
    await Promise.all([loadLibrary(), loadFlow()]);
  }, [loadLibrary, loadFlow]);

  useEffect(() => {
    void load();
  }, [load]);

  function pick(next: HomeMode) {
    picked.current = true;
    setMode(next);
  }

  const path = !slug && mode === "flow" && !flowHidden;
  const showSwitch = !slug && flowSettled && !flowHidden;
  const holdForFlow = !slug && !flowSettled;
  const refreshing = !holdForFlow && (path ? flowLoading : libLoading);
  const heading = slug ? title : path ? "Flow" : title;
  const lede = path ? "Scores in the order you learn them." : description || "Scores to read and play, with the orchestra under your hands.";
  const showLibrarySpinner = libLoading && !pieces.length && !collections.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={dark.sky} />}
      >
        <View style={styles.topRow}>
          <View style={styles.topSide}>
            {slug ? (
              <Pressable
                style={styles.headerBtn}
                accessibilityLabel="Back to the library"
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              >
                <Text style={styles.headerIcon}>‹</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.brand}>D8R PIANO ACADEMY</Text>
          <View style={styles.topSide}>
            <Pressable style={styles.headerBtn} accessibilityLabel="Open settings" onPress={() => router.push("/settings")}>
              <Text style={styles.settingsText}>Settings</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.lede}>{lede}</Text>
        {(path ? flowFromCache : fromCache) ? <Text style={styles.cache}>Showing scores saved on this device.</Text> : null}
        {showSwitch ? (
          <View style={styles.switch} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: path }}
              onPress={() => pick("flow")}
              style={[styles.switchItem, path && styles.switchOn]}
            >
              <Text style={[styles.switchText, path && styles.switchTextOn]}>Flow</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: !path }}
              onPress={() => pick("library")}
              style={[styles.switchItem, !path && styles.switchOn]}
            >
              <Text style={[styles.switchText, !path && styles.switchTextOn]}>Library</Text>
            </Pressable>
          </View>
        ) : null}
        {!path && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {holdForFlow ? <ActivityIndicator color={dark.sky} /> : null}
        {!holdForFlow && path ? (
          flowError ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{flowError}</Text>
              <Pressable onPress={() => void load()} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : flowLoading && !sections.length ? (
            <ActivityIndicator color={dark.sky} />
          ) : sections.length ? (
            <FlowView sections={sections} onOpen={(piece) => openPiece(piece)} />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>No sections are published on the path yet. Every score is still on the Library tab.</Text>
            </View>
          )
        ) : null}
        {!holdForFlow && !path ? (
          <>
            {showLibrarySpinner ? <ActivityIndicator color={dark.sky} /> : null}
            {collections.length ? <Text style={styles.section}>Collections</Text> : null}
            {collections.map((collection) => (
              <Card
                key={collection.id}
                title={collection.title}
                subtitle={collection.description || "Collection"}
                meta={collection.pieceCount ? `${collection.pieceCount} pieces` : undefined}
                imageUrl={collection.imageUrl}
                onPress={() => router.push({ pathname: "/collection/[slug]", params: { slug: collection.slug } })}
              />
            ))}
            {pieces.length ? <Text style={styles.section}>{slug ? "Pieces" : "All scores"}</Text> : null}
            {pieces.map((piece) => (
              <Card
                key={piece.id}
                title={piece.title}
                subtitle={piece.composer || "Piano"}
                meta={piece.difficulty || undefined}
                premium={piece.isPremium}
                imageUrl={piece.imageUrl}
                onPress={() => openPiece(piece, slug)}
              />
            ))}
          </>
        ) : null}
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
  switch: {
    flexDirection: "row",
    backgroundColor: dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    padding: 4,
    gap: 4,
  },
  switchItem: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  switchOn: { backgroundColor: dark.sky },
  switchText: { fontFamily: fonts.bold, color: dark.muted, fontSize: 14 },
  switchTextOn: { color: "#0f172a" },
  section: { fontFamily: fonts.bold, color: dark.muted, letterSpacing: 1.4, fontSize: 12, marginTop: 8 },
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    padding: 12,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: dark.line,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbMark: { fontFamily: fonts.bold, color: dark.muted, fontSize: 18 },
  cardTitle: { fontFamily: fonts.bold, color: dark.fg, fontSize: 17 },
  cardSub: { fontFamily: fonts.regular, color: dark.muted, marginTop: 3 },
  meta: { fontFamily: fonts.medium, color: dark.sky, fontSize: 12 },
  pro: { fontFamily: fonts.bold, color: "#0f172a", backgroundColor: dark.sky, overflow: "hidden", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
  free: { fontFamily: fonts.bold, color: "#052e24", backgroundColor: "#34d399", overflow: "hidden", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, letterSpacing: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  topSide: { minWidth: 56, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerBtn: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: dark.cardEdge, backgroundColor: dark.card, alignItems: "center", justifyContent: "center" },
  headerIcon: { fontFamily: fonts.bold, color: dark.fg, fontSize: 22, marginTop: -2 },
  settingsText: { fontFamily: fonts.bold, color: dark.sky, fontSize: 13 },
  emptyBox: { borderRadius: 16, borderWidth: 1, borderColor: dark.cardEdge, backgroundColor: dark.card, padding: 16 },
  empty: { fontFamily: fonts.regular, color: dark.muted, fontSize: 15, lineHeight: 21 },
  errorBox: { borderRadius: 16, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#1f1316", padding: 14, gap: 10 },
  error: { fontFamily: fonts.regular, color: "#fecdd3", lineHeight: 20 },
  retry: { alignSelf: "flex-start", backgroundColor: dark.fg, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bold, color: dark.bg },
});
