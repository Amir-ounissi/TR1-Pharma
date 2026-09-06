import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
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
  confirmManualOrder,
  searchOrderPharmacies,
  searchOrderProducts,
  type ManualOrderConfirmation,
  type ManualOrderStatus,
  type ManualOrderType,
  type OrderPharmacySelection,
  type OrderProductSelection,
} from "../lib/order-api";

type Stage = "edit" | "review" | "success";

type EditableLine = {
  key: string;
  product: OrderProductSelection;
  quantity: string;
  freeQuantity: string;
  unitPriceHt: string;
  discountRate: string;
};

const orderTypes: Array<{ value: ManualOrderType; label: string }> = [
  { value: "initial", label: "Implantation" },
  { value: "reorder", label: "Réassort" },
  { value: "complementary", label: "Complémentaire" },
  { value: "replacement", label: "Remplacement" },
  { value: "sample", label: "Échantillon" },
  { value: "return", label: "Retour" },
  { value: "credit_note", label: "Avoir" },
  { value: "other", label: "Autre" },
];

export function ManualOrderWorkflow({
  brand,
  onBack,
  onDone,
}: {
  brand: BrandContext;
  onBack: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("edit");
  const [pharmacy, setPharmacy] = useState<OrderPharmacySelection | null>(null);
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [pharmacyResults, setPharmacyResults] = useState<OrderPharmacySelection[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<OrderProductSelection[]>([]);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [orderType, setOrderType] = useState<ManualOrderType>("other");
  const [orderDate, setOrderDate] = useState(localDateString());
  const [orderNumber, setOrderNumber] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [shippingAmountHt, setShippingAmountHt] = useState("0");
  const [notes, setNotes] = useState("");
  const [searchingPharmacy, setSearchingPharmacy] = useState(false);
  const [searchingProduct, setSearchingProduct] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const totals = useMemo(() => calculateTotals(lines, shippingAmountHt), [lines, shippingAmountHt]);
  const isAgent = brand.role === "agent";

  async function findPharmacies() {
    if (pharmacySearch.trim().length < 2) {
      setError("Saisissez au moins 2 caractères pour rechercher une pharmacie.");
      return;
    }
    setSearchingPharmacy(true);
    setError(null);
    try {
      setPharmacyResults(await searchOrderPharmacies(brand.id, pharmacySearch));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSearchingPharmacy(false);
    }
  }

  async function findProducts() {
    if (productSearch.trim().length < 2) {
      setError("Saisissez au moins 2 caractères pour rechercher un produit.");
      return;
    }
    setSearchingProduct(true);
    setError(null);
    try {
      const results = await searchOrderProducts(brand.id, productSearch);
      const selectedIds = new Set(lines.map((line) => line.product.productId));
      setProductResults(results.filter((product) => !selectedIds.has(product.productId)));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSearchingProduct(false);
    }
  }

  function selectPharmacy(selected: OrderPharmacySelection) {
    setPharmacy(selected);
    setPharmacySearch(selected.name);
    setPharmacyResults([]);
    setError(null);
  }

  function addProduct(product: OrderProductSelection) {
    if (lines.some((line) => line.product.productId === product.productId)) return;
    setLines((current) => [
      ...current,
      {
        key: product.productId,
        product,
        quantity: "1",
        freeQuantity: "0",
        unitPriceHt: product.unitPriceHt == null ? "" : String(product.unitPriceHt),
        discountRate: "",
      },
    ]);
    setProductSearch("");
    setProductResults([]);
    setError(null);
  }

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function review() {
    const validation = buildConfirmation("draft");
    if (typeof validation === "string") {
      setError(validation);
      return;
    }
    setError(null);
    setStage("review");
  }

  function buildConfirmation(status: ManualOrderStatus): ManualOrderConfirmation | string {
    if (!pharmacy) return "Sélectionnez une pharmacie avant de poursuivre.";
    if (!orderDate.trim()) return "La date de commande est obligatoire.";
    if (lines.length === 0) return "Ajoutez au moins un produit à la commande.";

    const shipping = parseDecimal(shippingAmountHt);
    if (!Number.isFinite(shipping) || shipping < 0) return "Les frais de livraison sont invalides.";

    const normalizedLines = [] as ManualOrderConfirmation["lines"];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const freeQuantity = Number(line.freeQuantity || 0);
      const unitPriceHt = parseDecimal(line.unitPriceHt);
      const discountRate = line.discountRate.trim() ? parseDecimal(line.discountRate) : null;

      if (!Number.isInteger(quantity) || quantity <= 0) return `Quantité invalide pour ${line.product.name}.`;
      if (!Number.isInteger(freeQuantity) || freeQuantity < 0) return `Unités gratuites invalides pour ${line.product.name}.`;
      if (!Number.isFinite(unitPriceHt)) return `Prix HT invalide pour ${line.product.name}.`;
      if (discountRate != null && (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100)) {
        return `Remise invalide pour ${line.product.name}.`;
      }

      normalizedLines.push({
        product: line.product,
        quantity,
        freeQuantity,
        unitPriceHt,
        discountRate,
      });
    }

    return {
      brandId: brand.id,
      pharmacy,
      orderNumber: orderNumber.trim() || undefined,
      externalOrderId: externalOrderId.trim() || undefined,
      orderType,
      orderStatus: status,
      orderDate: orderDate.trim(),
      shippingAmountHt: shipping,
      notes: notes.trim() || undefined,
      lines: normalizedLines,
    };
  }

  async function submit(status: ManualOrderStatus) {
    const payload = buildConfirmation(status);
    if (typeof payload === "string") {
      setError(payload);
      setStage("edit");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmManualOrder(payload);
      setSuccessMessage(result.success || "Commande créée.");
      setCreatedOrderId(result.orderId ?? null);
      setStage("success");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "success") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.page}>
          <Header onBack={onDone} eyebrow="COMMANDE CRÉÉE" title="C’est enregistré" subtitle={successMessage} />
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>{isAgent ? "La commande suit maintenant le circuit de validation TR1." : "La commande est disponible dans TR1."}</Text>
            {createdOrderId ? <Text style={styles.successMeta}>ID TR1 · {createdOrderId}</Text> : null}
          </View>
          <Pressable onPress={onDone} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Retour à l’accueil</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === "review") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.page}>
          <Header onBack={() => setStage("edit")} eyebrow="REVUE" title="Vérifier la commande" subtitle="Aucune commande n’est créée tant que vous n’utilisez pas un bouton de validation ci-dessous." />

          {error ? <ErrorCard message={error} /> : null}

          <View style={styles.summaryCard}>
            <Info label="Pharmacie" value={pharmacy?.name || "—"} />
            <Info label="Date" value={orderDate} />
            <Info label="Type" value={orderTypeLabel(orderType)} />
            <Info label="N° commande" value={orderNumber.trim() || "Non renseigné"} />
            <Info label="Réf. externe" value={externalOrderId.trim() || "Non renseignée"} />
          </View>

          <Text style={styles.sectionTitle}>Produits</Text>
          {lines.map((line) => {
            const quantity = Number(line.quantity) || 0;
            const price = parseDecimal(line.unitPriceHt);
            const discount = line.discountRate.trim() ? parseDecimal(line.discountRate) : 0;
            const net = Number.isFinite(price) ? quantity * price * (1 - (Number.isFinite(discount) ? discount : 0) / 100) : 0;
            return (
              <View key={line.key} style={styles.reviewLine}>
                <View style={styles.flex}>
                  <Text style={styles.lineTitle}>{line.product.name}</Text>
                  <Text style={styles.lineMeta}>{line.product.sku || line.product.ean || "Référence non renseignée"}</Text>
                  <Text style={styles.lineMeta}>{line.quantity} payée(s) · {line.freeQuantity || "0"} gratuite(s) · remise {line.discountRate || "0"}%</Text>
                </View>
                <Text style={styles.reviewAmount}>{currency(net)}</Text>
              </View>
            );
          })}

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Montants estimés</Text>
          <View style={styles.summaryCard}>
            <Info label="Sous-total HT" value={currency(totals.subtotal)} />
            <Info label="Remises" value={currency(totals.discount)} />
            <Info label="Net HT" value={currency(totals.net)} />
            <Info label="Livraison HT" value={currency(totals.shipping)} />
            <Info label="Total HT estimé" value={currency(totals.net + totals.shipping)} strong />
          </View>

          {notes.trim() ? <View style={styles.noteCard}><Text style={styles.noteLabel}>NOTE</Text><Text style={styles.noteText}>{notes.trim()}</Text></View> : null}

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Validation explicite requise</Text>
            <Text style={styles.warningText}>{isAgent ? "Le brouillon reste modifiable. « Envoyer à la marque » crée la commande au statut En attente de validation." : "Le brouillon reste modifiable. « Valider la commande » crée directement une commande confirmée."}</Text>
          </View>

          <Pressable disabled={submitting} onPress={() => void submit("draft")} style={[styles.secondaryButton, submitting && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>Enregistrer en brouillon</Text>
          </Pressable>
          <Pressable disabled={submitting} onPress={() => void submit(isAgent ? "pending" : "confirmed")} style={[styles.primaryButton, submitting && styles.disabled]}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>{isAgent ? "Envoyer à la marque" : "Valider la commande"}</Text>}
          </Pressable>
          <Pressable disabled={submitting} onPress={() => setStage("edit")} style={styles.editButton}><Text style={styles.editButtonText}>Modifier la saisie</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header onBack={onBack} eyebrow="COMMANDE MANUELLE" title="Saisir une commande" subtitle="Saisie terrain sans photo. La création n’intervient qu’après une revue complète." />

        {error ? <ErrorCard message={error} /> : null}

        <Text style={styles.sectionTitle}>1. Pharmacie</Text>
        {pharmacy ? (
          <View style={styles.selectedCard}>
            <View style={styles.flex}><Text style={styles.selectedTitle}>{pharmacy.name}</Text><Text style={styles.selectedMeta}>{pharmacy.postalCode || "Code postal non renseigné"}</Text></View>
            <Pressable onPress={() => { setPharmacy(null); setPharmacySearch(""); }}><Text style={styles.changeText}>Changer</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.searchRow}>
              <TextInput value={pharmacySearch} onChangeText={setPharmacySearch} placeholder="Nom, ville, CIP…" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => void findPharmacies()} />
              <Pressable onPress={() => void findPharmacies()} style={styles.searchButton}>{searchingPharmacy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchButtonText}>Chercher</Text>}</Pressable>
            </View>
            {pharmacyResults.map((result) => (
              <Pressable key={`${result.brandPharmacyId || "global"}-${result.pharmacyId}`} onPress={() => selectPharmacy(result)} style={styles.resultCard}>
                <Text style={styles.resultTitle}>{result.name}</Text><Text style={styles.resultMeta}>{result.postalCode || "Code postal non renseigné"}</Text>
              </Pressable>
            ))}
          </>
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>2. Informations</Text>
        <FieldLabel label="Date de commande" />
        <TextInput value={orderDate} onChangeText={setOrderDate} placeholder="AAAA-MM-JJ" placeholderTextColor="#98A2B3" style={styles.input} autoCapitalize="none" />

        <FieldLabel label="Type de commande" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {orderTypes.map((type) => {
            const active = orderType === type.value;
            return <Pressable key={type.value} onPress={() => setOrderType(type.value)} style={[styles.typeChip, active && styles.typeChipActive]}><Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type.label}</Text></Pressable>;
          })}
        </ScrollView>

        <FieldLabel label="N° de commande (optionnel)" />
        <TextInput value={orderNumber} onChangeText={setOrderNumber} placeholder="Ex. BC-2026-0042" placeholderTextColor="#98A2B3" style={styles.input} maxLength={120} />
        <FieldLabel label="Référence externe (optionnelle)" />
        <TextInput value={externalOrderId} onChangeText={setExternalOrderId} placeholder="Référence ERP / laboratoire" placeholderTextColor="#98A2B3" style={styles.input} maxLength={120} />

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>3. Produits</Text>
        <View style={styles.searchRow}>
          <TextInput value={productSearch} onChangeText={setProductSearch} placeholder="Rechercher un produit" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => void findProducts()} />
          <Pressable onPress={() => void findProducts()} style={styles.searchButton}>{searchingProduct ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchButtonText}>Chercher</Text>}</Pressable>
        </View>
        {productResults.map((product) => (
          <Pressable key={product.productId} onPress={() => addProduct(product)} style={styles.resultCard}>
            <Text style={styles.resultTitle}>{product.name}</Text><Text style={styles.resultMeta}>{product.sku || product.ean || "Référence non renseignée"}{product.unitPriceHt != null ? ` · ${currency(product.unitPriceHt)} HT` : ""}</Text>
          </Pressable>
        ))}

        {lines.map((line, index) => (
          <View key={line.key} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <View style={styles.flex}><Text style={styles.lineIndex}>LIGNE {index + 1}</Text><Text style={styles.lineTitle}>{line.product.name}</Text><Text style={styles.lineMeta}>{line.product.sku || line.product.ean || "Référence non renseignée"}</Text></View>
              <Pressable onPress={() => removeLine(line.key)}><Text style={styles.removeText}>Retirer</Text></Pressable>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><FieldLabel label="Qté payée" /><TextInput value={line.quantity} onChangeText={(value) => updateLine(line.key, { quantity: value })} keyboardType="number-pad" style={styles.input} /></View>
              <View style={styles.column}><FieldLabel label="Qté gratuite" /><TextInput value={line.freeQuantity} onChangeText={(value) => updateLine(line.key, { freeQuantity: value })} keyboardType="number-pad" style={styles.input} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><FieldLabel label="Prix unitaire HT" /><TextInput value={line.unitPriceHt} onChangeText={(value) => updateLine(line.key, { unitPriceHt: value })} keyboardType="decimal-pad" style={styles.input} /></View>
              <View style={styles.column}><FieldLabel label="Remise %" /><TextInput value={line.discountRate} onChangeText={(value) => updateLine(line.key, { discountRate: value })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /></View>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>4. Finaliser la saisie</Text>
        <FieldLabel label="Frais de livraison HT" />
        <TextInput value={shippingAmountHt} onChangeText={setShippingAmountHt} keyboardType="decimal-pad" style={styles.input} />
        <FieldLabel label="Note (optionnelle)" />
        <TextInput value={notes} onChangeText={setNotes} placeholder="Contexte utile pour la marque…" placeholderTextColor="#98A2B3" style={[styles.input, styles.multiline]} multiline maxLength={4000} textAlignVertical="top" />

        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>TOTAL HT ESTIMÉ</Text>
          <Text style={styles.totalPreviewValue}>{currency(totals.net + totals.shipping)}</Text>
          <Text style={styles.totalPreviewMeta}>{lines.length} ligne(s) · hors calcul fiscal final TR1</Text>
        </View>

        <Pressable onPress={review} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Revoir avant validation</Text></Pressable>
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

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.infoStrong]}>{value}</Text></View>;
}

function ErrorCard({ message }: { message: string }) {
  return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text></View>;
}

function calculateTotals(lines: EditableLine[], shippingValue: string) {
  let subtotal = 0;
  let discount = 0;
  for (const line of lines) {
    const quantity = Number(line.quantity);
    const unitPrice = parseDecimal(line.unitPriceHt);
    const discountRate = line.discountRate.trim() ? parseDecimal(line.discountRate) : 0;
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(discountRate)) continue;
    const gross = quantity * unitPrice;
    subtotal += gross;
    discount += gross * Math.min(Math.max(discountRate, 0), 100) / 100;
  }
  const shipping = parseDecimal(shippingValue);
  return { subtotal, discount, net: subtotal - discount, shipping: Number.isFinite(shipping) ? Math.max(shipping, 0) : 0 };
}

