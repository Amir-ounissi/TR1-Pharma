import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { BrandContext } from "../../App";
import { analyzeOrderPhoto, confirmOrderPreview, type MobileOrderPreview } from "../lib/order-api";
import { supabase } from "../lib/supabase";

type Route = "home" | "pharmacies" | "pharmacy" | "order-capture" | "order-review";

type PharmacyRow = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  pharmacy_group_name: string | null;
  city: string | null;
  postal_code: string | null;
  commercial_status: string | null;
  priority_level: string | null;
  potential_level: string | null;
  activity_status: string | null;
  agent_name: string | null;
  territory_name: string | null;
};

type Pharma360Snapshot = {
  account?: {
    pharmacy_name?: string;
    group_name?: string | null;
    city?: string | null;
    postal_code?: string | null;
    commercial_status?: string | null;
    priority_level?: string | null;
    potential_level?: string | null;
    territory_name?: string | null;
    agent_name?: string | null;
    cip_code?: string | null;
  };
  business?: {
    total_revenue_ht?: number | null;
    revenue_last_90d_ht?: number | null;
    orders_count?: number | null;
    reorder_count?: number | null;
    average_order_value?: number | null;
    last_order_at?: string | null;
    expected_reorder_at?: string | null;
    health_status?: string | null;
    priority_score?: number | null;
    priority_reasons?: string[] | null;
  };
  assortment?: {
    implanted_product_count?: number | null;
    eligible_product_count?: number | null;
    distribution_rate?: number | null;
  };
};

type Props = {
  brand: BrandContext;
  canSwitchBrand: boolean;
  onSwitchBrand: () => void;
  onSignOut: () => Promise<void>;
};

const managerRoles = new Set(["tr1_manager", "brand_admin", "brand_user", "super_admin"]);

