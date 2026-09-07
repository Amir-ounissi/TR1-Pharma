import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { BrandContext } from "../../App";
import { supabase } from "../lib/supabase";

type OrderStatusFilter = "all" | "pending" | "needs_correction" | "confirmed" | "delivered";

type OrderRow = {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderType: string;
  orderStatus: string;
  netAmountHt: number;
  isInitialOrder: boolean;
  isReorder: boolean;
  reviewNote: string | null;
  pharmacyName: string;
  city: string | null;
};

type OrderItemRow = {
  id: string;
  productName: string;
  sku: string | null;
  quantity: number;
  freeQuantity: number;
  unitPriceHt: number;
  discountAmountHt: number;
  lineTotalHt: number;
};

type ActivityLogRow = {
  id: string;
  action: string;
  createdAt: string;
};

type OrderDetailData = OrderRow & {
  subtotalHt: number;
  discountAmountHt: number;
  taxAmount: number;
  totalTtc: number;
};

const filters: Array<{ value: OrderStatusFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "needs_correction", label: "À corriger" },
  { value: "confirmed", label: "Validées" },
  { value: "delivered", label: "Livrées" },
];

export function OrderHistoryWorkspace({ brand, onBack }: { brand: BrandContext; onBack: () => void }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (selectedOrderId) {
    return (
      <OrderHistoryDetail
        brand={brand}
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
      />
    );
  }

  return <OrderHistoryList brand={brand} onBack={onBack} onOpen={setSelectedOrderId} />;
}

