import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { config } from "../config";
import { purchaseWasCancelled, usePurchases } from "../purchases";
import { fonts, light } from "../theme";

export function Paywall({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { configured, priceLabel, buy, restore, devUnlock } = usePurchases();
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onBuy() {
    setError(null);
    if (!configured) {
      if (__DEV__) {
        devUnlock();
        onClose();
        return;
      }
      setError("Add the RevenueCat keys in .env, then rebuild.");
      return;
    }
    setBusy("buy");
    try {
      const ok = await buy();
      if (ok) onClose();
      else setError("The store did not unlock Piano Academy Pro.");
    } catch (err) {
      if (!purchaseWasCancelled(err)) setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    setError(null);
    if (!configured) {
      setError("Restore needs the RevenueCat keys.");
      return;
    }
    setBusy("restore");
    try {
      const ok = await restore();
      if (ok) onClose();
      else setError("No previous purchase was found for this store account.");
    } catch (err) {
      if (!purchaseWasCancelled(err)) setError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close purchase" />
      <View style={[styles.card, { marginBottom: Math.max(16, insets.bottom + 8) }]}>
        <Text style={styles.kicker}>PIANO ACADEMY PRO</Text>
        <Text style={styles.price}>{priceLabel ?? "One-time purchase"}</Text>
        <Text style={styles.body}>
          Premium scores play in full. Free playback stops after {config.previewSeconds} seconds. PDF download is included with Pro.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.row}>
          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostText}>Not now</Text>
          </Pressable>
          <Pressable style={styles.buy} onPress={() => void onBuy()} disabled={busy != null}>
            {busy === "buy" ? <ActivityIndicator color="#fff" /> : <Text style={styles.buyText}>{configured ? "Unlock" : __DEV__ ? "Dev unlock" : "Unlock"}</Text>}
          </Pressable>
        </View>
        <Pressable onPress={() => void onRestore()} disabled={busy != null} style={styles.restore}>
          <Text style={styles.restoreText}>{busy === "restore" ? "Restoring…" : "Restore purchase"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  card: {
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: light.white,
    padding: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kicker: { fontFamily: fonts.bold, letterSpacing: 1.6, fontSize: 12, color: "#4f46e5" },
  price: { fontFamily: fonts.bold, fontSize: 32, color: light.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: light.muted },
  error: { fontFamily: fonts.medium, color: "#be123c" },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  ghost: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: fonts.semibold, color: light.ink },
  buy: { flex: 1, height: 48, borderRadius: 24, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  buyText: { fontFamily: fonts.bold, color: "#fff" },
  restore: { height: 40, alignItems: "center", justifyContent: "center" },
  restoreText: { fontFamily: fonts.medium, color: light.muted },
});