export function FieldWorkspace({ brand, canSwitchBrand, onSwitchBrand, onSignOut }: Props) {
  const [route, setRoute] = useState<Route>("home");
  const [selected, setSelected] = useState<PharmacyRow | null>(null);
  const [orderPreview, setOrderPreview] = useState<MobileOrderPreview | null>(null);
  const [orderPhotoUri, setOrderPhotoUri] = useState<string | null>(null);

  function openPharmacy(row: PharmacyRow) {
    setSelected(row);
    setRoute("pharmacy");
  }

  if (route === "pharmacies") {
    return <PharmacyList brand={brand} onBack={() => setRoute("home")} onOpen={openPharmacy} />;
  }
  if (route === "pharmacy" && selected) {
    return <PharmacyDetail brand={brand} pharmacy={selected} onBack={() => setRoute("pharmacies")} />;
  }
  if (route === "order-capture") {
    return (
      <OrderCapture
        brand={brand}
        onBack={() => setRoute("home")}
        onAnalyzed={(photoUri, preview) => {
          setOrderPhotoUri(photoUri);
          setOrderPreview(preview);
          setRoute("order-review");
        }}
      />
    );
  }
  if (route === "order-review" && orderPreview) {
    return (
      <OrderReview
        brand={brand}
        photoUri={orderPhotoUri}
        preview={orderPreview}
        onBack={() => setRoute("order-capture")}
        onDone={() => {
          setOrderPhotoUri(null);
          setOrderPreview(null);
          setRoute("home");
        }}
      />
    );
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
          {canSwitchBrand ? <Pressable onPress={onSwitchBrand} style={styles.smallButton}><Text style={styles.smallButtonText}>Changer</Text></Pressable> : null}
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>AUJOURD’HUI</Text>
          <Text style={styles.heroTitle}>Votre journée terrain commence ici.</Text>
          <Text style={styles.heroText}>Les usages terrain sont prioritaires : pharmacies, missions, commandes et prochaines actions.</Text>
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <Pressable onPress={() => setRoute("order-capture")} style={[styles.actionCard, styles.actionFeatured]}>
          <Text style={styles.actionTitle}>Scanner une commande</Text>
          <Text style={styles.actionText}>Photo → analyse → vérification → validation</Text>
          <Text style={styles.openLabel}>OUVRIR LA CAMÉRA</Text>
        </Pressable>
        <Pressable onPress={() => setRoute("pharmacies")} style={styles.actionCard}>
          <Text style={styles.actionTitle}>Pharmacies</Text>
          <Text style={styles.actionText}>Portefeuille, recherche et fiche compte</Text>
          <Text style={styles.openLabel}>OUVRIR</Text>
        </Pressable>
        <View style={styles.actionCard}><Text style={styles.actionTitle}>Missions</Text><Text style={styles.actionText}>Priorités terrain</Text><Text style={styles.soon}>À VENIR</Text></View>
        <View style={styles.actionCard}><Text style={styles.actionTitle}>Agenda</Text><Text style={styles.actionText}>Visites et relances</Text><Text style={styles.soon}>À VENIR</Text></View>

        <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCapture({ brand, onBack, onAnalyzed }: { brand: BrandContext; onBack: () => void; onAnalyzed: (photoUri: string, preview: MobileOrderPreview) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeAsset(asset: ImagePicker.ImagePickerAsset) {
    try {
      setBusy(true);
      setError(null);
      const preview = await analyzeOrderPhoto(asset, brand.id);
      onAnalyzed(asset.uri, preview);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "La commande n’a pas pu être analysée.");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Autorisez l’accès à la caméra pour photographier la commande.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], cameraType: ImagePicker.CameraType.back, allowsEditing: false, quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await analyzeAsset(asset);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await analyzeAsset(asset);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <HeaderBack label="COMMANDE" onBack={onBack} />
        <Text style={styles.detailTitle}>Scanner une commande</Text>
        <Text style={styles.detailLocation}>Cadrez le bon entier, à plat et avec une lumière homogène. TR1 réduit la photo avant analyse.</Text>

        <View style={styles.captureHero}>
          <Text style={styles.captureIcon}>▣</Text>
          <Text style={styles.captureTitle}>Photo du bon de commande</Text>
          <Text style={styles.captureText}>Aucune commande n’est créée automatiquement. Vous contrôlez les données avant validation.</Text>
        </View>

        {error ? <View style={styles.errorCardStandalone}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable disabled={busy} onPress={() => void takePhoto()} style={[styles.captureButton, busy && styles.disabledButton]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.captureButtonText}>Prendre une photo</Text>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void choosePhoto()} style={[styles.secondaryCaptureButton, busy && styles.disabledButton]}>
          <Text style={styles.secondaryCaptureText}>Choisir une photo existante</Text>
        </Pressable>

        {busy ? <Text style={styles.analysisText}>Analyse TR1 en cours… pharmacie, produits, quantités et UG.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderReview({ brand, preview, photoUri, onBack, onDone }: { brand: BrandContext; preview: MobileOrderPreview; photoUri: string | null; onBack: () => void; onDone: () => void }) {
  const [orderNumber, setOrderNumber] = useState(preview.extraction.orderNumber ?? "");
  const [orderDate, setOrderDate] = useState(preview.extraction.orderDate ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const blockers = useMemo(() => {
    const values: string[] = [];
    if (!preview.pharmacy.selectedBrandPharmacyId && !preview.pharmacy.selectedPharmacyId) values.push("Pharmacie à confirmer");
    if (preview.lines.some((line) => !line.product.selectedId)) values.push("Produit(s) à confirmer");
    if (preview.lines.some((line) => !line.quantity || line.suggestedPriceHt == null)) values.push("Ligne(s) incomplète(s)");
    if (!orderNumber.trim()) values.push("Numéro de commande manquant");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) values.push("Date de commande manquante ou invalide");
    return values;
  }, [orderDate, orderNumber, preview]);

  async function confirm() {
    try {
      setPending(true);
      setError(null);
      const result = await confirmOrderPreview({ brandId: brand.id, preview, orderNumber: orderNumber.trim(), orderDate });
      setSuccess(result.success ?? "Commande validée.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "La commande n’a pas pu être validée.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <HeaderBack label="VÉRIFICATION" onBack={onBack} />
        <Text style={styles.detailTitle}>Contrôler avant validation</Text>
        <Text style={styles.detailLocation}>TR1 ne crée la commande qu’après votre validation explicite.</Text>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.orderPhoto} resizeMode="cover" /> : null}

        <View style={styles.summaryCard}>
          <Info label="Pharmacie détectée" value={preview.pharmacy.selectedName || preview.extraction.pharmacy.name || "À confirmer"} />
          <Info label="Matching" value={preview.pharmacy.status} />
          <Info label="Total TR1 HT" value={currency(preview.totalTr1Ht)} />
          <Info label="Total document HT" value={preview.extraction.totalHt == null ? "—" : currency(preview.extraction.totalHt)} />
        </View>

        <Text style={styles.fieldLabel}>N° de commande</Text>
        <TextInput value={orderNumber} onChangeText={setOrderNumber} style={styles.reviewInput} placeholder="Numéro de commande" placeholderTextColor="#98A2B3" />
        <Text style={styles.fieldLabel}>Date de commande</Text>
        <TextInput value={orderDate} onChangeText={setOrderDate} style={styles.reviewInput} placeholder="AAAA-MM-JJ" placeholderTextColor="#98A2B3" autoCapitalize="none" />
        {preview.extraction.deliveryDate ? <Text style={styles.deliveryNote}>Date de livraison détectée : {preview.extraction.deliveryDate} — elle n’est jamais utilisée comme date de commande.</Text> : null}

        <Text style={[styles.sectionTitle, styles.reviewSectionTitle]}>Produits</Text>
        {preview.lines.map((line) => (
          <View key={line.index} style={styles.orderLine}>
            <View style={styles.flex}>
              <Text style={styles.orderLineTitle}>{line.product.selectedName || line.label || line.sku || line.ean || "Produit à identifier"}</Text>
              <Text style={styles.orderLineMeta}>{line.sku || line.ean || "Référence non lue"}</Text>
              <Text style={line.product.selectedId ? styles.matchedText : styles.unmatchedText}>{line.product.selectedId ? "Produit TR1 identifié" : "Correspondance à confirmer"}</Text>
            </View>
            <View style={styles.quantityBox}><Text style={styles.quantityValue}>{line.quantity ?? 0}</Text><Text style={styles.quantityLabel}>pay.</Text>{line.freeQuantity > 0 ? <Text style={styles.freeQuantity}>+{line.freeQuantity} UG</Text> : null}</View>
          </View>
        ))}

        {preview.warnings.length ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Points à vérifier</Text>{preview.warnings.slice(0, 6).map((warning) => <Text key={warning} style={styles.warningText}>• {warning}</Text>)}</View> : null}
        {blockers.length ? <View style={styles.blockerCard}><Text style={styles.blockerTitle}>Validation bloquée</Text>{blockers.map((blocker) => <Text key={blocker} style={styles.blockerText}>• {blocker}</Text>)}<Text style={styles.blockerHelp}>La sélection manuelle des pharmacies et produits ambigus sera ajoutée à l’étape suivante.</Text></View> : null}
        {error ? <View style={styles.errorCardStandalone}><Text style={styles.errorText}>{error}</Text></View> : null}
        {success ? <View style={styles.successCard}><Text style={styles.successTitle}>{success}</Text><Pressable onPress={onDone} style={styles.successButton}><Text style={styles.successButtonText}>Retour à l’accueil</Text></Pressable></View> : (
          <Pressable disabled={pending || blockers.length > 0} onPress={() => void confirm()} style={[styles.captureButton, (pending || blockers.length > 0) && styles.disabledButton]}>
            {pending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.captureButtonText}>Valider la commande</Text>}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PharmacyList({ brand, onBack, onOpen }: { brand: BrandContext; onBack: () => void; onOpen: (row: PharmacyRow) => void }) {
  const [rows, setRows] = useState<PharmacyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    let query = supabase
      .from("brand_pharmacy_directory")
      .select("id,trade_name,legal_name,pharmacy_group_name,city,postal_code,commercial_status,priority_level,potential_level,activity_status,agent_name,territory_name")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("trade_name", { ascending: true })
      .limit(150);
    if (search.trim()) query = query.ilike("search_text", `%${search.trim()}%`);
    const { data, error: queryError } = await query;
    if (queryError) setError("Impossible de charger le portefeuille pharmacies.");
    else setRows((data ?? []) as PharmacyRow[]);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void load(); }, [brand.id]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.listHeader}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>PORTEFEUILLE</Text><Text style={styles.headerTitle}>Pharmacies</Text></View>
      </View>
      <View style={styles.searchRow}>
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} placeholder="Nom, ville, CIP…" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" />
        <Pressable onPress={() => void load()} style={styles.searchButton}><Text style={styles.searchButtonText}>Chercher</Text></Pressable>
      </View>
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Réessayer</Text></Pressable></View> : null}
      {loading ? <View style={styles.centered}><ActivityIndicator color="#3B5BDB" /><Text style={styles.muted}>Chargement du portefeuille…</Text></View> : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListHeaderComponent={<Text style={styles.resultCount}>{rows.length} pharmacie(s) affichée(s)</Text>}
          ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>Aucune pharmacie trouvée</Text><Text style={styles.muted}>Modifiez votre recherche ou vérifiez votre périmètre d’accès.</Text></View>}
          renderItem={({ item }) => <PharmacyCard row={item} onPress={() => onOpen(item)} />}
        />
      )}
    </SafeAreaView>
  );
}

function PharmacyCard({ row, onPress }: { row: PharmacyRow; onPress: () => void }) {
  const name = row.trade_name || row.legal_name || "Pharmacie";
  return (
    <Pressable onPress={onPress} style={styles.pharmacyCard}>
      <View style={styles.flex}>
        <Text style={styles.pharmacyName}>{name}</Text>
        <Text style={styles.pharmacyLocation}>{[row.postal_code, row.city].filter(Boolean).join(" ") || "Localisation non renseignée"}</Text>
        <Text style={styles.pharmacyMeta}>{row.pharmacy_group_name || "Indépendante"} · {row.agent_name || "Sans agent"}</Text>
        <View style={styles.tagRow}>
          {row.priority_level ? <Tag label={`Priorité ${row.priority_level}`} accent={row.priority_level === "strategic"} /> : null}
          {row.potential_level ? <Tag label={`Potentiel ${row.potential_level}`} /> : null}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function PharmacyDetail({ brand, pharmacy, onBack }: { brand: BrandContext; pharmacy: PharmacyRow; onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<Pharma360Snapshot | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [error360, setError360] = useState<string | null>(null);
  const canRead360 = managerRoles.has(brand.role);

  useEffect(() => {
    if (!canRead360) return;
    let cancelled = false;
    setLoading360(true);
    void (async () => {
      const { data, error } = await supabase.rpc("get_pharma_360", { target_brand_id: brand.id, target_brand_pharmacy_id: pharmacy.id });
      if (cancelled) return;
      if (error || !data || typeof data !== "object") setError360("La vue Pharma 360 n’est pas disponible pour ce compte.");
      else setSnapshot(data as Pharma360Snapshot);
      setLoading360(false);
    })();
    return () => { cancelled = true; };
  }, [brand.id, canRead360, pharmacy.id]);

  const account = snapshot?.account;
  const business = snapshot?.business;
  const assortment = snapshot?.assortment;
  const title = account?.pharmacy_name || pharmacy.trade_name || pharmacy.legal_name || "Pharmacie";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <HeaderBack label="FICHE PHARMACIE" onBack={onBack} />
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailLocation}>{[pharmacy.postal_code, pharmacy.city].filter(Boolean).join(" ") || "Localisation non renseignée"}</Text>

        <View style={styles.summaryCard}>
          <Info label="Statut" value={account?.commercial_status || pharmacy.commercial_status || "—"} />
          <Info label="Priorité" value={account?.priority_level || pharmacy.priority_level || "—"} />
          <Info label="Potentiel" value={account?.potential_level || pharmacy.potential_level || "—"} />
          <Info label="Groupement" value={account?.group_name || pharmacy.pharmacy_group_name || "Indépendante"} />
          <Info label="Responsable" value={account?.agent_name || pharmacy.agent_name || "Non affecté"} />
          <Info label="Territoire" value={account?.territory_name || pharmacy.territory_name || "—"} />
        </View>

        {canRead360 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Pharma 360</Text>
            {loading360 ? <ActivityIndicator color="#3B5BDB" /> : null}
            {error360 ? <Text style={styles.errorText}>{error360}</Text> : null}
            {snapshot ? (
              <>
                <View style={styles.metricGrid}>
                  <Metric label="CA cumulé HT" value={currency(business?.total_revenue_ht)} />
                  <Metric label="CA 90 j" value={currency(business?.revenue_last_90d_ht)} />
                  <Metric label="Commandes" value={numberValue(business?.orders_count)} />
                  <Metric label="Réassorts" value={numberValue(business?.reorder_count)} />
                  <Metric label="Panier moyen" value={currency(business?.average_order_value)} />
                  <Metric label="DN" value={percent(assortment?.distribution_rate)} />
                </View>
                <View style={styles.summaryCard}>
                  <Info label="Dernière commande" value={dateValue(business?.last_order_at)} />
                  <Info label="Réassort attendu" value={dateValue(business?.expected_reorder_at)} />
                  <Info label="Santé commerciale" value={business?.health_status || "—"} />
                  <Info label="Score priorité" value={business?.priority_score != null ? `${business.priority_score}/100` : "—"} />
                  <Info label="Produits implantés" value={`${assortment?.implanted_product_count ?? 0}/${assortment?.eligible_product_count ?? 0}`} />
                </View>
                {business?.priority_reasons?.length ? <View style={styles.reasonCard}><Text style={styles.reasonTitle}>Pourquoi ce compte mérite l’attention</Text>{business.priority_reasons.slice(0, 4).map((reason) => <Text key={reason} style={styles.reasonText}>• {reason}</Text>)}</View> : null}
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.noticeCard}><Text style={styles.noticeTitle}>Vue terrain</Text><Text style={styles.noticeText}>La vue Pharma 360 enrichie conserve les mêmes permissions que sur le web. Aucun droit supplémentaire n’est accordé par l’application mobile.</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderBack({ label, onBack }: { label: string; onBack: () => void }) { return <View style={styles.listHeaderInline}><Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.eyebrow}>{label}</Text></View>; }
function Tag({ label, accent = false }: { label: string; accent?: boolean }) { return <View style={[styles.tag, accent && styles.tagAccent]}><Text style={[styles.tagText, accent && styles.tagTextAccent]}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function currency(value: number | null | undefined) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
function numberValue(value: number | null | undefined) { return new Intl.NumberFormat("fr-FR").format(Number(value ?? 0)); }
function percent(value: number | null | undefined) { return `${Math.round(Number(value ?? 0) * 100)} %`; }
function dateValue(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—"; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#F7F8FA" }, page: { padding: 22, paddingBottom: 42 }, centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }, muted: { color: "#667085", fontSize: 14, lineHeight: 20, textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }, eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 5 }, meta: { color: "#667085", fontSize: 13, marginTop: 3 }, smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC" }, smallButtonText: { color: "#3B5BDB", fontWeight: "700", fontSize: 13 },
  hero: { backgroundColor: "#111827", borderRadius: 24, padding: 22, marginBottom: 26 }, heroKicker: { color: "#A5B4FC", fontWeight: "800", fontSize: 11, letterSpacing: 1 }, heroTitle: { color: "#FFF", fontSize: 24, lineHeight: 30, fontWeight: "800", marginTop: 10 }, heroText: { color: "#D0D5DD", fontSize: 14, lineHeight: 21, marginTop: 9 }, sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 13 },
  actionCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, padding: 18, backgroundColor: "#FFF", marginBottom: 11 }, actionFeatured: { borderColor: "#C7D2FE", backgroundColor: "#EEF2FF" }, actionTitle: { color: "#111827", fontSize: 17, fontWeight: "800" }, actionText: { color: "#667085", fontSize: 14, marginTop: 4 }, soon: { color: "#667085", fontSize: 11, fontWeight: "700", marginTop: 13, letterSpacing: 0.5 }, openLabel: { color: "#3B5BDB", fontSize: 11, fontWeight: "800", marginTop: 13, letterSpacing: 0.5 }, signOut: { alignSelf: "center", marginTop: 16, padding: 12 }, signOutText: { color: "#667085", fontWeight: "700" },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 }, listHeaderInline: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }, backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC" }, backText: { fontSize: 31, lineHeight: 33, color: "#111827" }, headerTitle: { color: "#111827", fontSize: 25, fontWeight: "800", marginTop: 2 }, searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingBottom: 12 }, searchInput: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 14, fontSize: 15, color: "#111827" }, searchButton: { minHeight: 48, borderRadius: 14, backgroundColor: "#111827", justifyContent: "center", paddingHorizontal: 14 }, searchButtonText: { color: "#FFF", fontWeight: "800", fontSize: 13 }, listContent: { paddingHorizontal: 18, paddingBottom: 34 }, resultCount: { color: "#667085", fontSize: 12, marginBottom: 10 },
  pharmacyCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", padding: 16, marginBottom: 10 }, pharmacyName: { color: "#111827", fontSize: 16, fontWeight: "800" }, pharmacyLocation: { color: "#344054", fontSize: 13, marginTop: 4 }, pharmacyMeta: { color: "#667085", fontSize: 12, marginTop: 3 }, tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }, tag: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#F2F4F7" }, tagAccent: { backgroundColor: "#FFF1EB" }, tagText: { color: "#475467", fontSize: 10, fontWeight: "700" }, tagTextAccent: { color: "#C2410C" }, chevron: { color: "#98A2B3", fontSize: 30, marginLeft: 8 },
  errorCard: { marginHorizontal: 18, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: "#FEF3F2" }, errorCardStandalone: { marginBottom: 14, padding: 14, borderRadius: 14, backgroundColor: "#FEF3F2" }, errorText: { color: "#B42318", fontSize: 13, lineHeight: 19 }, retry: { color: "#B42318", fontWeight: "800", marginTop: 7 }, emptyCard: { padding: 22, borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginTop: 12 }, emptyTitle: { color: "#111827", fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: 5 },
  detailTitle: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800" }, detailLocation: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 20 }, summaryCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 16, marginBottom: 18 }, infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" }, infoLabel: { color: "#667085", fontSize: 13 }, infoValue: { flex: 1, color: "#111827", fontSize: 13, fontWeight: "700", textAlign: "right" }, sectionBlock: { marginTop: 4 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }, metric: { width: "48%", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 16, backgroundColor: "#FFF", padding: 14 }, metricLabel: { color: "#667085", fontSize: 11 }, metricValue: { color: "#111827", fontSize: 20, fontWeight: "800", marginTop: 7 }, reasonCard: { backgroundColor: "#EEF2FF", borderRadius: 18, padding: 16 }, reasonTitle: { color: "#27346A", fontWeight: "800", fontSize: 14, marginBottom: 7 }, reasonText: { color: "#596591", fontSize: 13, lineHeight: 19, marginTop: 3 }, noticeCard: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 18, marginTop: 4 }, noticeTitle: { color: "#111827", fontSize: 16, fontWeight: "800" }, noticeText: { color: "#667085", fontSize: 13, lineHeight: 20, marginTop: 5 },
  captureHero: { borderRadius: 22, backgroundColor: "#111827", padding: 22, alignItems: "center", marginBottom: 18 }, captureIcon: { color: "#A5B4FC", fontSize: 40, marginBottom: 10 }, captureTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" }, captureText: { color: "#D0D5DD", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 7 }, captureButton: { minHeight: 54, borderRadius: 15, backgroundColor: "#3B5BDB", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, captureButtonText: { color: "#FFF", fontSize: 15, fontWeight: "800" }, secondaryCaptureButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", alignItems: "center", justifyContent: "center", marginTop: 10 }, secondaryCaptureText: { color: "#111827", fontSize: 14, fontWeight: "700" }, disabledButton: { opacity: 0.45 }, analysisText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 14 },
  orderPhoto: { width: "100%", height: 190, borderRadius: 18, backgroundColor: "#E4E7EC", marginBottom: 16 }, fieldLabel: { color: "#111827", fontSize: 12, fontWeight: "800", marginBottom: 6 }, reviewInput: { minHeight: 49, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 14, fontSize: 15, color: "#111827", marginBottom: 13 }, deliveryNote: { color: "#596591", fontSize: 12, lineHeight: 18, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 18 }, reviewSectionTitle: { marginTop: 5 }, orderLine: { flexDirection: "row", gap: 12, borderRadius: 16, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 14, marginBottom: 9 }, orderLineTitle: { color: "#111827", fontSize: 14, fontWeight: "800" }, orderLineMeta: { color: "#667085", fontSize: 11, marginTop: 3 }, matchedText: { color: "#067647", fontSize: 11, fontWeight: "700", marginTop: 7 }, unmatchedText: { color: "#B42318", fontSize: 11, fontWeight: "700", marginTop: 7 }, quantityBox: { minWidth: 62, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#F2F4F7", padding: 8 }, quantityValue: { color: "#111827", fontSize: 19, fontWeight: "800" }, quantityLabel: { color: "#667085", fontSize: 9 }, freeQuantity: { color: "#3B5BDB", fontSize: 10, fontWeight: "800", marginTop: 4 }, warningCard: { borderRadius: 16, backgroundColor: "#FFFAEB", padding: 15, marginTop: 10, marginBottom: 12 }, warningTitle: { color: "#7A2E0E", fontSize: 13, fontWeight: "800", marginBottom: 5 }, warningText: { color: "#854A0E", fontSize: 12, lineHeight: 18, marginTop: 2 }, blockerCard: { borderRadius: 16, backgroundColor: "#FEF3F2", padding: 15, marginBottom: 12 }, blockerTitle: { color: "#B42318", fontSize: 13, fontWeight: "800", marginBottom: 5 }, blockerText: { color: "#B42318", fontSize: 12, lineHeight: 18 }, blockerHelp: { color: "#667085", fontSize: 11, lineHeight: 17, marginTop: 8 }, successCard: { borderRadius: 18, backgroundColor: "#ECFDF3", padding: 18, alignItems: "center" }, successTitle: { color: "#067647", fontSize: 16, fontWeight: "800", textAlign: "center" }, successButton: { marginTop: 14, borderRadius: 13, backgroundColor: "#067647", paddingHorizontal: 16, paddingVertical: 12 }, successButtonText: { color: "#FFF", fontWeight: "800" },
});
