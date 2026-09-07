import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { parisDay, personalDay, type DayEvent } from "../lib/field-progress";

export function DayProgress({ brandId, onOpen }: { brandId: string; onOpen: (event: DayEvent) => void }) {
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [day, setDay] = useState(parisDay());
  useEffect(() => {
    const timer = setInterval(() => setDay(parisDay()), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { setDay(parisDay()); setRefresh(value => value + 1); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setEvents([]); setReports({});
    void (async () => {
      try {
        const result = await supabase.rpc("get_my_field_agenda", { start_date: day, end_date: day, brand_filter: brandId });
        if (result.error) throw result.error;
        const rows = (result.data ?? []) as DayEvent[];
        const ids = [...new Set(rows.filter(row => row.source_kind === "mission" && row.ownership === "mine").map(row => row.source_id))];
        const statuses: Record<string, string> = {};
        if (ids.length) {
          const response = await supabase.from("mission_reports").select("mission_id,report_status").eq("brand_id", brandId).in("mission_id", ids);
          if (response.error) throw response.error;
          for (const report of response.data ?? []) statuses[report.mission_id] = report.report_status;
        }
        if (!cancelled) { setEvents(rows); setReports(statuses); }
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [brandId, day, refresh]);
  const progress = personalDay(events, reports);
  const complete = progress.total > 0 && progress.done === progress.total;
  return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.title}>Ma journée</Text><Pressable accessibilityRole="button" accessibilityLabel="Actualiser ma journée" disabled={loading} onPress={() => setRefresh(value => value + 1)} style={styles.refresh}><Text style={styles.link}>Actualiser</Text></Pressable></View>
    <Text style={styles.caption}>{day.split("-").reverse().join("/")} · heure de Paris</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Chargement de votre progression" /> : error ? <Text accessibilityRole="alert" style={styles.error}>Progression indisponible. Vérifiez votre connexion puis actualisez. Aucune réussite n’est comptée hors connexion.</Text> : <>
      <View style={styles.score} accessibilityLiveRegion="polite">
        <Text style={styles.count}>{progress.done} / {progress.total}</Text>
        <Text style={styles.subtitle}>{complete ? "Objectif du jour atteint !" : "Visites terminées et missions validées"}</Text>
        {progress.total > 0 ? <View accessibilityRole="progressbar" accessibilityLabel="Progression des visites et missions planifiées" accessibilityValue={{ min: 0, max: progress.total, now: progress.done }} style={styles.track}><View style={[styles.fill, { width: `${100 * progress.done / progress.total}%` }]} /></View> : null}
        {progress.review > 0 ? <Text style={styles.caption}>{progress.review} rapport(s) envoyé(s), en attente de validation</Text> : null}
        {progress.rejected > 0 ? <Text style={styles.caption}>{progress.rejected} rapport(s) rejeté(s), non comptés comme réussite</Text> : null}
        <Text style={styles.caption}>Uniquement vos visites et missions planifiées aujourd’hui. Tâches et échéances restent dans l’agenda.</Text>
      </View>
      {progress.total === 0 ? <Text style={styles.subtitle}>Aucune visite ou mission planifiée aujourd’hui. Consultez l’agenda pour préparer la suite.</Text> : null}
      {progress.next ? <Pressable accessibilityRole="button" onPress={() => onOpen(progress.next!)} style={styles.next}>
        <Text style={styles.kicker}>PROCHAINE ACTION</Text><Text style={styles.nextTitle}>{progress.next.pharmacy_name || progress.next.title}</Text>
        <Text style={styles.subtitle}>{progress.next.title}</Text>
        <Text style={styles.caption}>{new Date(progress.next.start_at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}</Text>
        <Text style={styles.link}>{progress.next.source_kind === "mission" ? "Ouvrir ma mission →" : "Consulter ma visite dans l’agenda →"}</Text>
      </Pressable> : null}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginBottom: 24, gap: 10 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 27, fontWeight: "800", color: "#111827" }, refresh: { minHeight: 48, paddingHorizontal: 10, justifyContent: "center" }, link: { color: "#3048AC", fontSize: 15, fontWeight: "700" },
  score: { padding: 20, borderRadius: 22, backgroundColor: "#EFF6F2", gap: 8 }, count: { fontSize: 36, color: "#166534", fontWeight: "800" }, subtitle: { fontSize: 16, lineHeight: 23, color: "#344054" }, caption: { fontSize: 13, lineHeight: 19, color: "#475467" }, track: { height: 10, borderRadius: 5, backgroundColor: "#DCE7E0", overflow: "hidden" }, fill: { height: 10, backgroundColor: "#15803D" },
  next: { padding: 20, borderWidth: 1, borderColor: "#C7D2FE", borderRadius: 20, backgroundColor: "#FFF", gap: 8 }, kicker: { fontSize: 12, color: "#475467", fontWeight: "700" }, nextTitle: { fontSize: 21, fontWeight: "700", color: "#111827" }, error: { color: "#B42318", fontSize: 15, lineHeight: 22 },
});
