import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { config } from "../src/config";
import { purchaseWasCancelled, usePurchases } from "../src/purchases";
import { dark, fonts } from "../src/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { pro, restore, buy, priceLabel, configured, devUnlock } = usePurchases();
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      // The system can still show a fallback sheet.
    }
  }

  async function onRestore() {
    setRestoreText("Checking purchases…");
    try {
      const unlocked = await restore();
      setRestoreText(unlocked ? "Your Pro purchase is active." : "No Pro purchase found for this account.");
    } catch {
      setRestoreText("Restore failed. Please try again.");
    }
  }

  async function onBuy() {
    setBuyError(null);
    if (!configured) {
      if (__DEV__) {
        devUnlock();
        return;
      }
      setBuyError("Add the RevenueCat keys in .env, then rebuild.");
      return;
    }
    setBuyBusy(true);
    try {
      const ok = await buy();
      if (!ok) setBuyError("The store did not unlock Piano Academy Pro.");
    } catch (err) {
      if (!purchaseWasCancelled(err)) setBuyError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBuyBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.head}>
          <Pressable style={styles.back} accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Plan</Text>
            <Text style={styles.rowHelp}>{pro ? "Pro unlocked on this device." : "Free plan."}</Text>
          </View>
          {pro ? <Text style={styles.proBadge}>PRO</Text> : <Text style={styles.freeBadge}>FREE</Text>}
        </View>
        <Pressable style={styles.action} onPress={() => void onRestore()}>
          <Text style={styles.actionText}>Restore purchases</Text>
        </Pressable>
        {restoreText ? <Text style={styles.restoreText}>{restoreText}</Text> : null}

        {!pro ? (
          <>
            <Text style={styles.section}>Upgrade to Pro</Text>
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeKicker}>PIANO ACADEMY PRO</Text>
              <Text style={styles.upgradePrice}>{priceLabel ?? "One-time purchase"}</Text>
              <Text style={styles.upgradeBody}>
                Premium scores play in full. Free playback stops after {config.previewSeconds} seconds. PDF download is included with Pro.
              </Text>
              {buyError ? <Text style={styles.buyError}>{buyError}</Text> : null}
              <Pressable style={styles.upgradeBtn} onPress={() => void onBuy()} disabled={buyBusy}>
                {buyBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.upgradeBtnText}>{configured ? "Unlock Pro" : __DEV__ ? "Dev unlock" : "Unlock Pro"}</Text>}
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Links</Text>
        <Pressable style={styles.row} onPress={() => void open("https://danijelbrecelj.com")}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>About developer</Text>
            <Text style={styles.rowHelp}>danijelbrecelj.com</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => void open("https://danijelbrecelj.com/support")}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>App support</Text>
            <Text style={styles.rowHelp}>danijelbrecelj.com/support</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.copyright}>© {new Date().getFullYear()} Danijel Brecelj. All rights reserved.</Text>
        <Text style={styles.copyright}>D8R Piano Academy.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  body: { padding: 20, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    backgroundColor: dark.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontFamily: fonts.bold, color: dark.fg, fontSize: 22, marginTop: -2 },
  title: { fontFamily: fonts.bold, color: dark.fg, fontSize: 22 },
  section: { fontFamily: fonts.bold, color: dark.muted, letterSpacing: 1.4, fontSize: 12, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.cardEdge,
    padding: 14,
  },
  rowLabel: { fontFamily: fonts.bold, color: dark.fg, fontSize: 16 },
  rowHelp: { fontFamily: fonts.regular, color: dark.muted, fontSize: 12, marginTop: 2 },
  chevron: { fontFamily: fonts.bold, color: dark.sky, fontSize: 22 },
  proBadge: { fontFamily: fonts.bold, color: "#0f172a", backgroundColor: dark.sky, overflow: "hidden", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, letterSpacing: 1 },
  freeBadge: { fontFamily: fonts.bold, color: "#052e24", backgroundColor: "#34d399", overflow: "hidden", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, letterSpacing: 1 },
  action: { height: 48, borderRadius: 16, backgroundColor: dark.sky, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: fonts.bold, color: "#0f172a", fontSize: 15 },
  restoreText: { fontFamily: fonts.regular, color: dark.muted, fontSize: 13 },
  upgradeCard: { backgroundColor: "#0b2230", borderWidth: 1.5, borderColor: "#38bdf8", borderRadius: 20, padding: 18, gap: 8 },
  upgradeKicker: { fontFamily: fonts.bold, letterSpacing: 1.6, fontSize: 12, color: "#818cf8" },
  upgradePrice: { fontFamily: fonts.bold, fontSize: 30, color: dark.fg },
  upgradeBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: dark.muted },
  buyError: { fontFamily: fonts.medium, fontSize: 13, color: "#fb7185" },
  upgradeBtn: { height: 48, borderRadius: 24, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center", marginTop: 6 },
  upgradeBtnText: { fontFamily: fonts.bold, color: "#fff", fontSize: 15 },
  copyright: { fontFamily: fonts.regular, color: dark.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});