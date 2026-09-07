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
import {
  analyzeFacilitatorSellOut,
  createFacilitatorSellOutDraft,
  uploadAndSubmitFacilitatorSellOutEvidence,
  type FacilitatorEvidenceFile,
  type FacilitatorSellOutPreview,
  type FacilitatorSellOutProduct,
} from "../lib/facilitator-sell-out-api";
import { supabase } from "../lib/supabase";

type MissionChoice = {
  id: string;
  title: string;
  status: string;
  missionType: string;
  scheduledStartAt: string | null;
  pharmacyName: string;
  city: string | null;
};

type ReviewLine = {
  index: number;
  label: string | null;
  sourceProductCode: string | null;
  ean: string | null;
  product: FacilitatorSellOutProduct | null;
  candidates: FacilitatorSellOutProduct[];
  units: string;
  revenueHt: string;
  confidence: number | null;
  warning: string | null;
  query: string;
  searchResults: FacilitatorSellOutProduct[];
};

type ReviewState = {
  mission: MissionChoice;
  attachmentId: string;
  file: FacilitatorEvidenceFile;
  preview: FacilitatorSellOutPreview;
  periodStart: string;
  periodEnd: string;
  lines: ReviewLine[];
};

export function FacilitatorSellOutWorkspace({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const [missions, setMissions] = useState<MissionChoice[]>([]);
  const [selectedMission, setSelectedMission] = useState<MissionChoice | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadMissions();
  }, [brand.id]);

  async function loadMissions() {
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
      .select("id,title,status,mission_type,scheduled_start_at,pharmacies(trade_name,legal_name,city)")
      .eq("brand_id", brand.id)
      .eq("assigned_user_id", userId)
      .is("archived_at", null)
      .not("status", "in", "(cancelled,rejected,no_show)")
      .in("mission_type", ["animation", "training", "merchandising", "pharmacy_audit", "product_launch", "stock_check", "other"])
      .order("scheduled_start_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (queryError) {
      setMissions([]);
      setError("Impossible de charger vos missions éligibles au sell-out.");
      setLoading(false);
      return;
    }

    setMissions((data ?? []).map((row) => {
      const pharmacy = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
      return {
        id: String(row.id),
        title: String(row.title),
        status: String(row.status),
        missionType: String(row.mission_type),
        scheduledStartAt: typeof row.scheduled_start_at === "string" ? row.scheduled_start_at : null,
        pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
        city: pharmacy?.city ?? null,
      };
    }));
    setLoading(false);
  }

  async function persistMissionEvidence(mission: MissionChoice, file: FacilitatorEvidenceFile) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Votre session TR1 a expiré.");

    const response = await fetch(file.uri);
    if (!response.ok) throw new Error("Le document sélectionné n’est plus accessible.");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > 10485760) {
      throw new Error("La sortie de caisse doit faire moins de 10 Mo.");
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimeType)) {
      throw new Error("Utilisez une photo JPG/PNG/WebP ou un PDF.");
    }

    const objectPath = `${brand.id}/${mission.id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("mission-evidence")
      .upload(objectPath, bytes, { contentType: file.mimeType, upsert: false });
    if (uploadError) throw new Error(uploadError.message || "La preuve n’a pas pu être stockée.");

    const { data: attachment, error: insertError } = await supabase
      .from("mission_attachments")
      .insert({
        mission_id: mission.id,
        brand_id: brand.id,
        bucket_id: "mission-evidence",
        object_path: objectPath,
        original_name: file.name,
        mime_type: file.mimeType,
        size_bytes: bytes.byteLength,
        visibility: "shared",
        uploaded_by: userId,
        evidence_kind: "cash_register",
        analysis_status: "pending",
        extracted_data: {},
      })
      .select("id")
      .single();

    if (insertError || !attachment?.id) {
      await supabase.storage.from("mission-evidence").remove([objectPath]);
      throw new Error(insertError?.message || "La preuve n’a pas pu être rattachée à la mission.");
    }

    return String(attachment.id);
  }

  async function analyzeFile(mission: MissionChoice, file: FacilitatorEvidenceFile) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    let attachmentId: string | null = null;

    try {
      attachmentId = await persistMissionEvidence(mission, file);
      const preview = await analyzeFacilitatorSellOut(file, brand.id, mission.id);
      if (!preview.lines.length) throw new Error("Aucune vente exploitable n’a été détectée sur ce document.");

      const { error: updateError } = await supabase
        .from("mission_attachments")
        .update({
          analysis_status: "needs_review",
          extracted_data: { extraction: preview.extraction, warnings: preview.warnings },
        })
        .eq("id", attachmentId)
        .eq("mission_id", mission.id);
      if (updateError) throw new Error("L’analyse a réussi, mais son état n’a pas pu être enregistré.");

      setReview({
        mission,
        attachmentId,
        file,
        preview,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        lines: preview.lines.map((line) => ({
          index: line.index,
          label: line.label,
          sourceProductCode: line.sourceProductCode,
          ean: line.ean,
          product: line.product.selectedId
            ? line.product.candidates.find((item) => item.id === line.product.selectedId) ?? {
                id: line.product.selectedId,
                name: line.product.selectedName || "Produit TR1",
                sku: null,
                ean: line.ean,
                taxRate: line.taxRate,
              }
            : null,
          candidates: line.product.candidates,
          units: line.unitsSold == null ? "" : String(line.unitsSold),
          revenueHt: line.revenueHt == null ? "" : String(line.revenueHt),
          confidence: line.confidence,
          warning: line.warning,
          query: line.label || line.ean || line.sourceProductCode || "",
          searchResults: [],
        })),
      });
    } catch (analysisError) {
      if (attachmentId) {
        await supabase
          .from("mission_attachments")
          .update({ analysis_status: "failed" })
          .eq("id", attachmentId);
      }
      setError(analysisError instanceof Error ? analysisError.message : "La sortie de caisse n’a pas pu être analysée.");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const mission = selectedMission;
    if (!mission) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Autorisez l’accès à la caméra pour photographier la sortie de caisse.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
      quality: 0.9,
    });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return;

    await analyzeFile(mission, {
      uri: asset.uri,
      name: asset.fileName || `sortie-caisse-${Date.now()}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
      width: asset.width,
    });
  }

  async function pickPdf() {
    const mission = selectedMission;
    if (!mission) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return;

    await analyzeFile(mission, {
      uri: asset.uri,
      name: asset.name || `sortie-caisse-${Date.now()}.pdf`,
      mimeType: asset.mimeType || "application/pdf",
    });
  }

  async function searchProduct(lineIndex: number) {
    if (!review) return;
    const line = review.lines.find((item) => item.index === lineIndex);
    const query = line?.query.trim() ?? "";
    if (!query) return;

    setBusy(true);
    setError(null);
    const { data, error: searchError } = await supabase
      .from("products")
      .select("id,name,sku,ean,tax_rate")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null)
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10);
    setBusy(false);

    if (searchError) {
      setError("La recherche produit est indisponible.");
      return;
    }

    updateReviewLine(lineIndex, {
      searchResults: (data ?? []).map((item) => ({
        id: String(item.id),
        name: String(item.name),
        sku: typeof item.sku === "string" ? item.sku : null,
        ean: typeof item.ean === "string" ? item.ean : null,
        taxRate: item.tax_rate == null ? null : Number(item.tax_rate),
      })),
    });
  }

  function updateReviewLine(index: number, patch: Partial<ReviewLine>) {
    setReview((current) => current ? {
      ...current,
      lines: current.lines.map((line) => line.index === index ? { ...line, ...patch } : line),
    } : current);
  }

  const blockers = useMemo(() => {
    if (!review) return [] as string[];
    const values: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(review.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(review.periodEnd) || review.periodEnd < review.periodStart) {
      values.push("Période à corriger");
    }
    if (review.lines.some((line) => !line.product)) values.push("Produit(s) à identifier");
    if (review.lines.some((line) => !/^\d+$/.test(line.units) || Number(line.units) < 0)) values.push("Unités à corriger");
    if (review.lines.some((line) => {
      if (!line.revenueHt.trim()) return false;
      const value = Number(line.revenueHt.replace(",", "."));
      return !Number.isFinite(value) || value < 0;
    })) {
      values.push("CA HT à corriger");
    }
    return values;
  }, [review]);

  async function submitReview() {
    if (!review || blockers.length) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const captureId = await createFacilitatorSellOutDraft({
        brandId: brand.id,
        missionId: review.mission.id,
        missionAttachmentId: review.attachmentId,
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        extraction: review.preview.extraction,
        lines: review.lines.map((line) => ({
          productId: line.product!.id,
          sourceProductCode: line.sourceProductCode,
          ean: line.ean,
          label: line.label,
          unitsSold: Number(line.units),
          revenueHt: line.revenueHt.trim() ? Number(line.revenueHt.replace(",", ".")) : null,
          confidence: line.confidence,
        })),
      });

      await uploadAndSubmitFacilitatorSellOutEvidence({
        brandId: brand.id,
        captureId,
        file: review.file,
      });

      setSuccess("Lecture validée et relevé envoyé pour validation humaine. Il n’est pas encore qualifié « Confirmé ».");
      setReview(null);
      setSelectedMission(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Le relevé n’a pas pu être soumis.");
    } finally {
      setBusy(false);
    }
  }

  if (review) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Header
            onBack={() => setReview(null)}
            eyebrow="SELL-OUT · RELECTURE"
            title="Vérifier la sortie de caisse"
            subtitle={`${review.mission.pharmacyName} · ${brand.name}`}
          />

          <View style={styles.guardCard}>
            <Text style={styles.guardTitle}>Validation en 2 niveaux</Text>
            <Text style={styles.guardText}>Vous vérifiez la lecture du document. Le relevé reste ensuite « À valider » jusqu’à la revue TR1 / marque.</Text>
          </View>

          {review.preview.warnings.map((warning, index) => (
            <View key={`${warning}-${index}`} style={styles.warningCard}><Text style={styles.warningText}>{warning}</Text></View>
          ))}
          {error ? <ErrorCard message={error} /> : null}

          <View style={styles.twoColumns}>
            <View style={styles.column}><Field label="Du" value={review.periodStart} onChangeText={(value) => setReview({ ...review, periodStart: value })} placeholder="AAAA-MM-JJ" /></View>
            <View style={styles.column}><Field label="Au" value={review.periodEnd} onChangeText={(value) => setReview({ ...review, periodEnd: value })} placeholder="AAAA-MM-JJ" /></View>
          </View>

          <Text style={styles.sectionTitle}>Lignes détectées · {review.lines.length}</Text>
          {review.lines.map((line) => (
            <View key={line.index} style={styles.lineCard}>
              <Text style={styles.lineSource}>{line.label || line.ean || line.sourceProductCode || `Ligne ${line.index + 1}`}</Text>
              <Text style={styles.lineMeta}>{[line.ean ? `EAN ${line.ean}` : null, line.sourceProductCode ? `Code ${line.sourceProductCode}` : null].filter(Boolean).join(" · ") || "Référence source non renseignée"}</Text>
              {line.warning ? <Text style={styles.lineWarning}>{line.warning}</Text> : null}

              <Text style={styles.fieldLabel}>Produit TR1 *</Text>
              {line.product ? (
                <View style={styles.selectedProduct}>
                  <Text style={styles.selectedProductName}>{line.product.name}</Text>
                  <Pressable onPress={() => updateReviewLine(line.index, { product: null })}><Text style={styles.changeText}>Changer</Text></Pressable>
                </View>
              ) : null}

              {!line.product && line.candidates.length ? (
                <View style={styles.chips}>
                  {line.candidates.map((product) => <Chip key={product.id} label={product.name} onPress={() => updateReviewLine(line.index, { product })} />)}
                </View>
              ) : null}

              {!line.product ? (
                <>
                  <View style={styles.searchRow}>
                    <TextInput
                      value={line.query}
                      onChangeText={(value) => updateReviewLine(line.index, { query: value })}
                      placeholder="Rechercher le produit"
                      placeholderTextColor="#98A2B3"
                      style={[styles.input, styles.searchInput]}
                    />
                    <Pressable disabled={busy} onPress={() => void searchProduct(line.index)} style={styles.searchButton}><Text style={styles.searchButtonText}>Chercher</Text></Pressable>
                  </View>
                  {line.searchResults.length ? (
                    <View style={styles.chips}>
                      {line.searchResults.map((product) => <Chip key={product.id} label={product.name} onPress={() => updateReviewLine(line.index, { product })} />)}
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Unités vendues *" value={line.units} onChangeText={(value) => updateReviewLine(line.index, { units: value.replace(/[^0-9]/g, "") })} placeholder="0" keyboardType="number-pad" /></View>
                <View style={styles.column}><Field label="CA HT" value={line.revenueHt} onChangeText={(value) => updateReviewLine(line.index, { revenueHt: value.replace(/[^0-9,.]/g, "") })} placeholder="Optionnel" keyboardType="decimal-pad" /></View>
              </View>
            </View>
          ))}

          {blockers.length ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>À corriger avant envoi</Text>
              {blockers.map((item) => <Text key={item} style={styles.warningText}>• {item}</Text>)}
            </View>
          ) : null}

          <Pressable disabled={busy || blockers.length > 0} onPress={() => void submitReview()} style={[styles.primaryButton, (busy || blockers.length > 0) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Valider ma lecture et envoyer</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="ANIMATEUR · SELL-OUT" title="Sortie de caisse" subtitle="Photo ou PDF → extraction → correction → validation humaine." />

        <View style={styles.guardCard}>
          <Text style={styles.guardTitle}>Aucune vente confirmée automatiquement</Text>
          <Text style={styles.guardText}>TR1 propose une lecture. Vous contrôlez chaque ligne, puis un responsable valide le relevé avant qu’il ne devienne « Confirmé ».</Text>
        </View>

        {error ? <ErrorCard message={error} /> : null}
        {success ? <View style={styles.successCard}><Text style={styles.successText}>{success}</Text></View> : null}
        {loading ? <Loading label="Chargement de vos missions…" /> : null}

        {!loading ? (
          <>
            <Text style={styles.sectionTitle}>1. Choisir la mission TR1</Text>
            {missions.length ? missions.map((mission) => (
              <Pressable
                key={mission.id}
                onPress={() => {
                  setSelectedMission(mission);
                  setSuccess(null);
                  setError(null);
                }}
                style={[styles.missionCard, selectedMission?.id === mission.id && styles.missionCardSelected]}
              >
                <Text style={styles.missionDate}>{mission.scheduledStartAt ? formatDateTime(mission.scheduledStartAt) : "Date non planifiée"}</Text>
                <Text style={styles.missionTitle}>{mission.pharmacyName}{mission.city ? ` · ${mission.city}` : ""}</Text>
                <Text style={styles.missionMeta}>{missionTypeLabel(mission.missionType)} · {statusLabel(mission.status)}</Text>
              </Pressable>
            )) : <EmptyCard text="Aucune mission TR1 éligible pour cette marque." />}

            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>2. Ajouter la sortie de caisse</Text>
            <Text style={styles.sectionHelp}>La preuve est rattachée à la mission choisie. Pour une mission hors TR1, utilisez « Mon activité animateur » : le document y reste strictement privé et n’est pas rapproché au catalogue de cette marque.</Text>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Pressable disabled={!selectedMission || busy} onPress={() => void takePhoto()} style={[styles.secondaryButton, (!selectedMission || busy) && styles.disabled]}><Text style={styles.secondaryButtonText}>Prendre une photo</Text></Pressable></View>
              <View style={styles.column}><Pressable disabled={!selectedMission || busy} onPress={() => void pickPdf()} style={[styles.secondaryButton, (!selectedMission || busy) && styles.disabled]}><Text style={styles.secondaryButtonText}>Importer un PDF</Text></Pressable></View>
            </View>
            {busy ? <Loading label="Analyse de la sortie de caisse…" /> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, eyebrow, title, subtitle }: { onBack: () => void; eyebrow: string; title: string; subtitle: string }) {
  return (
    <>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>← Retour</Text></Pressable>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "number-pad" | "decimal-pad" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" keyboardType={keyboardType} style={styles.input} />
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.chip}><Text style={styles.chipText}>{label}</Text></Pressable>;
}

function Loading({ label }: { label: string }) {
  return <View style={styles.loading}><ActivityIndicator /><Text style={styles.loadingText}>{label}</Text></View>;
}

function EmptyCard({ text }: { text: string }) {
  return <View style={styles.noticeCard}><Text style={styles.noticeText}>{text}</Text></View>;
}

function ErrorCard({ message }: { message: string }) {
  return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text></View>;
}

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-160) || "preuve";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function missionTypeLabel(value: string) {
  return ({ animation: "Animation", training: "Formation", merchandising: "Merchandising", pharmacy_audit: "Audit pharmacie", product_launch: "Lancement", stock_check: "Stock", other: "Autre" } as Record<string, string>)[value] || value.replaceAll("_", " ");
}

function statusLabel(value: string) {
  return ({ requested: "Demandée", to_assign: "À affecter", assigned: "Affectée", accepted: "Acceptée", scheduled: "Planifiée", in_progress: "En cours", report_pending: "Rapport attendu", completed: "Terminée" } as Record<string, string>)[value] || value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 44 },
  backButton: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: 12 },
  backText: { color: "#3B5BDB", fontWeight: "800", fontSize: 13 },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 5 },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  guardCard: { borderRadius: 16, padding: 16, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE", marginBottom: 16 },
  guardTitle: { color: "#312E81", fontSize: 14, fontWeight: "800" },
  guardText: { color: "#4338CA", fontSize: 13, lineHeight: 19, marginTop: 4 },
  warningCard: { borderRadius: 14, padding: 14, backgroundColor: "#FFFAEB", borderWidth: 1, borderColor: "#FEDF89", marginBottom: 10 },
  warningTitle: { color: "#93370D", fontWeight: "800", fontSize: 13, marginBottom: 5 },
  warningText: { color: "#B54708", fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 11 },
  sectionSpacing: { marginTop: 24 },
  sectionHelp: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: -4, marginBottom: 12 },
  missionCard: { borderRadius: 16, padding: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 9 },
  missionCardSelected: { backgroundColor: "#EEF2FF", borderColor: "#A5B4FC" },
  missionDate: { color: "#667085", fontSize: 11, fontWeight: "700" },
  missionTitle: { color: "#111827", fontSize: 15, fontWeight: "800", marginTop: 4 },
  missionMeta: { color: "#667085", fontSize: 12, marginTop: 4 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: "#3B5BDB", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4, marginBottom: 10 },
  primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, marginBottom: 10 },
  secondaryButtonText: { color: "#3B5BDB", fontWeight: "800", fontSize: 12, textAlign: "center" },
  twoColumns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  lineCard: { borderRadius: 16, padding: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 11 },
  lineSource: { color: "#111827", fontSize: 15, fontWeight: "800" },
  lineMeta: { color: "#667085", fontSize: 11, marginTop: 3, marginBottom: 10 },
  lineWarning: { color: "#B54708", fontSize: 12, lineHeight: 17, marginBottom: 10 },
  field: { marginBottom: 13 },
  fieldLabel: { color: "#344054", fontSize: 12, fontWeight: "800", marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", paddingHorizontal: 12, color: "#111827", fontSize: 14 },
  selectedProduct: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 11, backgroundColor: "#ECFDF3", borderRadius: 12, borderWidth: 1, borderColor: "#ABEFC6", marginBottom: 10 },
  selectedProductName: { flex: 1, color: "#067647", fontSize: 13, fontWeight: "800" },
  changeText: { color: "#3B5BDB", fontSize: 12, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { color: "#475467", fontSize: 11, fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  searchInput: { flex: 1, marginBottom: 0 },
  searchButton: { minHeight: 46, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  searchButtonText: { color: "#3B5BDB", fontWeight: "800", fontSize: 11 },
  noticeCard: { borderRadius: 14, padding: 14, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 11 },
  noticeText: { color: "#667085", fontSize: 13, lineHeight: 18 },
  errorCard: { borderRadius: 14, padding: 14, backgroundColor: "#FEF3F2", borderWidth: 1, borderColor: "#FECDCA", marginBottom: 11 },
  errorText: { color: "#B42318", fontSize: 13, lineHeight: 18 },
  successCard: { borderRadius: 14, padding: 14, backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#ABEFC6", marginBottom: 11 },
  successText: { color: "#067647", fontSize: 13, lineHeight: 18 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 },
  loadingText: { color: "#667085", fontSize: 13 },
  disabled: { opacity: 0.5 },
});