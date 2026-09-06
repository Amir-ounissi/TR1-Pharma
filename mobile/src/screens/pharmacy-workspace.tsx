import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { supabase } from "../lib/supabase";

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
    commercial_status?: string | null;
    priority_level?: string | null;
    potential_level?: string | null;
    territory_name?: string | null;
    agent_name?: string | null;
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

const managerRoles = new Set(["tr1_manager", "brand_admin", "brand_user", "super_admin"]);

export function PharmacyWorkspace({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const [selected, setSelected] = useState<PharmacyRow | null>(null);
  if (selected) return <PharmacyDetail brand={brand} pharmacy={selected} onBack={() => setSelected(null)} />;
  return <PharmacyList brand={brand} onBack={onBack} onOpen={setSelected} />;
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
        <BackButton onPress={onBack} />
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>PORTEFEUILLE</Text>
          <Text style={styles.headerTitle}>Pharmacies</Text>
        </View>
      </View>
      <View style={styles.searchRow}>
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} placeholder="Nom, ville, CIP…" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" />
        <Pressable onPress={() => void load()} style={styles.searchButton}><Text style={styles.searchButtonText}>Chercher</Text></Pressable>
      </View>
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Réessayer</Text></Pressable></View> : null}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#3B5BDB" /><Text style={styles.muted}>Chargement du portefeuille…</Text></View>
      ) : (
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRead360 = managerRoles.has(brand.role);

  useEffect(() => {
    if (!canRead360) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error: queryError } = await supabase.rpc("get_pharma_360", { target_brand_id: brand.id, target_brand_pharmacy_id: pharmacy.id });
      if (cancelled) return;
      if (queryError || !data || typeof data !== "object") setError("La vue Pharma 360 n’est pas disponible pour ce compte.");
      else setSnapshot(data as Pharma360Snapshot);
      setLoading(false);
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
        <View style={styles.inlineHeader}><BackButton onPress={onBack} /><Text style={styles.eyebrow}>FICHE PHARMACIE</Text></View>
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
          <View>
            <Text style={styles.sectionTitle}>Pharma 360</Text>
            {loading ? <ActivityIndicator color="#3B5BDB" /> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
                {business?.priority_reasons?.length ? (
                  <View style={styles.reasonCard}>
                    <Text style={styles.reasonTitle}>Pourquoi ce compte mérite l’attention</Text>
                    {business.priority_reasons.slice(0, 4).map((reason) => <Text key={reason} style={styles.reasonText}>• {reason}</Text>)}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Vue terrain</Text>
            <Text style={styles.noticeText}>La vue Pharma 360 enrichie conserve les mêmes permissions que sur le web. Aucun droit supplémentaire n’est accordé par l’application mobile.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>; }
function Tag({ label, accent = false }: { label: string; accent?: boolean }) { return <View style={[styles.tag, accent && styles.tagAccent]}><Text style={[styles.tagText, accent && styles.tagTextAccent]}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function currency(value: number | null | undefined) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
function numberValue(value: number | null | undefined) { return new Intl.NumberFormat("fr-FR").format(Number(value ?? 0)); }
function percent(value: number | null | undefined) { return `${Math.round(Number(value ?? 0) * 100)} %`; }
function dateValue(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—"; }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 42 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 },
  muted: { color: "#667085", fontSize: 14, lineHeight: 20, textAlign: "center" },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  inlineHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  headerTitle: { color: "#111827", fontSize: 25, fontWeight: "800", marginTop: 2 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC" },
  backText: { fontSize: 31, lineHeight: 33, color: "#111827" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  searchInput: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 14, fontSize: 15, color: "#111827" },
  searchButton: { minHeight: 48, borderRadius: 14, backgroundColor: "#111827", justifyContent: "center", paddingHorizontal: 14 },
  searchButtonText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  listContent: { paddingHorizontal: 18, paddingBottom: 34 },
  resultCount: { color: "#667085", fontSize: 12, marginBottom: 10 },
  pharmacyCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", padding: 16, marginBottom: 10 },
  pharmacyName: { color: "#111827", fontSize: 16, fontWeight: "800" },
  pharmacyLocation: { color: "#344054", fontSize: 13, marginTop: 4 },
  pharmacyMeta: { color: "#667085", fontSize: 12, marginTop: 3 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#F2F4F7" },
  tagAccent: { backgroundColor: "#FFF1EB" },
  tagText: { color: "#475467", fontSize: 10, fontWeight: "700" },
  tagTextAccent: { color: "#C2410C" },
  chevron: { color: "#98A2B3", fontSize: 30, marginLeft: 8 },
  errorCard: { marginHorizontal: 18, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: "#FEF3F2" },
  errorText: { color: "#B42318", fontSize: 13, lineHeight: 19 },
  retry: { color: "#B42318", fontWeight: "800", marginTop: 7 },
  emptyCard: { padding: 22, borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginTop: 12 },
  emptyTitle: { color: "#111827", fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: 5 },
  detailTitle: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  detailLocation: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 20 },
  summaryCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 16, marginBottom: 18 },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  infoLabel: { color: "#667085", fontSize: 13 },
  infoValue: { flex: 1, color: "#111827", fontSize: 13, fontWeight: "700", textAlign: "right" },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 13 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  metric: { width: "48%", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 16, backgroundColor: "#FFF", padding: 14 },
  metricLabel: { color: "#667085", fontSize: 11 },
  metricValue: { color: "#111827", fontSize: 20, fontWeight: "800", marginTop: 7 },
  reasonCard: { backgroundColor: "#EEF2FF", borderRadius: 18, padding: 16 },
  reasonTitle: { color: "#27346A", fontWeight: "800", fontSize: 14, marginBottom: 7 },
  reasonText: { color: "#596591", fontSize: 13, lineHeight: 19, marginTop: 3 },
  noticeCard: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7EC", padding: 18, marginTop: 4 },
  noticeTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  noticeText: { color: "#667085", fontSize: 13, lineHeight: 20, marginTop: 5 },
});
