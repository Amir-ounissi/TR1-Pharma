import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { DayProgress } from "../components/day-progress";
import type { BrandContext } from "../../App";
import { refreshFieldReminders } from "../lib/field-notifications";
import { FacilitatorSellOutWorkspace } from "./facilitator-sell-out-workspace";
import { FacilitatorWorkspace } from "./facilitator-workspace";
import { ManualOrderWorkflow } from "./manual-order";
import { MissionAgendaWorkspace } from "./mission-agenda-workspace";
import { NotificationSettings } from "./notification-settings";
import { OrderHistoryWorkspace } from "./order-history";
import { OrderWorkflow } from "./order-workflow";
import { PharmacyWorkspace } from "./pharmacy-workspace";

type Route = "home" | "facilitator" | "facilitatorSellOut" | "pharmacies" | "orders" | "manualOrder" | "orderHistory" | "missions" | "agenda" | "notifications";

type Props = {
  brand: BrandContext;
  canSwitchBrand: boolean;
  onSwitchBrand: () => void;
  onSignOut: () => Promise<void>;
};

export function FieldWorkspace({ brand, canSwitchBrand, onSwitchBrand, onSignOut }: Props) {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const canOrder = ["agent", "tr1_manager", "brand_admin", "super_admin"].includes(brand.role);
  const [route, setRoute] = useState<Route>("home");

  useEffect(() => {
    void refreshFieldReminders(brand.id).catch(() => undefined);
  }, [brand.id]);

  if (route === "pharmacies") return <PharmacyWorkspace brand={brand} onBack={() => setRoute("home")} />;
  if (route === "orders") return <OrderWorkflow brand={brand} onBack={() => setRoute("home")} onDone={() => setRoute("home")} />;
  if (route === "manualOrder") return <ManualOrderWorkflow brand={brand} onBack={() => setRoute("home")} onDone={() => setRoute("home")} />;
  if (route === "orderHistory") return <OrderHistoryWorkspace brand={brand} onBack={() => setRoute("home")} />;
  if (route === "facilitatorSellOut") return <FacilitatorSellOutWorkspace brand={brand} onBack={() => setRoute("home")} />;
  if (route === "facilitator") return (
    <FacilitatorWorkspace
      brand={brand}
      onBack={() => setRoute("home")}
      onOpenTr1Mission={(missionId) => {
        setSelectedMissionId(missionId);
        setRoute("missions");
      }}
    />
  );
  if (route === "missions") return <MissionAgendaWorkspace brand={brand} mode="missions" initialMissionId={selectedMissionId} onBack={() => setRoute("home")} />;
  if (route === "agenda") return <MissionAgendaWorkspace brand={brand} mode="agenda" onBack={() => setRoute("home")} />;
  if (route === "notifications") return <NotificationSettings brand={brand} onBack={() => setRoute("home")} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>TR1 TERRAIN</Text>
            <Text style={styles.title}>{brand.name}</Text>
            <Text style={styles.meta}>{brand.role === "facilitator" ? "Intervenant terrain" : brand.role === "agent" ? "Commercial" : "Espace terrain"}</Text>
          </View>
          {canSwitchBrand ? <Pressable onPress={onSwitchBrand} style={styles.smallButton}><Text style={styles.smallButtonText}>Changer</Text></Pressable> : null}
        </View>

        <DayProgress brandId={brand.id} onOpen={(event) => {
          if (event.source_kind === "mission") { setSelectedMissionId(event.source_id); setRoute("missions"); }
          else setRoute("agenda");
        }} />

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        {brand.role === "facilitator" ? (
          <>
            <Action
              title="Mon activité animateur"
              text="Missions TR1 et privées, preuves merchandising et sorties de caisse"
              label="OUVRIR MON ESPACE"
              featured
              onPress={() => setRoute("facilitator")}
            />
            <Action
              title="Analyser une sortie de caisse"
              text="Mission TR1 → photo/PDF → extraction → correction → validation humaine"
              label="ANALYSER LE SELL-OUT"
              onPress={() => setRoute("facilitatorSellOut")}
            />
          </>
        ) : null}
        {canOrder ? <>
        <Action title="Scanner une commande" text="Photo → analyse → correction → validation" label="OUVRIR LA CAMÉRA" featured onPress={() => setRoute("orders")} />
        <Action title="Saisir une commande" text="Pharmacie → produits → revue → validation explicite" label="SAISIE MANUELLE" onPress={() => setRoute("manualOrder")} />
        <Action title="Historique commandes" text="Statuts, corrections, montants et détail produits" label="CONSULTER" onPress={() => setRoute("orderHistory")} />
        </> : null}
        <Action title="Pharmacies" text="Portefeuille, recherche et fiche compte" label="OUVRIR" onPress={() => setRoute("pharmacies")} />
        <Action title="Missions" text="Animations et priorités qui vous sont affectées" label="OUVRIR" onPress={() => { setSelectedMissionId(null); setRoute("missions"); }} />
        <Action title="Agenda" text="Planning du jour et éléments à planifier" label="OUVRIR" onPress={() => setRoute("agenda")} />
        <Action title="Rappels terrain" text="Notifications locales synchronisées avec votre agenda" label="RÉGLER" onPress={() => setRoute("notifications")} />

        <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ title, text, label, onPress, featured = false }: { title: string; text: string; label: string; onPress: () => void; featured?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.actionCard, featured && styles.actionFeatured]}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionText}>{text}</Text>
      <Text style={styles.openLabel}>{label}</Text>
    </Pressable>
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
  openLabel: { color: "#3B5BDB", fontSize: 11, fontWeight: "800", marginTop: 13, letterSpacing: 0.5 },
  signOut: { alignSelf: "center", marginTop: 16, padding: 12 },
  signOutText: { color: "#667085", fontWeight: "700" },
});