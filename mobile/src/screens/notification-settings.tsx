import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BrandContext } from "../../App";
import {
  disableFieldReminders,
  enableFieldReminders,
  getFieldReminderState,
  refreshFieldReminders,
  type FieldReminderState,
} from "../lib/field-notifications";

export function NotificationSettings({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const [state, setState] = useState<FieldReminderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFieldReminderState(brand.id)
      .then((value) => { if (!cancelled) setState(value); })
      .catch(() => { if (!cancelled) setError("Impossible de lire les réglages de notifications."); });
    return () => { cancelled = true; };
  }, [brand.id]);

  async function activate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await enableFieldReminders(brand.id);
      setState(next);
      setMessage(`${next.scheduledCount} rappel(s) terrain programmé(s) pour les 7 prochains jours.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const count = await refreshFieldReminders(brand.id);
      const next = await getFieldReminderState(brand.id);
      setState({ ...next, scheduledCount: count });
      setMessage(`${count} rappel(s) resynchronisé(s) avec l’agenda TR1.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await disableFieldReminders(brand.id);
      setState(next);
      setMessage("Rappels terrain désactivés sur ce téléphone.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
        <Text style={styles.title}>Rappels terrain</Text>
        <Text style={styles.subtitle}>{brand.name} · rappels locaux basés sur votre agenda TR1.</Text>

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
        {message ? <View style={styles.successCard}><Text style={styles.successText}>{message}</Text></View> : null}

        <View style={styles.statusCard}>
          <Row label="Rappels" value={state?.enabled ? "Activés" : "Désactivés"} />
          <Row label="Permission téléphone" value={permissionLabel(state?.permission)} />
          <Row label="Rappels programmés" value={String(state?.scheduledCount ?? 0)} />
          <Row label="Fenêtre" value="7 prochains jours" />
          <Row label="Préavis" value="30 minutes" />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Fonctionnement MVP</Text>
          <Text style={styles.infoText}>TR1 programme uniquement des notifications locales à partir de votre agenda accessible. Aucune clé serveur, aucun token push et aucune donnée supplémentaire ne sont écrits dans Supabase.</Text>
          <Text style={styles.infoText}>Les rappels sont resynchronisés à l’ouverture de l’espace terrain lorsque l’option est activée.</Text>
        </View>

        {!state?.enabled ? (
          <Pressable disabled={busy} onPress={() => void activate()} style={[styles.primaryButton, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Activer les rappels terrain</Text>}
          </Pressable>
        ) : (
          <>
            <Pressable disabled={busy} onPress={() => void sync()} style={[styles.primaryButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Resynchroniser maintenant</Text>}
            </Pressable>
            <Pressable disabled={busy} onPress={() => void deactivate()} style={[styles.secondaryButton, busy && styles.disabled]}>
              <Text style={styles.secondaryButtonText}>Désactiver les rappels</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

function permissionLabel(value?: string) {
  if (value === "granted") return "Autorisée";
  if (value === "denied") return "Refusée";
  if (value === "undetermined") return "À demander";
  return "Inconnue";
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Une erreur TR1 est survenue.";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 46 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 16 },
  backText: { fontSize: 31, lineHeight: 33, color: "#111827" },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 5 },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  statusCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 15, marginBottom: 16 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  rowLabel: { color: "#667085", fontSize: 12 },
  rowValue: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "800", textAlign: "right" },
  infoCard: { borderRadius: 17, backgroundColor: "#EFF8FF", borderWidth: 1, borderColor: "#B2DDFF", padding: 15, marginBottom: 12 },
  infoTitle: { color: "#175CD3", fontSize: 12, fontWeight: "800" },
  infoText: { color: "#1849A9", fontSize: 11, lineHeight: 17, marginTop: 6 },
  errorCard: { borderRadius: 15, backgroundColor: "#FEF3F2", padding: 14, marginBottom: 14 },
  errorText: { color: "#B42318", fontSize: 12, lineHeight: 18 },
  successCard: { borderRadius: 15, backgroundColor: "#ECFDF3", padding: 14, marginBottom: 14 },
  successText: { color: "#067647", fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#3B5BDB", paddingHorizontal: 16, marginTop: 10 },
  primaryButtonText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  secondaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", paddingHorizontal: 16, marginTop: 10 },
  secondaryButtonText: { color: "#475467", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
