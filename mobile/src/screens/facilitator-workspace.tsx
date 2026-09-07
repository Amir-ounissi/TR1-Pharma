import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
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

type MissionSource = "tr1" | "private";
type MissionType = "animation" | "training" | "merchandising" | "other";
type EvidenceKind = "merch_before" | "merch_after" | "merch_detail" | "merch_plv" | "cash_register";

type WorkspaceMission = {
  source: MissionSource;
  id: string;
  brandId: string | null;
  brandName: string;
  title: string;
  missionType: string;
  status: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  pharmacyName: string;
  city: string | null;
  objective: string | null;
  interactionsCount: number;
  unitsSoldDeclared: number;
  participantsCount: number;
  notes: string;
};

type Evidence = {
  id: string;
  kind: EvidenceKind;
  name: string;
  status: string | null;
  createdAt: string;
};

const MISSION_TYPES: Array<{ value: MissionType; label: string }> = [
  { value: "animation", label: "Animation" },
  { value: "training", label: "Formation" },
  { value: "merchandising", label: "Merchandising" },
  { value: "other", label: "Autre" },
];

export function FacilitatorWorkspace({
  brand,
  onBack,
  onOpenTr1Mission,
}: {
  brand: BrandContext;
  onBack: () => void;
  onOpenTr1Mission: (missionId: string) => void;
}) {
  const [missions, setMissions] = useState<WorkspaceMission[]>([]);
  const [selected, setSelected] = useState<WorkspaceMission | null>(null);
  const [creating, setCreating] = useState(false);
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

    const [tr1Result, privateResult] = await Promise.all([
      supabase
        .from("missions")
        .select("id,brand_id,title,status,mission_type,objective,scheduled_start_at,scheduled_end_at,brands(name),pharmacies(trade_name,legal_name,city)")
        .eq("assigned_user_id", userId)
        .is("archived_at", null)
        .order("scheduled_start_at", { ascending: true, nullsFirst: false })
        .limit(60),
      supabase
        .from("personal_field_missions")
        .select("id,title,status,mission_type,brand_name,pharmacy_name,city,objective,scheduled_start_at,scheduled_end_at,interactions_count,units_sold_declared,participants_count,notes")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("scheduled_start_at", { ascending: true })
        .limit(60),
    ]);

    if (tr1Result.error || privateResult.error) {
      setError(tr1Result.error?.message || privateResult.error?.message || "Impossible de charger l’activité animateur.");
      setLoading(false);
      return;
    }

    const tr1Missions: WorkspaceMission[] = (tr1Result.data ?? []).map((row) => {
      const pharmacy = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
      const missionBrand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
      return {
        source: "tr1",
        id: String(row.id),
        brandId: String(row.brand_id),
        brandName: missionBrand?.name || "Marque TR1",
        title: String(row.title),
        missionType: String(row.mission_type || "other"),
        status: String(row.status),
        scheduledStartAt: typeof row.scheduled_start_at === "string" ? row.scheduled_start_at : "9999-12-31T23:59:59.000Z",
        scheduledEndAt: typeof row.scheduled_end_at === "string" ? row.scheduled_end_at : null,
        pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
        city: pharmacy?.city ?? null,
        objective: typeof row.objective === "string" ? row.objective : null,
        interactionsCount: 0,
        unitsSoldDeclared: 0,
        participantsCount: 0,
        notes: "",
      };
    });

    const privateMissions: WorkspaceMission[] = (privateResult.data ?? []).map((row) => ({
      source: "private",
      id: String(row.id),
      brandId: null,
      brandName: String(row.brand_name),
      title: String(row.title),
      missionType: String(row.mission_type || "other"),
      status: String(row.status),
      scheduledStartAt: String(row.scheduled_start_at),
      scheduledEndAt: typeof row.scheduled_end_at === "string" ? row.scheduled_end_at : null,
      pharmacyName: String(row.pharmacy_name),
      city: typeof row.city === "string" ? row.city : null,
      objective: typeof row.objective === "string" ? row.objective : null,
      interactionsCount: Number(row.interactions_count || 0),
      unitsSoldDeclared: Number(row.units_sold_declared || 0),
      participantsCount: Number(row.participants_count || 0),
      notes: typeof row.notes === "string" ? row.notes : "",
    }));

    setMissions([...tr1Missions, ...privateMissions].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt)));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [brand.id]);

  if (creating) {
    return <CreatePrivateMission onBack={() => setCreating(false)} onCreated={async () => { setCreating(false); await load(); }} />;
  }

  if (selected) {
    return (
      <MissionDetail
        mission={selected}
        currentBrand={brand}
        onBack={async () => { setSelected(null); await load(); }}
        onOpenTr1Mission={onOpenTr1Mission}
      />
    );
  }

  const today = localDateKey(new Date());
  const todayMissions = missions.filter((mission) => localDateKey(new Date(mission.scheduledStartAt)) === today);
  const otherMissions = missions.filter((mission) => localDateKey(new Date(mission.scheduledStartAt)) !== today);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="ANIMATEUR · FORMATEUR" title="Mon activité terrain" subtitle="Missions TR1 et missions personnelles dans un même planning." />
        <View style={styles.privateCard}>
          <Text style={styles.privateTitle}>Missions hors TR1 = espace privé</Text>
          <Text style={styles.privateText}>Aucune marque TR1 ne peut consulter ces missions, photos, notes ou sorties de caisse.</Text>
        </View>
        <Pressable onPress={() => setCreating(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>+ Ajouter une mission hors TR1</Text></Pressable>
        {loading ? <Loading label="Chargement de votre activité…" /> : null}
        {error ? <ErrorCard message={error} /> : null}
        {!loading && !error ? (
          <>
            <Text style={styles.sectionTitle}>Aujourd’hui · {todayMissions.length}</Text>
            {todayMissions.length ? todayMissions.map((mission) => <MissionCard key={`${mission.source}-${mission.id}`} mission={mission} onPress={() => setSelected(mission)} />) : <EmptyCard text="Aucune mission aujourd’hui." />}
            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Planning</Text>
            {otherMissions.length ? otherMissions.map((mission) => <MissionCard key={`${mission.source}-${mission.id}`} mission={mission} onPress={() => setSelected(mission)} />) : <EmptyCard text="Aucune autre mission planifiée." />}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CreatePrivateMission({ onBack, onCreated }: { onBack: () => void; onCreated: () => Promise<void> }) {
  const [brandName, setBrandName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [city, setCity] = useState("");
  const [missionType, setMissionType] = useState<MissionType>("animation");
  const [date, setDate] = useState(localDateKey(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!brandName.trim() || !pharmacyName.trim()) return setError("Renseignez la marque et la pharmacie.");
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return setError("Vérifiez la date et les horaires.");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) return setError("Votre session TR1 a expiré.");

    setBusy(true);
    setError(null);
    const label = MISSION_TYPES.find((item) => item.value === missionType)?.label || "Mission";
    const { error: insertError } = await supabase.from("personal_field_missions").insert({
      user_id: userData.user.id,
      mission_type: missionType,
      status: "planned",
      title: `${label} ${brandName.trim()} — ${pharmacyName.trim()}`,
      brand_name: brandName.trim(),
      pharmacy_name: pharmacyName.trim(),
      city: city.trim() || null,
      objective: objective.trim() || null,
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
    });
    setBusy(false);
    if (insertError) setError(insertError.message || "La mission n’a pas pu être créée.");
    else await onCreated();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header onBack={onBack} eyebrow="MISSION PRIVÉE" title="Ajouter une mission" subtitle="Pour une marque ou une agence hors TR1." />
        <Field label="Marque *" value={brandName} onChangeText={setBrandName} placeholder="Nom de la marque" />
        <Field label="Pharmacie *" value={pharmacyName} onChangeText={setPharmacyName} placeholder="Nom de la pharmacie" />
        <Field label="Ville" value={city} onChangeText={setCity} placeholder="Ville" />
        <View style={styles.chips}>{MISSION_TYPES.map((item) => <Chip key={item.value} label={item.label} active={missionType === item.value} onPress={() => setMissionType(item.value)} />)}</View>
        <Field label="Date" value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" />
        <View style={styles.twoColumns}><View style={styles.column}><Field label="Début" value={startTime} onChangeText={setStartTime} placeholder="09:00" /></View><View style={styles.column}><Field label="Fin" value={endTime} onChangeText={setEndTime} placeholder="17:00" /></View></View>
        <Field label="Objectif" value={objective} onChangeText={setObjective} placeholder="Objectif de la mission" multiline />
        {error ? <ErrorCard message={error} /> : null}
        <Pressable disabled={busy} onPress={() => void create()} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Créer la mission privée</Text>}</Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MissionDetail({ mission, currentBrand, onBack, onOpenTr1Mission }: { mission: WorkspaceMission; currentBrand: BrandContext; onBack: () => Promise<void>; onOpenTr1Mission: (id: string) => void }) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [status, setStatus] = useState(mission.status);
  const [interactions, setInteractions] = useState(String(mission.interactionsCount));
  const [units, setUnits] = useState(String(mission.unitsSoldDeclared));
  const [participants, setParticipants] = useState(String(mission.participantsCount));
  const [notes, setNotes] = useState(mission.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadEvidence() {
    const isPrivate = mission.source === "private";
    const query = isPrivate
      ? supabase.from("personal_field_mission_evidence").select("id,evidence_kind,original_name,analysis_status,created_at").eq("personal_mission_id", mission.id)
      : supabase.from("mission_attachments").select("id,evidence_kind,original_name,analysis_status,created_at").eq("mission_id", mission.id);
    const { data, error: queryError } = await query.not("evidence_kind", "is", null).order("created_at", { ascending: false });
    if (queryError) return setError("Les preuves terrain n’ont pas pu être chargées.");
    setEvidence((data ?? []).map((row) => ({ id: String(row.id), kind: row.evidence_kind as EvidenceKind, name: String(row.original_name), status: typeof row.analysis_status === "string" ? row.analysis_status : null, createdAt: String(row.created_at) })));
  }

  useEffect(() => { void loadEvidence(); }, [mission.id, mission.source]);

  async function updatePrivateStatus(next: "in_progress" | "completed") {
    if (mission.source !== "private") return;
    setBusy(next);
    const { error: updateError } = await supabase.from("personal_field_missions").update(next === "in_progress" ? { status: next, actual_start_at: new Date().toISOString(), updated_at: new Date().toISOString() } : { status: next, actual_end_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", mission.id);
    setBusy(null);
    if (updateError) setError(updateError.message);
    else { setStatus(next); setSuccess(next === "in_progress" ? "Mission démarrée." : "Mission terminée."); }
  }

  async function savePrivateMetrics() {
    if (mission.source !== "private") return;
    const values = [interactions, units, participants].map((value) => Number.parseInt(value || "0", 10));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return setError("Les indicateurs doivent être positifs ou nuls.");
    setBusy("metrics");
    const { error: updateError } = await supabase.from("personal_field_missions").update({ interactions_count: values[0], units_sold_declared: values[1], participants_count: values[2], notes: notes.trim() || null, updated_at: new Date().toISOString() }).eq("id", mission.id);
    setBusy(null);
    if (updateError) setError(updateError.message);
    else setSuccess("Résultats enregistrés.");
  }

  async function takePhoto(kind: EvidenceKind) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError("Autorisez l’accès à la caméra.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], cameraType: ImagePicker.CameraType.back, allowsEditing: false, quality: 0.8 });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return;
    await uploadEvidence({ kind, uri: asset.uri, name: asset.fileName || `${kind}-${Date.now()}.jpg`, mimeType: asset.mimeType || "image/jpeg" });
  }

  async function pickCashPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    await uploadEvidence({ kind: "cash_register", uri: asset.uri, name: asset.name || `sortie-caisse-${Date.now()}.pdf`, mimeType: asset.mimeType || "application/pdf" });
  }

  async function uploadEvidence(file: { kind: EvidenceKind; uri: string; name: string; mimeType: string }) {
    setBusy(file.kind);
    setError(null);
    setSuccess(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Votre session TR1 a expiré.");
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error("Fichier inaccessible.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength <= 0 || bytes.byteLength > 10485760) throw new Error("Le fichier doit faire moins de 10 Mo.");
      const isPrivate = mission.source === "private";
      const bucket = isPrivate ? "personal-field-evidence" : "mission-evidence";
      const objectPath = isPrivate ? `${userId}/${mission.id}/${Date.now()}-${safeFileName(file.name)}` : `${mission.brandId}/${mission.id}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: storageError } = await supabase.storage.from(bucket).upload(objectPath, bytes, { contentType: file.mimeType, upsert: false });
      if (storageError) throw storageError;
      const analysisStatus = file.kind === "cash_register" ? "pending" : "confirmed";

      if (isPrivate) {
        const { error: insertError } = await supabase.from("personal_field_mission_evidence").insert({ user_id: userId, personal_mission_id: mission.id, evidence_kind: file.kind, bucket_id: bucket, object_path: objectPath, original_name: file.name, mime_type: file.mimeType, size_bytes: bytes.byteLength, analysis_status: analysisStatus, extracted_data: {} });
        if (insertError) { await supabase.storage.from(bucket).remove([objectPath]); throw insertError; }
      } else {
        const { error: insertError } = await supabase.from("mission_attachments").insert({ mission_id: mission.id, brand_id: mission.brandId, bucket_id: bucket, object_path: objectPath, original_name: file.name, mime_type: file.mimeType, size_bytes: bytes.byteLength, visibility: "shared", uploaded_by: userId, evidence_kind: file.kind, analysis_status: analysisStatus, extracted_data: {} });
        if (insertError) { await supabase.storage.from(bucket).remove([objectPath]); throw insertError; }
      }
      setSuccess(file.kind === "cash_register" ? (isPrivate ? "Sortie de caisse conservée dans votre espace privé." : "Sortie de caisse ajoutée. Utilisez « Analyser une sortie de caisse » pour le rapprochement sell-out.") : "Preuve merchandising ajoutée.");
      await loadEvidence();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "La preuve n’a pas pu être ajoutée.");
    } finally {
      setBusy(null);
    }
  }

  const cashCount = useMemo(() => evidence.filter((item) => item.kind === "cash_register").length, [evidence]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header onBack={() => void onBack()} eyebrow={mission.source === "private" ? "MISSION PRIVÉE" : "MISSION TR1"} title={mission.brandName} subtitle={`${mission.pharmacyName}${mission.city ? ` · ${mission.city}` : ""}`} />
        <View style={styles.detailCard}><View style={styles.badgeRow}><Badge text={mission.source === "private" ? "Privée" : "TR1"} /><Badge text={missionTypeLabel(mission.missionType)} /></View><Text style={styles.detailTitle}>{mission.title}</Text><Text style={styles.meta}>{formatDateTime(mission.scheduledStartAt)} · {statusLabel(status)}</Text>{mission.objective ? <Text style={styles.objective}>{mission.objective}</Text> : null}</View>
        {error ? <ErrorCard message={error} /> : null}
        {success ? <View style={styles.successCard}><Text style={styles.successText}>{success}</Text></View> : null}

        {mission.source === "private" ? <>
          <Text style={styles.sectionTitle}>Résultats</Text>
          {status === "planned" ? <Pressable disabled={busy !== null} onPress={() => void updatePrivateStatus("in_progress")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Démarrer la mission</Text></Pressable> : null}
          <Metric label="Interactions" value={interactions} onChange={setInteractions} /><Metric label="Ventes déclarées" value={units} onChange={setUnits} /><Metric label="Participants formés" value={participants} onChange={setParticipants} />
          <Field label="Notes terrain" value={notes} onChangeText={setNotes} placeholder="Objections, retours équipe, opportunités…" multiline />
          <Pressable disabled={busy !== null} onPress={() => void savePrivateMetrics()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Enregistrer les résultats</Text></Pressable>
          {status === "in_progress" ? <Pressable disabled={busy !== null} onPress={() => void updatePrivateStatus("completed")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Terminer la mission</Text></Pressable> : null}
        </> : <><Text style={styles.sectionTitle}>Mission TR1</Text>{mission.brandId === currentBrand.id ? <Pressable onPress={() => onOpenTr1Mission(mission.id)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Ouvrir le brief et le rapport TR1</Text></Pressable> : <EmptyCard text={`Mission ${mission.brandName} : changez de marque pour ouvrir le brief complet.`} />}</>}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Merchandising</Text>
        <EvidenceAction title="Photo avant" subtitle="Implantation avant animation" busy={busy === "merch_before"} onPress={() => void takePhoto("merch_before")} />
        <EvidenceAction title="Photo après" subtitle="Implantation finale" busy={busy === "merch_after"} onPress={() => void takePhoto("merch_after")} />
        <EvidenceAction title="Détail / PLV" subtitle="Facing, meuble ou PLV" busy={busy === "merch_detail"} onPress={() => void takePhoto("merch_detail")} />

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Sortie de caisse</Text>
        <Text style={styles.helpText}>{mission.source === "private" ? "La preuve reste privée et n’est pas envoyée aux marques TR1." : "La preuve est rattachée à la mission. L’analyse structurée se fait depuis l’action Sell-out de l’accueil animateur."}</Text>
        <View style={styles.twoColumns}><View style={styles.column}><Pressable disabled={busy !== null} onPress={() => void takePhoto("cash_register")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Photo</Text></Pressable></View><View style={styles.column}><Pressable disabled={busy !== null} onPress={() => void pickCashPdf()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>PDF</Text></Pressable></View></View>
        {cashCount ? <EmptyCard text={`${cashCount} sortie${cashCount > 1 ? "s" : ""} de caisse conservée${cashCount > 1 ? "s" : ""}.`} /> : null}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Pièces terrain · {evidence.length}</Text>
        {evidence.length ? evidence.map((item) => <View key={item.id} style={styles.evidenceRow}><View style={styles.flex}><Text style={styles.evidenceTitle}>{evidenceLabel(item.kind)}</Text><Text style={styles.evidenceMeta}>{item.name} · {formatDateTime(item.createdAt)}</Text></View><Badge text={analysisLabel(item.status)} /></View>) : <EmptyCard text="Aucune preuve ajoutée." />}
      </ScrollView>
    </SafeAreaView>
  );
}

function MissionCard({ mission, onPress }: { mission: WorkspaceMission; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.missionCard}><View style={styles.badgeRow}><Badge text={mission.source === "private" ? "Privée" : "TR1"} /><Badge text={missionTypeLabel(mission.missionType)} /></View><Text style={styles.missionTime}>{formatDateTime(mission.scheduledStartAt)}</Text><Text style={styles.missionBrand}>{mission.brandName}</Text><Text style={styles.meta}>{mission.pharmacyName}{mission.city ? ` · ${mission.city}` : ""}</Text></Pressable>; }
function EvidenceAction({ title, subtitle, busy, onPress }: { title: string; subtitle: string; busy: boolean; onPress: () => void }) { return <Pressable disabled={busy} onPress={onPress} style={[styles.evidenceAction, busy && styles.disabled]}><View style={styles.flex}><Text style={styles.evidenceTitle}>{title}</Text><Text style={styles.evidenceMeta}>{subtitle}</Text></View>{busy ? <ActivityIndicator /> : <Text style={styles.plus}>＋</Text>}</Pressable>; }
function Header({ onBack, eyebrow, title, subtitle }: { onBack: () => void; eyebrow: string; title: string; subtitle: string }) { return <><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>← Retour</Text></Pressable><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></>; }
function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>; }
function Metric({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={styles.metric}><Text style={styles.label}>{label}</Text><TextInput keyboardType="number-pad" value={value} onChangeText={onChange} style={styles.metricInput} /></View>; }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function Badge({ text }: { text: string }) { return <View style={styles.badge}><Text style={styles.badgeText}>{text}</Text></View>; }
function Loading({ label }: { label: string }) { return <View style={styles.loading}><ActivityIndicator /><Text style={styles.meta}>{label}</Text></View>; }
function EmptyCard({ text }: { text: string }) { return <View style={styles.notice}><Text style={styles.noticeText}>{text}</Text></View>; }
function ErrorCard({ message }: { message: string }) { return <View style={styles.error}><Text style={styles.errorText}>{message}</Text></View>; }
function safeFileName(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120) || "preuve"; }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function missionTypeLabel(value: string) { return ({ animation: "Animation", training: "Formation", merchandising: "Merchandising", other: "Autre" } as Record<string, string>)[value] || value.replaceAll("_", " "); }
function statusLabel(value: string) { return ({ planned: "Planifiée", requested: "Demandée", assigned: "Affectée", accepted: "Acceptée", scheduled: "Planifiée", in_progress: "En cours", report_pending: "Rapport attendu", completed: "Terminée", cancelled: "Annulée", rejected: "Refusée", no_show: "Absence" } as Record<string, string>)[value] || value; }
function evidenceLabel(value: EvidenceKind) { return ({ merch_before: "Merch avant", merch_after: "Merch après", merch_detail: "Détail merch", merch_plv: "PLV", cash_register: "Sortie de caisse" } as Record<EvidenceKind, string>)[value]; }
function analysisLabel(value: string | null) { return ({ pending: "En attente", needs_review: "À vérifier", partial: "Partiel", confirmed: "Lecture validée", failed: "Échec" } as Record<string, string>)[value || ""] || "Ajoutée"; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#F7F8FA" }, page: { padding: 22, paddingBottom: 44 },
  back: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: 12 }, backText: { color: "#3B5BDB", fontWeight: "800", fontSize: 13 }, eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 5 }, subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  privateCard: { padding: 15, borderRadius: 15, backgroundColor: "#F2F4F7", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 14 }, privateTitle: { color: "#344054", fontWeight: "800", fontSize: 13 }, privateText: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 11 }, sectionSpacing: { marginTop: 24 }, helpText: { color: "#667085", fontSize: 13, lineHeight: 18, marginTop: -4, marginBottom: 12 },
  missionCard: { padding: 16, borderRadius: 17, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", marginBottom: 9 }, missionTime: { color: "#667085", fontSize: 11, fontWeight: "700" }, missionBrand: { color: "#111827", fontSize: 16, fontWeight: "800", marginTop: 4 },
  detailCard: { padding: 17, borderRadius: 17, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", marginBottom: 14 }, detailTitle: { color: "#111827", fontSize: 17, lineHeight: 23, fontWeight: "800" }, objective: { color: "#344054", fontSize: 13, lineHeight: 19, marginTop: 10 }, meta: { color: "#667085", fontSize: 12, marginTop: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }, badge: { borderRadius: 999, backgroundColor: "#EEF2FF", paddingHorizontal: 9, paddingVertical: 4 }, badgeText: { color: "#3B5BDB", fontWeight: "800", fontSize: 10 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#3B5BDB", alignItems: "center", justifyContent: "center", paddingHorizontal: 15, marginBottom: 10 }, primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 13 }, secondaryButton: { minHeight: 47, borderRadius: 13, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, marginBottom: 9 }, secondaryButtonText: { color: "#3B5BDB", fontWeight: "800", fontSize: 12, textAlign: "center" },
  field: { marginBottom: 13 }, label: { color: "#344054", fontSize: 12, fontWeight: "800", marginBottom: 6 }, input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", paddingHorizontal: 12, color: "#111827", fontSize: 14 }, multiline: { minHeight: 88, paddingTop: 11, textAlignVertical: "top" }, metric: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", marginBottom: 8 }, metricInput: { color: "#111827", fontSize: 21, fontWeight: "800", paddingVertical: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }, chip: { borderRadius: 999, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", paddingHorizontal: 11, paddingVertical: 7 }, chipActive: { borderColor: "#A5B4FC", backgroundColor: "#EEF2FF" }, chipText: { color: "#475467", fontWeight: "700", fontSize: 11 }, chipTextActive: { color: "#3B5BDB" }, twoColumns: { flexDirection: "row", gap: 9 }, column: { flex: 1 },
  evidenceAction: { minHeight: 60, flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", padding: 13, marginBottom: 8 }, evidenceRow: { flexDirection: "row", alignItems: "center", borderRadius: 13, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", padding: 12, marginBottom: 8 }, evidenceTitle: { color: "#111827", fontSize: 13, fontWeight: "800" }, evidenceMeta: { color: "#667085", fontSize: 11, marginTop: 3 }, plus: { color: "#3B5BDB", fontSize: 21, fontWeight: "700", marginLeft: 10 },
  notice: { padding: 13, borderRadius: 13, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 10 }, noticeText: { color: "#667085", fontSize: 12, lineHeight: 18 }, error: { padding: 13, borderRadius: 13, backgroundColor: "#FEF3F2", borderWidth: 1, borderColor: "#FECDCA", marginBottom: 10 }, errorText: { color: "#B42318", fontSize: 12, lineHeight: 18 }, successCard: { padding: 13, borderRadius: 13, backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#ABEFC6", marginBottom: 10 }, successText: { color: "#067647", fontSize: 12, lineHeight: 18 }, loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 }, disabled: { opacity: 0.5 },
});