function parseDecimal(value: string) {
  return Number(value.trim().replace(",", "."));
}

function localDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function orderTypeLabel(value: ManualOrderType) {
  return orderTypes.find((type) => type.value === value)?.label || value;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Une erreur TR1 est survenue.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 46 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 16 },
  backText: { fontSize: 31, lineHeight: 33, color: "#111827" },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 5 },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  sectionSpacing: { marginTop: 24 },
  fieldLabel: { color: "#475467", fontSize: 11, fontWeight: "700", marginBottom: 6, marginTop: 8 },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#FFF", paddingHorizontal: 13, color: "#111827", fontSize: 14 },
  multiline: { minHeight: 92, paddingTop: 12 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, backgroundColor: "#FFF", paddingHorizontal: 13, color: "#111827", fontSize: 14 },
  searchButton: { minWidth: 84, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#3B5BDB", paddingHorizontal: 12 },
  searchButtonText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  resultCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 13, backgroundColor: "#FFF", padding: 12, marginBottom: 7 },
  resultTitle: { color: "#111827", fontSize: 13, fontWeight: "800" },
  resultMeta: { color: "#667085", fontSize: 10, marginTop: 3 },
  selectedCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#C7D2FE", borderRadius: 15, backgroundColor: "#EEF2FF", padding: 14 },
  selectedTitle: { color: "#111827", fontSize: 14, fontWeight: "800" },
  selectedMeta: { color: "#667085", fontSize: 11, marginTop: 3 },
  changeText: { color: "#3B5BDB", fontSize: 11, fontWeight: "800" },
  typeRow: { gap: 7, paddingBottom: 4 },
  typeChip: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 99, backgroundColor: "#FFF", paddingHorizontal: 12, paddingVertical: 8 },
  typeChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  typeChipText: { color: "#667085", fontSize: 11, fontWeight: "700" },
  typeChipTextActive: { color: "#FFF" },
  lineCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 17, backgroundColor: "#FFF", padding: 14, marginTop: 9 },
  lineHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  lineIndex: { color: "#3B5BDB", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  lineTitle: { color: "#111827", fontSize: 13, fontWeight: "800", marginTop: 2 },
  lineMeta: { color: "#667085", fontSize: 10, lineHeight: 15, marginTop: 3 },
  removeText: { color: "#B42318", fontSize: 10, fontWeight: "800" },
  twoColumns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  totalPreview: { borderRadius: 18, backgroundColor: "#111827", padding: 18, marginTop: 18, marginBottom: 14 },
  totalPreviewLabel: { color: "#A5B4FC", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  totalPreviewValue: { color: "#FFF", fontSize: 25, fontWeight: "800", marginTop: 5 },
  totalPreviewMeta: { color: "#D0D5DD", fontSize: 10, marginTop: 4 },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#3B5BDB", paddingHorizontal: 16, marginTop: 10 },
  primaryButtonText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  secondaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", paddingHorizontal: 16, marginTop: 10 },
  secondaryButtonText: { color: "#3B5BDB", fontSize: 13, fontWeight: "800" },
  editButton: { alignItems: "center", justifyContent: "center", padding: 14 },
  editButtonText: { color: "#667085", fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  errorCard: { borderRadius: 15, backgroundColor: "#FEF3F2", padding: 14, marginBottom: 14 },
  errorText: { color: "#B42318", fontSize: 12, lineHeight: 18 },
  summaryCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 15, marginBottom: 18 },
  infoRow: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  infoLabel: { color: "#667085", fontSize: 11 },
  infoValue: { flex: 1, color: "#111827", fontSize: 11, fontWeight: "700", textAlign: "right" },
  infoStrong: { fontSize: 13, fontWeight: "800" },
  reviewLine: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 15, backgroundColor: "#FFF", padding: 13, marginBottom: 8 },
  reviewAmount: { color: "#111827", fontSize: 12, fontWeight: "800" },
  noteCard: { borderRadius: 15, backgroundColor: "#F2F4F7", padding: 14, marginBottom: 14 },
  noteLabel: { color: "#667085", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  noteText: { color: "#344054", fontSize: 12, lineHeight: 18, marginTop: 4 },
  warningCard: { borderRadius: 15, backgroundColor: "#FFFAEB", borderWidth: 1, borderColor: "#FEDF89", padding: 14, marginBottom: 4 },
  warningTitle: { color: "#93370D", fontSize: 12, fontWeight: "800" },
  warningText: { color: "#93370D", fontSize: 11, lineHeight: 17, marginTop: 4 },
  successCard: { borderRadius: 18, backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#ABEFC6", padding: 18, marginBottom: 14 },
  successTitle: { color: "#067647", fontSize: 14, lineHeight: 21, fontWeight: "800" },
  successMeta: { color: "#067647", fontSize: 10, marginTop: 6 },
});