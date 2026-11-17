import { isValidEan13 } from "@/lib/ean13";

/**
 * Décodage local des EAN-13 orientés horizontalement dans l'image.
 * Cette solution de repli évite de dépendre uniquement de l'API BarcodeDetector,
 * indisponible par défaut sur iOS Safari et Firefox.
 */
const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0111001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

export function normalizeScannedEan(value: string): string | null {
  const ean = value.trim().replace(/[\s-]/g, "");
  return isValidEan13(ean) ? ean : null;
}

export function findExactEanProduct<T extends { ean: string | null }>(
  ean: string,
  products: T[],
): { status: "found"; product: T } | { status: "missing" | "ambiguous" | "invalid"; product: null } {
  const normalized = normalizeScannedEan(ean);
  if (!normalized) return { status: "invalid", product: null };
  const matches = products.filter((product) => product.ean === normalized);
  if (matches.length > 1) return { status: "ambiguous", product: null };
  return matches.length === 1
    ? { status: "found", product: matches[0] }
    : { status: "missing", product: null };
}

export function decodeEan13Bits(bits: string): string | null {
  if (bits.length !== 95 || !/^101/.test(bits) || bits.slice(45, 50) !== "01010" || bits.slice(92) !== "101") return null;
  let parity = "";
  let left = "";
  let right = "";
  for (let i = 0; i < 6; i++) {
    const leftBits = bits.slice(3 + i * 7, 10 + i * 7);
    const l = L.indexOf(leftBits);
    const g = G.indexOf(leftBits);
    if (l !== -1) {
      parity += "L";
      left += l;
    } else if (g !== -1) {
      parity += "G";
      left += g;
    } else return null;
    const r = R.indexOf(bits.slice(50 + i * 7, 57 + i * 7));
    if (r === -1) return null;
    right += r;
  }
  const first = PARITY.indexOf(parity);
  if (first < 0) return null;
  const value = String(first) + left + right;
  return isValidEan13(value) ? value : null;
}

/** One 8-bit grayscale scanline containing a horizontal EAN barcode. */
export function decodeEan13Line(grays: Uint8Array): string | null {
  if (grays.length < 190) return null;
  let min = 255;
  let max = 0;
  for (const value of grays) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (max - min < 60) return null;
  const threshold = (min + max) / 2;
  const dark = new Uint8Array(grays.length);
  for (let i = 0; i < grays.length; i++) dark[i] = grays[i] < threshold ? 1 : 0;

  for (let start = 1; start < dark.length - 190; start++) {
    if (dark[start] !== 1 || dark[start - 1] !== 0) continue;
    let end = start;
    while (end < dark.length && dark[end] === 1) end++;
    const r1 = end - start;
    const afterFirst = end;
    while (end < dark.length && dark[end] === 0) end++;
    const r2 = end - afterFirst;
    const afterSecond = end;
    while (end < dark.length && dark[end] === 1) end++;
    const r3 = end - afterSecond;
    const width = (r1 + r2 + r3) / 3;
    if (width < 2 || width > 16 || Math.max(r1,r2,r3) > width * 1.6 || Math.min(r1,r2,r3) < width * 0.55) continue;
    for (const scale of [0.94, 1, 1.06]) {
      const unit = width * scale;
      if (start + 95 * unit >= dark.length) continue;
      let bits = "";
      for (let n = 0; n < 95; n++) bits += dark[Math.floor(start + (n + 0.5) * unit)] ? "1" : "0";
      const ean = decodeEan13Bits(bits);
      if (ean) return ean;
    }
  }
  return null;
}

export function decodeEan13ImageData(image: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): string | null {
  const { width, height, data } = image;
  if (width < 190 || height < 5 || data.length < width * height * 4) return null;
  // Plusieurs lignes permettent de contourner reflets, textes et barres abîmées.
  for (const fraction of [0.50, 0.42, 0.58, 0.35, 0.65, 0.28, 0.72]) {
    const y = Math.floor(height * fraction);
    const grayscale = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let d = -1; d <= 1; d++) {
        const offset = (Math.min(height-1,Math.max(0,y+d)) * width + x) * 4;
        value += (data[offset] * 0.299 + data[offset+1] * 0.587 + data[offset+2] * 0.114);
      }
      grayscale[x] = value / 3;
    }
    const ean = decodeEan13Line(grayscale);
    if (ean) return ean;
  }
  return null;
}