function OrderHistoryList({
  brand,
  onBack,
  onOpen,
}: {
  brand: BrandContext;
  onBack: () => void;
  onOpen: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
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

    let query = supabase
      .from("orders")
      .select("id,order_number,external_order_id,order_date,order_type,order_status,net_amount_ht,is_initial_order,is_reorder,review_note,created_by,source_agent_user_id,pharmacies(legal_name,trade_name,city)")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("order_date", { ascending: false })
      .limit(60);

    if (brand.role === "agent") {
      query = query.or(`created_by.eq.${userId},source_agent_user_id.eq.${userId}`);
    }
    if (statusFilter !== "all") {
      query = query.eq("order_status", statusFilter);
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      setOrders([]);
      setError("Impossible de charger l’historique des commandes.");
      setLoading(false);
      return;
    }

    setOrders((data ?? []).map((row) => normalizeOrder(row as unknown as Record<string, unknown>)));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [brand.id, brand.role, statusFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="COMMANDES" title="Historique" subtitle={brand.role === "agent" ? "Vos commandes terrain" : `Commandes · ${brand.name}`} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <Pressable key={filter.value} onPress={() => setStatusFilter(filter.value)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.toolbar}>
          <Text style={styles.countText}>{orders.length} commande(s) affichée(s)</Text>
          <Pressable onPress={() => void load()} style={styles.refreshButton}><Text style={styles.refreshText}>Actualiser</Text></Pressable>
        </View>

        {loading ? <Loading label="Chargement des commandes…" /> : null}
        {error ? <ErrorCard message={error} /> : null}
        {!loading && !error && orders.length === 0 ? <EmptyCard /> : null}
        {!loading && !error ? orders.map((order) => <OrderCard key={order.id} order={order} onPress={() => onOpen(order.id)} />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderHistoryDetail({ brand, orderId, onBack }: { brand: BrandContext; orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
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

    let orderQuery = supabase
      .from("orders")
      .select("id,order_number,external_order_id,order_date,order_type,order_status,net_amount_ht,is_initial_order,is_reorder,review_note,created_by,source_agent_user_id,subtotal_ht,discount_amount_ht,tax_amount,total_ttc,pharmacies(legal_name,trade_name,city)")
      .eq("id", orderId)
      .eq("brand_id", brand.id)
      .is("archived_at", null);

    if (brand.role === "agent") {
      orderQuery = orderQuery.or(`created_by.eq.${userId},source_agent_user_id.eq.${userId}`);
    }

    const { data: orderData, error: orderError } = await orderQuery.maybeSingle();
    if (orderError || !orderData) {
      setOrder(null);
      setItems([]);
      setLogs([]);
      setError("Cette commande n’est pas disponible dans votre périmètre.");
      setLoading(false);
      return;
    }

    const normalized = normalizeOrder(orderData as unknown as Record<string, unknown>);
    setOrder({
      ...normalized,
      subtotalHt: numberValue(orderData.subtotal_ht),
      discountAmountHt: numberValue(orderData.discount_amount_ht),
      taxAmount: numberValue(orderData.tax_amount),
      totalTtc: numberValue(orderData.total_ttc),
    });

    const [itemsResult, logsResult] = await Promise.all([
      supabase
        .from("order_items")
        .select("id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_amount_ht,line_total_ht")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("id,action,created_at")
        .eq("entity_id", orderId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (itemsResult.error) {
      setItems([]);
      setError("Commande chargée, mais son détail produits n’est pas disponible.");
    } else {
      setItems((itemsResult.data ?? []).map((item) => ({
        id: String(item.id),
        productName: String(item.product_name_snapshot || "Produit"),
        sku: typeof item.sku_snapshot === "string" ? item.sku_snapshot : null,
        quantity: numberValue(item.quantity),
        freeQuantity: numberValue(item.free_quantity),
        unitPriceHt: numberValue(item.unit_price_ht),
        discountAmountHt: numberValue(item.discount_amount_ht),
        lineTotalHt: numberValue(item.line_total_ht),
      })));
    }

    if (logsResult.error) {
      setLogs([]);
    } else {
      setLogs((logsResult.data ?? []).map((log) => ({
        id: String(log.id),
        action: String(log.action),
        createdAt: String(log.created_at),
      })));
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [brand.id, brand.role, orderId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Header onBack={onBack} eyebrow="COMMANDE" title={order?.orderNumber || "Détail"} subtitle={order ? `${order.pharmacyName}${order.city ? ` · ${order.city}` : ""}` : brand.name} />

        {loading ? <Loading label="Chargement de la commande…" /> : null}
        {error ? <ErrorCard message={error} /> : null}

        {!loading && order ? (
          <>
            <View style={styles.summaryCard}>
              <Info label="Date" value={formatDate(order.orderDate)} />
              <Info label="Statut" value={statusLabel(order.orderStatus)} />
              <Info label="Type" value={classificationLabel(order)} />
              <Info label="Net HT" value={currency(order.netAmountHt)} />
            </View>

            {order.orderStatus === "needs_correction" && order.reviewNote ? (
              <View style={styles.correctionCard}>
                <Text style={styles.correctionTitle}>Correction demandée</Text>
                <Text style={styles.correctionText}>{order.reviewNote}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Produits</Text>
            {items.length === 0 ? (
              <View style={styles.emptyDetailCard}>
                <Text style={styles.emptyTitle}>Détail produits non disponible</Text>
                <Text style={styles.emptyText}>TR1 n’invente aucune ligne absente d’un historique importé ou incomplet.</Text>
              </View>
            ) : items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>{item.sku || "Référence non renseignée"}</Text>
                  <Text style={styles.itemMeta}>{currency(item.unitPriceHt)} HT · remise {currency(item.discountAmountHt)}</Text>
                </View>
                <View style={styles.itemNumbers}>
                  <Text style={styles.itemQuantity}>{item.quantity}</Text>
                  <Text style={styles.itemUnit}>pay.</Text>
                  {item.freeQuantity > 0 ? <Text style={styles.freeQuantity}>+{item.freeQuantity} UG</Text> : null}
                  <Text style={styles.itemTotal}>{currency(item.lineTotalHt)}</Text>
                </View>
              </View>
            ))}

            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Montants</Text>
            <View style={styles.summaryCard}>
              <Info label="Sous-total HT" value={currency(order.subtotalHt)} />
              <Info label="Remises" value={currency(order.discountAmountHt)} />
              <Info label="Net HT" value={currency(order.netAmountHt)} />
              <Info label="Taxes" value={currency(order.taxAmount)} />
              <Info label="Total TTC" value={currency(order.totalTtc)} strong />
            </View>

            {logs.length ? (
              <>
                <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Historique</Text>
                <View style={styles.summaryCard}>
                  {logs.map((log) => (
                    <View key={log.id} style={styles.logRow}>
                      <Text style={styles.logAction}>{actionLabel(log.action)}</Text>
                      <Text style={styles.logDate}>{formatDateTime(log.createdAt)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeOrder(row: Record<string, unknown>): OrderRow {
  const pharmacyValue = row.pharmacies;
  const pharmacy = Array.isArray(pharmacyValue) ? pharmacyValue[0] as Record<string, unknown> | undefined : pharmacyValue as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    orderNumber: String(row.order_number || row.external_order_id || `Commande ${String(row.id).slice(0, 8)}`),
    orderDate: String(row.order_date),
    orderType: String(row.order_type || "other"),
    orderStatus: String(row.order_status || "draft"),
    netAmountHt: numberValue(row.net_amount_ht),
    isInitialOrder: row.is_initial_order === true,
    isReorder: row.is_reorder === true,
    reviewNote: typeof row.review_note === "string" ? row.review_note : null,
    pharmacyName: String(pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"),
    city: typeof pharmacy?.city === "string" ? pharmacy.city : null,
  };
}

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }) {
  const needsCorrection = order.orderStatus === "needs_correction";
  return (
    <Pressable onPress={onPress} style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.pharmacy}>{order.pharmacyName}{order.city ? ` · ${order.city}` : ""}</Text>
        </View>
        <Badge label={statusLabel(order.orderStatus)} danger={needsCorrection || order.orderStatus === "rejected"} />
      </View>
      <View style={styles.cardFooter}>
        <View><Text style={styles.cardMeta}>{formatDate(order.orderDate)} · {classificationLabel(order)}</Text></View>
        <Text style={styles.amount}>{currency(order.netAmountHt)}</Text>
      </View>
      {needsCorrection && order.reviewNote ? <Text style={styles.correctionPreview}>{order.reviewNote}</Text> : null}
      <Text style={styles.openDetail}>OUVRIR LA COMMANDE</Text>
    </Pressable>
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

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.infoStrong]}>{value}</Text></View>;
}

function Badge({ label, danger = false }: { label: string; danger?: boolean }) {
  return <View style={[styles.badge, danger && styles.badgeDanger]}><Text style={[styles.badgeText, danger && styles.badgeDangerText]}>{label}</Text></View>;
}

function Loading({ label }: { label: string }) {
  return <View style={styles.loading}><ActivityIndicator color="#3B5BDB" /><Text style={styles.loadingText}>{label}</Text></View>;
}

function ErrorCard({ message }: { message: string }) {
  return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text></View>;
}

function EmptyCard() {
  return <View style={styles.emptyDetailCard}><Text style={styles.emptyTitle}>Aucune commande</Text><Text style={styles.emptyText}>Les commandes de votre périmètre apparaîtront ici.</Text></View>;
}

function numberValue(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function currency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function classificationLabel(order: Pick<OrderRow, "isInitialOrder" | "isReorder" | "orderType">) {
  if (order.isInitialOrder) return "Implantation";
  if (order.isReorder) return "Réassort";
  return typeLabel(order.orderType);
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    pending: "En attente",
    needs_correction: "À corriger",
    confirmed: "Validée",
    invoiced: "Facturée",
    partially_delivered: "Partiellement livrée",
    delivered: "Livrée",
    rejected: "Refusée",
    cancelled: "Annulée",
    refunded: "Remboursée",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    initial: "Implantation",
    reorder: "Réassort",
    complementary: "Complémentaire",
    replacement: "Remplacement",
    sample: "Échantillon",
    return: "Retour",
    credit_note: "Avoir",
    other: "Autre",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function actionLabel(value: string) {
  return value.replaceAll("_", " ");
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 44 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 16 },
  backText: { fontSize: 31, lineHeight: 33, color: "#111827" },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 5 },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 16 },
  filterRow: { gap: 8, paddingBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 99, backgroundColor: "#FFF", paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { borderColor: "#111827", backgroundColor: "#111827" },
  filterText: { color: "#667085", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#FFF" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  countText: { color: "#667085", fontSize: 12 },
  refreshButton: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 11, backgroundColor: "#FFF", paddingHorizontal: 11, paddingVertical: 8 },
  refreshText: { color: "#3B5BDB", fontSize: 11, fontWeight: "800" },
  orderCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  orderNumber: { color: "#111827", fontSize: 15, fontWeight: "800" },
  pharmacy: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 4 },
  cardFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 13 },
  cardMeta: { color: "#475467", fontSize: 11, fontWeight: "700" },
  amount: { color: "#111827", fontSize: 16, fontWeight: "800" },
  correctionPreview: { color: "#B54708", fontSize: 11, lineHeight: 17, backgroundColor: "#FFFAEB", borderRadius: 10, padding: 10, marginTop: 11 },
  openDetail: { color: "#3B5BDB", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 11 },
  badge: { borderRadius: 99, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: "#3B5BDB", fontSize: 9, fontWeight: "800" },
  badgeDanger: { backgroundColor: "#FEF3F2" },
  badgeDangerText: { color: "#B42318" },
  loading: { alignItems: "center", paddingVertical: 28, gap: 10 },
  loadingText: { color: "#667085", fontSize: 13 },
  errorCard: { borderRadius: 16, backgroundColor: "#FEF3F2", padding: 15, marginBottom: 12 },
  errorText: { color: "#B42318", fontSize: 13, lineHeight: 19 },
  summaryCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 16, marginBottom: 20 },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  infoLabel: { color: "#667085", fontSize: 12 },
  infoValue: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "700", textAlign: "right" },
  infoStrong: { fontSize: 14, fontWeight: "800" },
  correctionCard: { borderRadius: 16, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", padding: 14, marginBottom: 20 },
  correctionTitle: { color: "#9A3412", fontSize: 13, fontWeight: "800" },
  correctionText: { color: "#9A3412", fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  sectionSpacing: { marginTop: 10 },
  itemCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 16, backgroundColor: "#FFF", padding: 14, marginBottom: 9 },
  itemTitle: { color: "#111827", fontSize: 13, fontWeight: "800" },
  itemMeta: { color: "#667085", fontSize: 10, lineHeight: 16, marginTop: 3 },
  itemNumbers: { minWidth: 70, alignItems: "flex-end" },
  itemQuantity: { color: "#111827", fontSize: 18, fontWeight: "800" },
  itemUnit: { color: "#667085", fontSize: 9 },
  freeQuantity: { color: "#3B5BDB", fontSize: 10, fontWeight: "800", marginTop: 3 },
  itemTotal: { color: "#111827", fontSize: 11, fontWeight: "800", marginTop: 7 },
  emptyDetailCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", padding: 20, marginBottom: 14 },
  emptyTitle: { color: "#111827", fontSize: 14, fontWeight: "800" },
  emptyText: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 5 },
  logRow: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  logAction: { flex: 1, color: "#344054", fontSize: 11, fontWeight: "700" },
  logDate: { color: "#667085", fontSize: 10 },
});