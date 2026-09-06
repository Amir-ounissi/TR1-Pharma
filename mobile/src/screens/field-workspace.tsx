import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BrandContext } from "../../App";
import { OrderWorkflow } from "./order-workflow";
import { PharmacyWorkspace } from "./pharmacy-workspace";

type Route = "home" | "pharmacies" | "orders";

type Props = {
  brand: BrandContext;
  canSwitchBrand: boolean;
  onSwitchBrand: () => void;
  onSignOut: () => Promise<void>;
};

export function FieldWorkspace({ brand, canSwitchBrand, onSwitchBrand, onSignOut }: Props) {
  const [route, setRoute] = useState<Route>("home");

  if (route === "pharmacies") {
    return <PharmacyWorkspace brand={brand} onBack={() => setRoute("home")} />;
  }
  if (route === "orders") {
    return <OrderWorkflow brand={brand} onBack={() => setRoute("home")} onDone={() => setRoute("home")} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>TR1 TERRAIN</Text>
            <Text style={styles.title}>{brand.name}</Text>
            <Text style={styles.meta}>{brand.role}</Text>
          </View>
          {canSwitchBrand ? (
            <Pressable onPress={onSwitchBrand} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Changer</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>AUJOURD’HUI</Text>
          <Text style={styles.heroTitle}>Votre journée terrain commence ici.</Text>
          <Text style={styles.heroText}>Pharmacies, commandes et prochaines actions sont accessibles en quelques gestes.</Text>
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <Pressable onPress={() => setRoute("orders")} style={[styles.actionCard, styles.actionFeatured]}>
          <Text style={styles.actionTitle}>Scanner une commande</Text>
          <Text style={styles.actionText}>Photo → analyse → correction → validation</Text>
          <Text style={styles.openLabel}>OUVRIR LA CAMÉRA</Text>
        </Pressable>
        <Pressable onPress={() => setRoute("pharmacies")} style={styles.actionCard}>
          <Text style={styles.actionTitle}>Pharmacies</Text>
          <Text style={styles.actionText}>Portefeuille, recherche et fiche compte</Text>
          <Text style={styles.openLabel}>OUVRIR</Text>
        </Pressable>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Missions</Text>
          <Text style={styles.actionText}>Priorités terrain</Text>
          <Text style={styles.soon}>À VENIR</Text>
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Agenda</Text>
          <Text style={styles.actionText}>Visites et relances</Text>
          <Text style={styles.soon}>À VENIR</Text>
        </View>

        <Pressable onPress={onSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 42 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 5 },
  meta: { color: "#667085", fontSize: 13, marginTop: 3 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC" },
  smallButtonText: { color: "#3B5BDB", fontWeight: "700", fontSize: 13 },
  hero: { backgroundColor: "#111827", borderRadius: 24, padding: 22, marginBottom: 26 },
  heroKicker: { color: "#A5B4FC", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  heroTitle: { color: "#FFF", fontSize: 24, lineHeight: 30, fontWeight: "800", marginTop: 10 },
  heroText: { color: "#D0D5DD", fontSize: 14, lineHeight: 21, marginTop: 9 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 13 },
  actionCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, padding: 18, backgroundColor: "#FFF", marginBottom: 11 },
  actionFeatured: { borderColor: "#C7D2FE", backgroundColor: "#EEF2FF" },
  actionTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  actionText: { color: "#667085", fontSize: 14, marginTop: 4 },
  soon: { color: "#667085", fontSize: 11, fontWeight: "700", marginTop: 13, letterSpacing: 0.5 },
  openLabel: { color: "#3B5BDB", fontSize: 11, fontWeight: "800", marginTop: 13, letterSpacing: 0.5 },
  signOut: { alignSelf: "center", marginTop: 16, padding: 12 },
  signOutText: { color: "#667085", fontWeight: "700" },
});
