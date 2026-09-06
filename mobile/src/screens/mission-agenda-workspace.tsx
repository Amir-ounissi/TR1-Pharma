import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { BrandContext } from "../../App";
import { supabase } from "../lib/supabase";

type Mode = "missions" | "agenda";

type Mission = {
  id: string;
  title: string;
  status: string;
  missionType: string | null;
  scheduledStartAt: string | null;
  reportDueAt: string | null;
  proposalReviewStatus: string | null;
  pharmacyName: string;
  city: string | null;
};

type MissionDetailData = {
  id: string;
  title: string;
  status: string;
  missionType: string | null;
  objective: string | null;
  briefing: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  reportDueAt: string | null;
  priority: string | null;
  locationMode: string | null;
  pharmacyName: string;
  city: string | null;
  postalCode: string | null;
};

type AgendaEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  event_type: string;
  title: string;
  start_at: string;
  end_at: string;
  pharmacy_name: string | null;
  city: string | null;
  status: string;
  priority: string;
};

type BacklogItem = {
  item_key: string;
  source_kind: string;
  source_id: string;
  title: string;
  pharmacy_name: string | null;
  brand_name: string;
  due_at: string | null;
  status: string;
  priority: string;
};

export function MissionAgendaWorkspace({ brand, mode, onBack }: { brand: BrandContext; mode: Mode; onBack: () => void }) {
  return mode === "missions" ? <MissionList brand={brand} onBack={onBack} /> : <AgendaDay brand={brand} onBack={onBack} />;
}

