import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePurchases } from "../src/purchases";
import { dark, fonts } from "../src/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { pro, restore } = usePurchases();
  const [restoreText, setRestoreText] = useState<string | null>(null);

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
  copyright: { fontFamily: fonts.regular, color: dark.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});