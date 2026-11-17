"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, Camera, CheckCircle2, Info, ScanBarcode, ShieldCheck, Square, X } from "lucide-react";
import type { PharmacyProductWithVisuals } from "@/lib/catalogue-private-product-visuals";
import type { CommercialQuantityGroup } from "@/lib/catalogue-commercial";
import { firstOrderQuantity } from "@/lib/private-catalogue-format";
import { parseFrenchAmount } from "@/lib/catalogue-csv-comparison";
import {
  decodeEan13ImageData,
  findExactEanProduct,
  normalizeScannedEan,
} from "@/lib/catalogue-ean-scanner";

type BrowserBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = {
  new(options: { formats: string[] }): BrowserBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type Offer =
  | { kind: "contractual"; price: number; minimum: number; label: string }
  | { kind: "indicative"; min: number; max: number; minimum: number; label: string }
  | { kind: "none" };

function money(number: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(number);
}

function getOffer(product: PharmacyProductWithVisuals, quantityGroups: CommercialQuantityGroup[]): Offer {
  const tiers = [...product.pricing.tiers].sort((a,b) => a.min_quantity - b.min_quantity);
  const first = tiers[0];
  if (!first) return { kind: "none" };
  const group = quantityGroups.find((item) => item.product_ids.includes(product.id));
  const minimum = group
    ? firstOrderQuantity(
      Math.max(first.min_quantity, group.minimum_total_units, product.min_quantity),
      group.quantity_multiple,
    )
    : firstOrderQuantity(
      Math.max(first.min_quantity, product.min_quantity),
      product.quantity_step,
    );
  if (!minimum) return { kind: "none" };
  const label = group ? "dès " + minimum + " unités cumulées sur la gamme" : "dès " + minimum + " unités";
  if ("price_ht" in first) {
    const price = Number(first.price_ht);
    return Number.isFinite(price) && price >= 0
      ? { kind: "contractual", price, minimum, label }
      : { kind: "none" };
  }
  const min = Number(first.price_min_ht);
  const max = Number(first.price_max_ht);
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min
    ? { kind: "indicative", min, max, minimum, label }
    : { kind: "none" };
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Caméra refusée. Autorisez-la dans les réglages du navigateur ou saisissez l’EAN.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Aucune caméra disponible. Saisissez le code EAN sous le scanner.";
  if (name === "NotReadableError") return "La caméra est déjà utilisée ou inaccessible. Fermez l’autre application, ou saisissez le code EAN.";
  return "Impossible d'ouvrir la caméra. Vous pouvez saisir le code EAN manuellement.";
}

export function PharmacyEanScanner({
  products,
  quantityGroups,
}: {
  products: PharmacyProductWithVisuals[];
  quantityGroups: CommercialQuantityGroup[];
}) {
  const [eanInput, setEanInput] = useState("");
  const [ean, setEan] = useState<string | null>(null);
  const [currentPurchasePrice, setCurrentPurchasePrice] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [inputError, setInputError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [notice, setNotice] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const scanningRef = useRef(false);

  const releaseCamera = useCallback(() => {
    sessionRef.current += 1;
    scanningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setIsScanning(false);
    setIsStarting(false);
  }, [releaseCamera]);

  useEffect(() => () => releaseCamera(), [releaseCamera]);

  const resolved = useMemo(
    () => (ean ? findExactEanProduct(ean, products) : null),
    [ean, products],
  );
  const product = resolved?.status === "found" ? resolved.product : null;
  const offer = useMemo(
    () => (product ? getOffer(product, quantityGroups) : { kind: "none" as const }),
    [product, quantityGroups],
  );
  const enteredPrice = currentPurchasePrice.trim() ? parseFrenchAmount(currentPurchasePrice) : null;
  const priceUsable = enteredPrice !== null && enteredPrice <= 100000;

  const comparison = useMemo(() => {
    if (!priceUsable || enteredPrice === null || offer.kind === "none") return null;
    if (offer.kind === "contractual") {
      const gap = enteredPrice - offer.price;
      return Math.abs(gap) < 0.005
        ? "Prix d’achat équivalents."
        : gap > 0
          ? "TR1 moins cher de " + money(gap) + " HT / unité."
          : "TR1 plus cher de " + money(-gap) + " HT / unité.";
    }
    if (enteredPrice > offer.max + 0.005) {
      return "Écart potentiellement favorable : " + money(enteredPrice - offer.max) + " à " + money(enteredPrice - offer.min) + " HT / unité (indicatif).";
    }
    if (enteredPrice < offer.min - 0.005) {
      return "TR1 potentiellement plus cher de " + money(offer.min - enteredPrice) + " à " + money(offer.max - enteredPrice) + " HT / unité (indicatif).";
    }
    return "Votre prix se situe dans la fourchette indicative TR1.";
  }, [offer, enteredPrice, priceUsable]);

  function resolveCode(raw: string) {
    const normalized = normalizeScannedEan(raw);
    if (!normalized) {
      setInputError("EAN-13 incorrect : vérifiez les 13 chiffres et la clé de contrôle.");
      return;
    }
    stopCamera();
    setEanInput(normalized);
    setEan(normalized);
    setInputError("");
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resolveCode(eanInput);
  }

  async function startCamera() {
    if (isStarting || isScanning) return;
    setCameraError("");
    setInputError("");
    setNotice("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Caméra non disponible dans ce navigateur. Utilisez une connexion HTTPS ou saisissez l’EAN.");
      return;
    }
    releaseCamera();
    const session = sessionRef.current;
    setIsStarting(true);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("VideoElementMissing");
      video.srcObject = stream;
      await video.play();
      if (sessionRef.current !== session) return;
      setIsStarting(false);
      scanningRef.current = true;
      setNotice("Placez les barres du code EAN à l’horizontale dans le cadre.");

      let detector: BrowserBarcodeDetector | null = null;
      const Constructor = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (Constructor) {
        try {
          const formats = await Constructor.getSupportedFormats?.();
          if (!formats || formats.includes("ean_13")) detector = new Constructor({ formats: ["ean_13"] });
        } catch {
          // Le décodeur local reste opérationnel lorsque l'API native échoue.
        }
      }
      if (sessionRef.current !== session) return;

      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 160;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      let previousCheck = 0;
      const frame = async (timestamp: number) => {
        if (!scanningRef.current || sessionRef.current !== session) return;
        if (timestamp - previousCheck < 230) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        previousCheck = timestamp;
        try {
          let decoded: string | null = null;
          if (detector) {
            try {
              const scanned = await detector.detect(video);
              decoded = scanned.map((item) => normalizeScannedEan(item.rawValue)).find(Boolean) ?? null;
            } catch {
              // Fallback lorsque la détection native n'est pas disponible pour ce flux.
            }
          }
          if (!decoded && context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
            context.drawImage(video, 0, video.videoHeight * 0.25, video.videoWidth, video.videoHeight * 0.5, 0, 0, canvas.width, canvas.height);
            decoded = decodeEan13ImageData(context.getImageData(0, 0, canvas.width, canvas.height));
          }
          if (!scanningRef.current || sessionRef.current !== session) return;
          if (decoded) {
            stopCamera();
            setEanInput(decoded);
            setEan(decoded);
            setNotice("Code EAN reconnu.");
            return;
          }
        } catch {
          // L'aperçu reste actif, avec saisie manuelle disponible à tout moment.
        }
        if (scanningRef.current && sessionRef.current === session) rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    } catch (error) {
      if (sessionRef.current === session) {
        setCameraError(cameraErrorMessage(error));
        stopCamera();
      }
    }
  }

  function reset() {
    stopCamera();
    setEan(null);
    setEanInput("");
    setCurrentPurchasePrice("");
    setInputError("");
    setCameraError("");
    setNotice("");
  }

  return (
    <section id="scanner-ean" aria-label="Scanner et comparer un code-barres" className="scroll-mt-24 space-y-5 rounded-2xl border border-[#ceded4] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ef] text-[#315b47]">
          <ScanBarcode size={23} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#ad4b08]">Rapide sur mobile</p>
          <h2 className="text-xl font-black text-[#142941]">Scanner un produit et comparer</h2>
        </div>
      </div>
      <p className="text-sm leading-6 text-[#596879]">
        Scannez le code-barres d’un produit de votre rayon. Si ce même EAN figure dans votre catalogue TR1 autorisé, son tarif professionnel apparaît. Renseignez votre prix d’achat net HT pour comparer.
      </p>

      <div className="space-y-3">
        <div className={isScanning ? "relative overflow-hidden rounded-xl bg-[#101923]" : "hidden"}>
          <video ref={videoRef} muted playsInline autoPlay aria-label="Aperçu caméra du code-barres" className="aspect-[4/3] max-h-[360px] w-full object-cover" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[9%] top-[36%] h-[28%] rounded-md border-2 border-[#ffae60] shadow-[0_0_0_1000px_rgba(0,0,0,0.15)]" />
          {isStarting ? <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/95 px-3 py-2 text-center text-xs font-bold text-[#142941]">Ouverture de la caméra…</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isScanning ? (
            <button type="button" onClick={startCamera} disabled={isStarting}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#142941] px-5 text-sm font-extrabold text-white hover:bg-[#213c5c] disabled:opacity-50">
              <Camera size={18} aria-hidden="true" /> Ouvrir le scanner
            </button>
          ) : (
            <button type="button" onClick={stopCamera}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[#dce3e8] bg-white px-5 text-sm font-extrabold text-[#142941]">
              <Square size={16} aria-hidden="true" /> Arrêter le scan
            </button>
          )}
          {ean ? (
            <button type="button" onClick={reset} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#dce3e8] px-4 text-sm font-bold text-[#405267]">
              <X size={16} aria-hidden="true" /> Effacer
            </button>
          ) : null}
        </div>
        {cameraError ? <p role="alert" className="flex items-start gap-2 rounded-lg bg-[#fff6f1] p-3 text-sm text-[#874b2c]"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{cameraError}</p> : null}
        {notice && isScanning ? <p className="text-center text-xs text-[#596879]" role="status">{notice}</p> : null}

        <form onSubmit={onManualSubmit} className="space-y-2">
          <label htmlFor="comparison-manual-ean" className="block text-sm font-bold text-[#142941]">Ou saisir le code EAN-13</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="comparison-manual-ean" type="text" inputMode="numeric" autoComplete="off" maxLength={17}
              value={eanInput} onChange={(e) => setEanInput(e.target.value)}
              placeholder="13 chiffres du code-barres" aria-describedby={inputError ? "comparison-ean-error" : undefined}
              className="min-h-12 w-full flex-1 rounded-lg border border-[#cbd6dd] bg-white px-4 font-mono text-base text-[#142941]" />
            <button type="submit" className="min-h-12 rounded-lg border border-[#142941] px-6 text-sm font-extrabold text-[#142941] hover:bg-[#f7f8f7]">Comparer</button>
          </div>
          {inputError ? <p role="alert" id="comparison-ean-error" className="text-xs font-semibold text-[#ae4e2a]">{inputError}</p> : null}
        </form>
        <p className="flex items-start gap-2 text-xs leading-5 text-[#617281]">
          <ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0"/>
          Le code scanné et votre prix d’achat sont traités uniquement dans votre navigateur. Aucune photo n’est transmise à TR1.
        </p>
      </div>

      {ean && resolved ? (
        <div aria-live="polite" className="space-y-4 rounded-xl border border-[#e0e7e2] bg-[#f7faf8] p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold text-[#315b47]">
            <CheckCircle2 size={16} aria-hidden="true" /> EAN identifié : <span className="font-mono">{ean}</span>
          </p>
          {resolved.status === "found" && product ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#a85f25]">{product.brand_name}</p>
                <h3 className="mt-1 text-lg font-black text-[#142941]">{product.name}</h3>
                <p className="mt-1 text-xs text-[#69717d]">Correspondance exacte par EAN · {product.format || "Conditionnement à vérifier"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-bold text-[#69717d]">Offre TR1 · prix unitaire HT</p>
                  {offer.kind === "contractual" ? (
                    <p className="mt-2 text-2xl font-black tabular-nums text-[#142941]">{money(offer.price)}</p>
                  ) : offer.kind === "indicative" ? (
                    <p className="mt-2 text-2xl font-black tabular-nums text-[#142941]">{money(offer.min)}{offer.max > offer.min ? " – " + money(offer.max) : ""}</p>
                  ) : <p className="mt-2 text-sm font-bold text-[#596879]">À confirmer</p>}
                  {offer.kind !== "none" ? <p className="mt-1 text-xs leading-5 text-[#69717d]">{offer.kind === "indicative" ? "Tarif indicatif" : "Tarif contractuel"} · {offer.label}</p> : null}
                </div>
                <label className="block rounded-xl bg-white p-4">
                  <span className="text-xs font-bold text-[#69717d]">Votre prix d’achat net unitaire HT</span>
                  <span className="mt-3 flex items-center gap-2">
                    <input type="text" inputMode="decimal" value={currentPurchasePrice}
                      onChange={(event) => setCurrentPurchasePrice(event.target.value)}
                      aria-label="Votre prix d’achat HT" placeholder="Ex. 12,50"
                      className="min-h-11 w-full min-w-0 rounded-lg border border-[#dce3e8] px-3 text-base font-bold text-[#142941]" />
                    <span className="font-semibold text-[#596879]">€</span>
                  </span>
                  {currentPurchasePrice.trim() && !priceUsable ? <span className="mt-1 block text-xs text-[#ae4e2a]">Saisissez un montant HT positif valide.</span> : null}
                </label>
              </div>
              {comparison ? <p role="status" className="rounded-xl border border-[#d8e9df] bg-white px-4 py-3 text-sm font-extrabold leading-6 text-[#315b47]">{comparison}</p> : null}
              {offer.kind === "indicative" ? (
                <p className="flex gap-2 text-xs leading-5 text-[#7a654c]">
                  <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>
                  Tarif indicatif non garanti, selon quantité et conditions commerciales. Frais de port et remises différées non inclus.
                </p>
              ) : null}
              <Link href={product.product_detail_href || "/catalogue"}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142941] px-5 text-sm font-extrabold text-white hover:bg-[#213c5c]">
                Voir la fiche et les conditions de commande
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-base font-black text-[#142941]">
                {resolved.status === "ambiguous" ? "Plusieurs fiches partagent cet EAN." : "Référence non disponible dans votre catalogue TR1."}
              </h3>
              <p className="text-sm leading-6 text-[#596879]">
                {resolved.status === "ambiguous"
                  ? "Aucune comparaison automatique n’est effectuée : contactez TR1 pour confirmer le conditionnement exact."
                  : "Ce code-barres n’a pas de correspondance exacte dans les marques autorisées à votre officine. Aucune substitution par un produit similaire n’est faite automatiquement."}
              </p>
              <Link href="/catalogue" className="inline-flex min-h-10 items-center font-bold text-[#ad4b08] underline underline-offset-4">Explorer les produits TR1</Link>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