function MissionList({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Votre session TR1 a expiré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("missions")
      .select("id,title,status,mission_type,scheduled_start_at,report_due_at,proposal_review_status,pharmacies(trade_name,legal_name,city)")
      .eq("brand_id", brand.id)
      .eq("assigned_user_id", userId)
      .is("archived_at", null)
      .order("scheduled_start_at", { ascending: true, nullsFirst: false })
      .limit(40);

    if (queryError) {
      setError("Impossible de charger vos missions.");
      setMissions([]);
    } else {
      setMissions((data ?? []).map((row) => {
        const pharmacy = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
        return {
          id: String(row.id),
          title: String(row.title),
          status: String(row.status),
          missionType: typeof row.mission_type === "string" ? row.mission_type : null,
          scheduledStartAt: typeof row.scheduled_start_at === "string" ? row.scheduled_start_at : null,
          reportDueAt: typeof row.report_due_at === "string" ? row.report_due_at : null,
          proposalReviewStatus: typeof row.proposal_review_status === "string" ? row.proposal_review_status : null,
          pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
          city: pharmacy?.city ?? null,
        };
      }));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [brand.id]);

  if (selectedMissionId) {
    return (
      <MissionDetail
        brand={brand}
        missionId={selectedMissionId}
        onBack={() => {
          setSelectedMissionId(null);
          void load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="MISSIONS" title="Vos priorités terrain" subtitle={`${brand.name} · missions qui vous sont affectées`} />
        <Pressable onPress={() => void load()} style={styles.refreshButton}><Text style={styles.refreshText}>Actualiser</Text></Pressable>
        {loading ? <Loading label="Chargement des missions…" /> : null}
        {error ? <ErrorCard message={error} /> : null}
        {!loading && !error && missions.length === 0 ? <EmptyCard title="Aucune mission active" text="Les missions affectées apparaîtront ici automatiquement." /> : null}
        {!loading && !error ? missions.map((mission) => <MissionCard key={mission.id} mission={mission} onPress={() => setSelectedMissionId(mission.id)} />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MissionDetail({ brand, missionId, onBack }: { brand: BrandContext; missionId: string; onBack: () => void }) {
  const [mission, setMission] = useState<MissionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Votre session TR1 a expiré.");
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("missions")
      .select("id,title,status,mission_type,objective,briefing,scheduled_start_at,scheduled_end_at,report_due_at,priority,location_mode,pharmacies(trade_name,legal_name,city,postal_code)")
      .eq("id", missionId)
      .eq("brand_id", brand.id)
      .eq("assigned_user_id", userId)
      .is("archived_at", null)
      .maybeSingle();

    if (queryError || !data) {
      setMission(null);
      setError("Cette mission n’est pas disponible dans votre périmètre terrain.");
      setLoading(false);
      return;
    }

    const pharmacy = Array.isArray(data.pharmacies) ? data.pharmacies[0] : data.pharmacies;
    setMission({
      id: String(data.id),
      title: String(data.title),
      status: String(data.status),
      missionType: typeof data.mission_type === "string" ? data.mission_type : null,
      objective: typeof data.objective === "string" ? data.objective : null,
      briefing: typeof data.briefing === "string" ? data.briefing : null,
      scheduledStartAt: typeof data.scheduled_start_at === "string" ? data.scheduled_start_at : null,
      scheduledEndAt: typeof data.scheduled_end_at === "string" ? data.scheduled_end_at : null,
      reportDueAt: typeof data.report_due_at === "string" ? data.report_due_at : null,
      priority: typeof data.priority === "string" ? data.priority : null,
      locationMode: typeof data.location_mode === "string" ? data.location_mode : null,
      pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
      city: pharmacy?.city ?? null,
      postalCode: pharmacy?.postal_code ?? null,
    });
    setLoading(false);
  }

  useEffect(() => { void load(); }, [brand.id, missionId]);

  async function changeStatus(targetStatus: string) {
    const requiresReason = targetStatus === "rejected" || targetStatus === "no_show";
    if (requiresReason && !reason.trim()) {
      setError("Ajoutez un motif avant de refuser la mission ou de signaler une absence.");
      return;
    }

    setPendingStatus(targetStatus);
    setError(null);
    setSuccess(null);
    const { error: transitionError } = await supabase.rpc("change_mission_status", {
      target_mission_id: missionId,
      target_status: targetStatus,
      reason: reason.trim() || null,
    });

    if (transitionError) {
      setError(transitionError.message || "La transition de mission a été refusée.");
    } else {
      setReason("");
      setSuccess("Statut mis à jour.");
      await load();
    }
    setPendingStatus(null);
  }

  const transitions = mission ? transitionsForStatus(mission.status) : [];
  const needsReason = transitions.some((status) => status === "rejected" || status === "no_show");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header onBack={onBack} eyebrow="MISSION" title={mission?.title || "Détail de mission"} subtitle={mission ? `${mission.pharmacyName}${mission.city ? ` · ${mission.city}` : ""}` : brand.name} />

        {loading ? <Loading label="Chargement de la mission…" /> : null}
        {error ? <ErrorCard message={error} /> : null}
        {success ? <View style={styles.successCard}><Text style={styles.successText}>{success}</Text></View> : null}

        {!loading && mission ? (
          <>
            <View style={styles.detailSummary}>
              <DetailRow label="Statut" value={label(mission.status)} />
              <DetailRow label="Type" value={mission.missionType ? label(mission.missionType) : "—"} />
              <DetailRow label="Priorité" value={mission.priority ? label(mission.priority) : "—"} />
              <DetailRow label="Lieu" value={mission.locationMode ? label(mission.locationMode) : "—"} />
              <DetailRow label="Début" value={mission.scheduledStartAt ? formatDateTime(mission.scheduledStartAt) : "À planifier"} />
              <DetailRow label="Fin" value={mission.scheduledEndAt ? formatDateTime(mission.scheduledEndAt) : "—"} />
              {mission.reportDueAt ? <DetailRow label="Rapport attendu" value={formatDateTime(mission.reportDueAt)} /> : null}
            </View>

            <Text style={styles.sectionTitle}>Objectif</Text>
            <View style={styles.textCard}><Text style={styles.bodyText}>{mission.objective || "Aucun objectif renseigné."}</Text></View>

            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Briefing</Text>
            <View style={styles.textCard}><Text style={styles.bodyText}>{mission.briefing || "Aucun briefing."}</Text></View>

            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Pharmacie</Text>
            <View style={styles.textCard}>
              <Text style={styles.cardTitle}>{mission.pharmacyName}</Text>
              <Text style={styles.meta}>{[mission.postalCode, mission.city].filter(Boolean).join(" ") || "Localisation non renseignée"}</Text>
            </View>

            {transitions.length ? (
              <View style={styles.transitionBlock}>
                <Text style={styles.sectionTitle}>Étape suivante</Text>
                {needsReason ? (
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Motif obligatoire pour refus ou absence"
                    placeholderTextColor="#98A2B3"
                    multiline
                    style={styles.reasonInput}
                  />
                ) : null}
                <View style={styles.transitionButtons}>
                  {transitions.map((targetStatus) => (
                    <Pressable
                      key={targetStatus}
                      disabled={pendingStatus !== null}
                      onPress={() => void changeStatus(targetStatus)}
                      style={[
                        styles.transitionButton,
                        destructiveTransition(targetStatus) ? styles.transitionButtonDanger : styles.transitionButtonPrimary,
                        pendingStatus !== null && styles.disabled,
                      ]}
                    >
                      {pendingStatus === targetStatus ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.transitionButtonText}>{transitionLabel(targetStatus)}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.transitionHelp}>TR1 revérifie vos droits et la transition côté serveur avant toute modification.</Text>
              </View>
            ) : (
              <View style={styles.noticeCard}><Text style={styles.noticeTitle}>Aucune action immédiate</Text><Text style={styles.noticeText}>Cette mission n’a pas de transition terrain disponible à ce stade.</Text></View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function AgendaDay({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const date = useMemo(() => localDate(new Date()), []);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: agendaData, error: agendaError }, { data: backlogData, error: backlogError }] = await Promise.all([
      supabase.rpc("get_my_field_agenda", { start_date: date, end_date: date, brand_filter: brand.id }),
      supabase.rpc("get_my_unplanned_agenda_items", { brand_filter: brand.id }),
    ]);
    if (agendaError || backlogError) {
      setError("Impossible de charger votre agenda terrain.");
      setEvents([]);
      setBacklog([]);
    } else {
      setEvents(((agendaData ?? []) as AgendaEvent[]).sort((a, b) => a.start_at.localeCompare(b.start_at)));
      setBacklog((backlogData ?? []) as BacklogItem[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [brand.id, date]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="AGENDA" title="Aujourd’hui" subtitle={formatDay(date)} />
        <Pressable onPress={() => void load()} style={styles.refreshButton}><Text style={styles.refreshText}>Actualiser</Text></Pressable>
        {loading ? <Loading label="Chargement de l’agenda…" /> : null}
        {error ? <ErrorCard message={error} /> : null}
        {!loading && !error ? (
          <>
            <Text style={styles.sectionTitle}>Planning</Text>
            {events.length === 0 ? <EmptyCard title="Aucun rendez-vous aujourd’hui" text="Les visites, missions et tâches planifiées apparaîtront ici." /> : events.map((event) => <AgendaCard key={event.event_key} event={event} />)}
            <Text style={[styles.sectionTitle, styles.backlogTitle]}>À planifier</Text>
            {backlog.length === 0 ? <EmptyCard title="Rien en attente" text="Votre backlog terrain est à jour." /> : backlog.slice(0, 12).map((item) => <BacklogCard key={item.item_key} item={item} />)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, eyebrow, title, subtitle }: { onBack: () => void; eyebrow: string; title: string; subtitle: string }) {
  return (
    <>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </>
  );
}

function MissionCard({ mission, onPress }: { mission: Mission; onPress: () => void }) {
  const reviewStatus = mission.proposalReviewStatus && mission.proposalReviewStatus !== "not_applicable" ? mission.proposalReviewStatus : mission.status;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}><Text style={styles.cardTitle}>{mission.title}</Text><Badge label={label(reviewStatus)} danger={reviewStatus === "report_pending"} /></View>
      <Text style={styles.when}>{mission.scheduledStartAt ? formatDateTime(mission.scheduledStartAt) : "À planifier"}</Text>
      <Text style={styles.meta}>{mission.pharmacyName}{mission.city ? ` · ${mission.city}` : ""}</Text>
      {mission.missionType ? <Text style={styles.smallMeta}>{label(mission.missionType)}</Text> : null}
      {mission.reportDueAt ? <Text style={styles.reportDue}>Rapport attendu : {formatDateTime(mission.reportDueAt)}</Text> : null}
      <Text style={styles.openDetail}>OUVRIR LA MISSION</Text>
    </Pressable>
  );
}

function AgendaCard({ event }: { event: AgendaEvent }) {
  return (
    <View style={styles.card}>
      <View style={styles.timeRow}><Text style={styles.time}>{formatTime(event.start_at)}</Text><Badge label={label(event.source_kind)} /></View>
      <Text style={styles.cardTitle}>{event.title}</Text>
      <Text style={styles.meta}>{event.pharmacy_name || "Terrain"}{event.city ? ` · ${event.city}` : ""}</Text>
      <Text style={styles.smallMeta}>{label(event.status)} · priorité {label(event.priority)}</Text>
    </View>
  );
}

function BacklogCard({ item }: { item: BacklogItem }) {
  return (
    <View style={styles.backlogCard}>
      <View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.pharmacy_name || "Terrain"}</Text><Text style={styles.smallMeta}>{item.due_at ? `Échéance ${formatDateTime(item.due_at)}` : "Sans horaire"}</Text></View>
      <Badge label={label(item.priority)} />
    </View>
  );
}

function DetailRow({ label: rowLabel, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{rowLabel}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function transitionsForStatus(status: string) {
  if (status === "assigned") return ["accepted", "rejected"];
  if (status === "scheduled") return ["in_progress", "no_show"];
  return [];
}

function transitionLabel(status: string) {
  if (status === "accepted") return "Accepter la mission";
  if (status === "rejected") return "Refuser";
  if (status === "in_progress") return "Démarrer la mission";
  if (status === "no_show") return "Signaler une absence";
  return label(status);
}

function destructiveTransition(status: string) { return status === "rejected" || status === "no_show"; }
function Badge({ label: text, danger = false }: { label: string; danger?: boolean }) { return <View style={[styles.badge, danger && styles.badgeDanger]}><Text style={[styles.badgeText, danger && styles.badgeDangerText]}>{text}</Text></View>; }
function Loading({ label: text }: { label: string }) { return <View style={styles.loading}><ActivityIndicator color="#3B5BDB" /><Text style={styles.loadingText}>{text}</Text></View>; }
function ErrorCard({ message }: { message: string }) { return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text></View>; }
function EmptyCard({ title, text }: { title: string; text: string }) { return <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>; }
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDay(value: string) { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function label(value: string) { return value.replaceAll("_", " "); }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#F7F8FA" }, page: { padding: 22, paddingBottom: 42 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 16 }, backText: { fontSize: 31, lineHeight: 33, color: "#111827" },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 5 }, subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 16 },
  refreshButton: { alignSelf: "flex-start", backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 18 }, refreshText: { color: "#3B5BDB", fontWeight: "800", fontSize: 12 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "800", marginBottom: 10 }, sectionSpacing: { marginTop: 18 }, backlogTitle: { marginTop: 18 },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, padding: 16, marginBottom: 10 }, cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }, cardTitle: { flex: 1, color: "#111827", fontSize: 15, lineHeight: 20, fontWeight: "800" }, when: { color: "#344054", fontSize: 13, fontWeight: "700", marginTop: 9 }, meta: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 4 }, smallMeta: { color: "#667085", fontSize: 11, lineHeight: 17, marginTop: 5 }, reportDue: { color: "#B54708", fontSize: 11, fontWeight: "700", marginTop: 8 }, openDetail: { color: "#3B5BDB", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 11 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }, time: { color: "#3B5BDB", fontSize: 18, fontWeight: "800" },
  backlogCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 16, padding: 14, marginBottom: 9 },
  badge: { borderRadius: 99, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: "#3B5BDB", fontSize: 9, fontWeight: "800" }, badgeDanger: { backgroundColor: "#FEF3F2" }, badgeDangerText: { color: "#B42318" },
  loading: { alignItems: "center", paddingVertical: 28, gap: 10 }, loadingText: { color: "#667085", fontSize: 13 }, errorCard: { borderRadius: 16, backgroundColor: "#FEF3F2", padding: 15, marginBottom: 12 }, errorText: { color: "#B42318", fontSize: 13, lineHeight: 19 }, successCard: { borderRadius: 16, backgroundColor: "#ECFDF3", padding: 14, marginBottom: 12 }, successText: { color: "#067647", fontSize: 13, fontWeight: "700" },
  emptyCard: { borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 20, marginBottom: 10 }, emptyTitle: { color: "#111827", fontSize: 15, fontWeight: "800" }, emptyText: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 5 },
  detailSummary: { borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 16, marginBottom: 20 }, detailRow: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" }, detailLabel: { color: "#667085", fontSize: 12 }, detailValue: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "700", textAlign: "right" },
  textCard: { borderRadius: 16, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 16 }, bodyText: { color: "#344054", fontSize: 13, lineHeight: 20 },
  transitionBlock: { marginTop: 22 }, reasonInput: { minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 13, paddingVertical: 11, color: "#111827", fontSize: 13, textAlignVertical: "top", marginBottom: 10 }, transitionButtons: { gap: 9 }, transitionButton: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 }, transitionButtonPrimary: { backgroundColor: "#3B5BDB" }, transitionButtonDanger: { backgroundColor: "#B42318" }, transitionButtonText: { color: "#FFF", fontSize: 14, fontWeight: "800" }, transitionHelp: { color: "#667085", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 9 }, disabled: { opacity: 0.45 },
  noticeCard: { marginTop: 20, borderRadius: 16, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 16 }, noticeTitle: { color: "#111827", fontSize: 14, fontWeight: "800" }, noticeText: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 5 },
});
