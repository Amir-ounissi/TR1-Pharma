import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  analyzeOrderPhoto,
  confirmOrderPreview,
  searchOrderPharmacies,
  searchOrderProducts,
  type MobileOrderPreview,
  type OrderPharmacySelection,
  type OrderProductSelection,
  type OrderPreviewLine,
} from "../lib/order-api";

type Step = "capture" | "review";

export function OrderWorkflow({ brand, onBack, onDone }: { brand: BrandContext; onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>("capture");
  const [preview, setPreview] = useState<MobileOrderPreview | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  if (step === "review" && preview) {
    return (
      <OrderReview
        brand={brand}
        preview={preview}
        photoUri={photoUri}
        onBack={() => setStep("capture")}
        onDone={onDone}
      />
    );
  }

  return (
    <OrderCapture
      brand={brand}
      onBack={onBack}
      onAnalyzed={(uri, nextPreview) => {
        setPhotoUri(uri);
        setPreview(nextPreview);
        setStep("review");
      }}
    />
  );
}

function OrderCapture({ brand, onBack, onAnalyzed }: { brand: BrandContext; onBack: () => void; onAnalyzed: (photoUri: string, preview: MobileOrderPreview) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeAsset(asset: ImagePicker.ImagePickerAsset) {
    try {
      setBusy(true);
      setError(null);
      const nextPreview = await analyzeOrderPhoto(asset, brand.id);
      onAnalyzed(asset.uri, nextPreview);
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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
      quality: 1,
    });
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
        <Text style={styles.title}>Scanner une commande</Text>
        <Text style={styles.subtitle}>Cadrez le bon entier, à plat et avec une lumière homogène. TR1 réduit la photo avant analyse.</Text>

        <View style={styles.captureHero}>
          <Text style={styles.captureIcon}>▣</Text>
          <Text style={styles.captureTitle}>Photo du bon de commande</Text>
          <Text style={styles.captureText}>Aucune commande n’est créée automatiquement. Vous contrôlez les données avant validation.</Text>
        </View>

        {error ? <ErrorCard message={error} /> : null}
        <Pressable disabled={busy} onPress={() => void takePhoto()} style={[styles.primaryButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Prendre une photo</Text>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void choosePhoto()} style={[styles.secondaryButton, busy && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>Choisir une photo existante</Text>
        </Pressable>
        {busy ? <Text style={styles.analysisText}>Analyse TR1 en cours… pharmacie, produits, quantités et UG.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function initialPharmacy(preview: MobileOrderPreview): OrderPharmacySelection | null {
  if (!preview.pharmacy.selectedBrandPharmacyId && !preview.pharmacy.selectedPharmacyId) return null;
  return {
    brandPharmacyId: preview.pharmacy.selectedBrandPharmacyId,
    pharmacyId: preview.pharmacy.selectedPharmacyId,
    name: preview.pharmacy.selectedName || preview.extraction.pharmacy.name || "Pharmacie",
    postalCode: preview.extraction.pharmacy.postalCode,
  };
}

function initialProducts(preview: MobileOrderPreview): Record<number, OrderProductSelection> {
  const result: Record<number, OrderProductSelection> = {};
  for (const line of preview.lines) {
    if (!line.product.selectedId) continue;
    const candidate = line.product.candidates.find((item) => item.id === line.product.selectedId);
    result[line.index] = {
      productId: line.product.selectedId,
      name: line.product.selectedName || candidate?.name || line.label || "Produit",
      sku: candidate?.sku ?? line.sku,
      ean: candidate?.ean ?? line.ean,
      unitPriceHt: line.suggestedPriceHt ?? candidate?.wholesalePriceHt ?? null,
    };
  }
  return result;
}

function OrderReview({ brand, preview, photoUri, onBack, onDone }: { brand: BrandContext; preview: MobileOrderPreview; photoUri: string | null; onBack: () => void; onDone: () => void }) {
  const [orderNumber, setOrderNumber] = useState(preview.extraction.orderNumber ?? "");
  const [orderDate, setOrderDate] = useState(preview.extraction.orderDate ?? "");
  const [pharmacy, setPharmacy] = useState<OrderPharmacySelection | null>(() => initialPharmacy(preview));
  const [products, setProducts] = useState<Record<number, OrderProductSelection>>(() => initialProducts(preview));
  const [pharmacyQuery, setPharmacyQuery] = useState(preview.extraction.pharmacy.name ?? "");
  const [pharmacyResults, setPharmacyResults] = useState<OrderPharmacySelection[]>(() => preview.pharmacy.candidates.map((candidate) => ({
    brandPharmacyId: candidate.brandPharmacyId,
    pharmacyId: candidate.pharmacyId,
    name: candidate.name,
    postalCode: candidate.postalCode,
  })));
  const [pharmacySearching, setPharmacySearching] = useState(false);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<OrderProductSelection[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalHt = useMemo(() => Number(preview.lines.reduce((total, line) => {
    const selected = products[line.index];
    const price = line.unitPriceHt ?? selected?.unitPriceHt;
    if (!line.quantity || price == null) return total;
    return total + line.quantity * price * (1 - (line.discountRate ?? 0) / 100);
  }, 0).toFixed(2)), [preview.lines, products]);

  const blockers = useMemo(() => {
    const values: string[] = [];
    if (!pharmacy) values.push("Pharmacie à confirmer");
    if (preview.lines.some((line) => !products[line.index])) values.push("Produit(s) à confirmer");
    if (preview.lines.some((line) => {
      const selected = products[line.index];
      return !line.quantity || (line.unitPriceHt ?? selected?.unitPriceHt) == null;
    })) values.push("Ligne(s) incomplète(s)");
    if (!orderNumber.trim()) values.push("Numéro de commande manquant");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) values.push("Date de commande manquante ou invalide");
    return values;
  }, [orderDate, orderNumber, pharmacy, preview.lines, products]);

  async function runPharmacySearch() {
    try {
      setPharmacySearching(true);
      setError(null);
      setPharmacyResults(await searchOrderPharmacies(brand.id, pharmacyQuery));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche pharmacie impossible.");
    } finally {
      setPharmacySearching(false);
    }
  }

  function openProductSearch(line: OrderPreviewLine) {
    setEditingLine(line.index);
    setProductQuery(line.label || line.sku || line.ean || "");
    setProductResults(line.product.candidates.map((candidate) => ({
      productId: candidate.id,
      name: candidate.name,
      sku: candidate.sku,
      ean: candidate.ean,
      unitPriceHt: line.unitPriceHt ?? candidate.wholesalePriceHt,
    })));
  }

  async function runProductSearch() {
    if (editingLine == null) return;
    try {
      setProductSearching(true);
      setError(null);
      const line = preview.lines.find((item) => item.index === editingLine);
      const results = await searchOrderProducts(brand.id, productQuery);
      setProductResults(results.map((candidate) => ({
        ...candidate,
        unitPriceHt: line?.unitPriceHt ?? candidate.unitPriceHt,
      })));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche produit impossible.");
    } finally {
      setProductSearching(false);
    }
  }

  function chooseProduct(lineIndex: number, selection: OrderProductSelection) {
    setProducts((current) => ({ ...current, [lineIndex]: selection }));
    setEditingLine(null);
    setProductResults([]);
  }

  async function confirm() {
    try {
      setPending(true);
      setError(null);
      const result = await confirmOrderPreview({
        brandId: brand.id,
        preview,
        orderNumber: orderNumber.trim(),
        orderDate,
        pharmacy,
        products,
      });
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
        <Text style={styles.title}>Contrôler avant validation</Text>
        <Text style={styles.subtitle}>TR1 ne crée la commande qu’après votre validation explicite.</Text>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}

        <View style={styles.summaryCard}>
          <Info label="Pharmacie" value={pharmacy?.name || preview.extraction.pharmacy.name || "À confirmer"} />
          <Info label="Matching initial" value={preview.pharmacy.status} />
          <Info label="Total calculé HT" value={currency(totalHt)} />
          <Info label="Total document HT" value={preview.extraction.totalHt == null ? "—" : currency(preview.extraction.totalHt)} />
        </View>

        <Text style={styles.sectionTitle}>Confirmer la pharmacie</Text>
        <View style={styles.searchRow}>
          <TextInput value={pharmacyQuery} onChangeText={setPharmacyQuery} style={styles.searchInput} placeholder="Nom, ville, CIP…" placeholderTextColor="#98A2B3" returnKeyType="search" onSubmitEditing={() => void runPharmacySearch()} />
          <Pressable onPress={() => void runPharmacySearch()} style={styles.searchButton}>{pharmacySearching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchButtonText}>Chercher</Text>}</Pressable>
        </View>
        {pharmacyResults.map((candidate) => {
          const selected = pharmacy?.pharmacyId === candidate.pharmacyId && pharmacy?.brandPharmacyId === candidate.brandPharmacyId;
          return (
            <Pressable key={`${candidate.brandPharmacyId ?? "global"}-${candidate.pharmacyId}`} onPress={() => setPharmacy(candidate)} style={[styles.choiceCard, selected && styles.choiceSelected]}>
              <View style={styles.flex}><Text style={styles.choiceTitle}>{candidate.name}</Text><Text style={styles.choiceMeta}>{candidate.postalCode || "Code postal non renseigné"}{candidate.brandPharmacyId ? " · déjà liée à la marque" : " · référentiel global"}</Text></View>
              <Text style={selected ? styles.selectedMark : styles.choiceMark}>{selected ? "✓" : "○"}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.fieldLabel}>N° de commande</Text>
        <TextInput value={orderNumber} onChangeText={setOrderNumber} style={styles.input} placeholder="Numéro de commande" placeholderTextColor="#98A2B3" />
        <Text style={styles.fieldLabel}>Date de commande</Text>
        <TextInput value={orderDate} onChangeText={setOrderDate} style={styles.input} placeholder="AAAA-MM-JJ" placeholderTextColor="#98A2B3" autoCapitalize="none" />
        {preview.extraction.deliveryDate ? <Text style={styles.deliveryNote}>Date de livraison détectée : {preview.extraction.deliveryDate} — elle n’est jamais utilisée comme date de commande.</Text> : null}

        <Text style={styles.sectionTitle}>Produits</Text>
        {preview.lines.map((line) => {
          const selected = products[line.index];
          const isEditing = editingLine === line.index;
          return (
            <View key={line.index} style={styles.lineBlock}>
              <View style={styles.orderLine}>
                <View style={styles.flex}>
                  <Text style={styles.lineTitle}>{selected?.name || line.label || line.sku || line.ean || "Produit à identifier"}</Text>
                  <Text style={styles.lineMeta}>{line.sku || line.ean || "Référence non lue"}</Text>
                  <Text style={selected ? styles.matched : styles.unmatched}>{selected ? "Produit TR1 confirmé" : "Correspondance à confirmer"}</Text>
                  <Pressable onPress={() => openProductSearch(line)}><Text style={styles.changeLink}>{selected ? "Changer le produit" : "Choisir le produit"}</Text></Pressable>
                </View>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantityValue}>{line.quantity ?? 0}</Text>
                  <Text style={styles.quantityLabel}>pay.</Text>
                  {line.freeQuantity > 0 ? <Text style={styles.freeQuantity}>+{line.freeQuantity} UG</Text> : null}
                </View>
              </View>
              {isEditing ? (
                <View style={styles.productPicker}>
                  <View style={styles.searchRowCompact}>
                    <TextInput value={productQuery} onChangeText={setProductQuery} style={styles.searchInput} placeholder="Nom du produit" placeholderTextColor="#98A2B3" returnKeyType="search" onSubmitEditing={() => void runProductSearch()} />
                    <Pressable onPress={() => void runProductSearch()} style={styles.searchButton}>{productSearching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchButtonText}>Chercher</Text>}</Pressable>
                  </View>
                  {productResults.map((candidate) => (
                    <Pressable key={candidate.productId} onPress={() => chooseProduct(line.index, candidate)} style={styles.productChoice}>
                      <View style={styles.flex}><Text style={styles.choiceTitle}>{candidate.name}</Text><Text style={styles.choiceMeta}>{candidate.sku || candidate.ean || "Référence non renseignée"} · {candidate.unitPriceHt == null ? "prix à vérifier" : currency(candidate.unitPriceHt)}</Text></View>
                      <Text style={styles.choiceMark}>›</Text>
                    </Pressable>
                  ))}
                  {!productSearching && productResults.length === 0 ? <Text style={styles.emptySearch}>Aucun candidat affiché. Lancez une recherche par nom.</Text> : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {preview.warnings.length ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Points à vérifier</Text>{preview.warnings.slice(0, 6).map((warning) => <Text key={warning} style={styles.warningText}>• {warning}</Text>)}</View> : null}
        {blockers.length ? <View style={styles.blockerCard}><Text style={styles.blockerTitle}>Validation bloquée</Text>{blockers.map((blocker) => <Text key={blocker} style={styles.blockerText}>• {blocker}</Text>)}</View> : null}
        {error ? <ErrorCard message={error} /> : null}

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>{success}</Text>
            <Pressable onPress={onDone} style={styles.successButton}><Text style={styles.successButtonText}>Retour à l’accueil</Text></Pressable>
          </View>
        ) : (
          <Pressable disabled={pending || blockers.length > 0} onPress={() => void confirm()} style={[styles.primaryButton, (pending || blockers.length > 0) && styles.disabled]}>
            {pending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Valider la commande</Text>}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderBack({ label, onBack }: { label: string; onBack: () => void }) { return <View style={styles.header}><Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.eyebrow}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function ErrorCard({ message }: { message: string }) { return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text></View>; }
function currency(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value); }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
  page: { padding: 22, paddingBottom: 44 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC" },
  backText: { color: "#111827", fontSize: 31, lineHeight: 33 },
  eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 20 },
  captureHero: { borderRadius: 22, backgroundColor: "#111827", padding: 22, alignItems: "center", marginBottom: 18 },
  captureIcon: { color: "#A5B4FC", fontSize: 40, marginBottom: 10 },
  captureTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  captureText: { color: "#D0D5DD", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 7 },
  primaryButton: { minHeight: 54, borderRadius: 15, backgroundColor: "#3B5BDB", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryButtonText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  analysisText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 14 },
  errorCard: { marginBottom: 14, padding: 14, borderRadius: 14, backgroundColor: "#FEF3F2" },
  errorText: { color: "#B42318", fontSize: 13, lineHeight: 19 },
  photo: { width: "100%", height: 190, borderRadius: 18, backgroundColor: "#E4E7EC", marginBottom: 16 },
  summaryCard: { borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, backgroundColor: "#FFF", paddingHorizontal: 16, marginBottom: 18 },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E7EC" },
  infoLabel: { color: "#667085", fontSize: 13 },
  infoValue: { flex: 1, color: "#111827", fontSize: 13, fontWeight: "700", textAlign: "right" },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "800", marginTop: 4, marginBottom: 10 },
  fieldLabel: { color: "#111827", fontSize: 12, fontWeight: "800", marginBottom: 6 },
  input: { minHeight: 49, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 14, fontSize: 15, color: "#111827", marginBottom: 13 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  searchRowCompact: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "#FFF", paddingHorizontal: 14, fontSize: 14, color: "#111827" },
  searchButton: { minWidth: 78, minHeight: 48, borderRadius: 14, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  searchButtonText: { color: "#FFF", fontWeight: "800", fontSize: 12 },
  choiceCard: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 14, backgroundColor: "#FFF", padding: 13, marginBottom: 7 },
  choiceSelected: { borderColor: "#818CF8", backgroundColor: "#EEF2FF" },
  choiceTitle: { color: "#111827", fontSize: 13, fontWeight: "800" },
  choiceMeta: { color: "#667085", fontSize: 11, lineHeight: 16, marginTop: 3 },
  choiceMark: { color: "#98A2B3", fontSize: 22 },
  selectedMark: { color: "#3B5BDB", fontSize: 20, fontWeight: "800" },
  deliveryNote: { color: "#596591", fontSize: 12, lineHeight: 18, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 18 },
  lineBlock: { marginBottom: 10 },
  orderLine: { flexDirection: "row", gap: 12, borderRadius: 16, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 14 },
  lineTitle: { color: "#111827", fontSize: 14, fontWeight: "800" },
  lineMeta: { color: "#667085", fontSize: 11, marginTop: 3 },
  matched: { color: "#067647", fontSize: 11, fontWeight: "700", marginTop: 7 },
  unmatched: { color: "#B42318", fontSize: 11, fontWeight: "700", marginTop: 7 },
  changeLink: { color: "#3B5BDB", fontSize: 11, fontWeight: "800", marginTop: 8 },
  quantityBox: { minWidth: 62, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#F2F4F7", padding: 8 },
  quantityValue: { color: "#111827", fontSize: 19, fontWeight: "800" },
  quantityLabel: { color: "#667085", fontSize: 9 },
  freeQuantity: { color: "#3B5BDB", fontSize: 10, fontWeight: "800", marginTop: 4 },
  productPicker: { borderWidth: 1, borderTopWidth: 0, borderColor: "#C7D2FE", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: "#F8F9FF", padding: 11 },
  productChoice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "#E4E7EC", padding: 11, marginTop: 6 },
  emptySearch: { color: "#667085", fontSize: 11, lineHeight: 17, padding: 8 },
  warningCard: { borderRadius: 16, backgroundColor: "#FFFAEB", padding: 15, marginTop: 10, marginBottom: 12 },
  warningTitle: { color: "#7A2E0E", fontSize: 13, fontWeight: "800", marginBottom: 5 },
  warningText: { color: "#854A0E", fontSize: 12, lineHeight: 18, marginTop: 2 },
  blockerCard: { borderRadius: 16, backgroundColor: "#FEF3F2", padding: 15, marginBottom: 12 },
  blockerTitle: { color: "#B42318", fontSize: 13, fontWeight: "800", marginBottom: 5 },
  blockerText: { color: "#B42318", fontSize: 12, lineHeight: 18 },
  successCard: { borderRadius: 18, backgroundColor: "#ECFDF3", padding: 18, alignItems: "center" },
  successTitle: { color: "#067647", fontSize: 16, fontWeight: "800", textAlign: "center" },
  successButton: { marginTop: 14, borderRadius: 13, backgroundColor: "#067647", paddingHorizontal: 16, paddingVertical: 12 },
  successButtonText: { color: "#FFF", fontWeight: "800" },
});
