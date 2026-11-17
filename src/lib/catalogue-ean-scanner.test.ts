import { describe, expect, it } from "vitest";
import {
  decodeEan13Bits,
  decodeEan13ImageData,
  decodeEan13Line,
  findExactEanProduct,
  normalizeScannedEan,
} from "./catalogue-ean-scanner";

const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = ["1110010","1100110","1101100","1000010","1011100","1010000","1000100","1001000","1110100"];
const parity = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function barcodeBits(ean: string) {
  const side = [...ean.slice(1, 7)].map((digit, i) =>
    (parity[Number(ean[0])][i] === "G" ? G : L)[Number(digit)],
  ).join("");
  const right = [...ean.slice(7)].map((digit) => R[Number(digit)]).join("");
  return "101" + side + "01010" + right + "101";
}

function barcodePixels(ean: string, unit = 3) {
  return new Uint8Array([
    ...Array<number>(20).fill(255),
    ...barcodeBits(ean).split("").flatMap((bit) => Array<number>(unit).fill(bit === "1" ? 0 : 255)),
    ...Array<number>(20).fill(255),
  ]);
}

describe("mobile EAN-13 scanner", () => {
  it("accepts a valid check digit and removes visual separators", () => {
    expect(normalizeScannedEan("400-6381 333931")).toBe("4006381333931");
    expect(normalizeScannedEan("4006381333932")).toBeNull();
    expect(normalizeScannedEan("1234567")).toBeNull();
  });

  it("decodes the exact 95 modules of a printed EAN-13", () => {
    expect(decodeEan13Bits(barcodeBits("4006381333931"))).toBe("4006381333931");
    expect(decodeEan13Bits(barcodeBits("4006381333932"))).toBeNull();
    expect(decodeEan13Bits("0".repeat(95))).toBeNull();
  });

  it("decodes a synthetic scanner line with quiet zones", () => {
    expect(decodeEan13Line(barcodePixels("4006381333931"))).toBe("4006381333931");
    expect(decodeEan13Line(barcodePixels("4006381333931", 4))).toBe("4006381333931");
  });

  it("decodes pixel data in the middle of a camera frame", () => {
    const pixels = barcodePixels("4006381333931");
    const width = pixels.length;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = pixels[x];
      const p = (y * width + x) * 4;
      data[p] = v;
      data[p+1] = v;
      data[p+2] = v;
      data[p+3] = 255;
    }
    expect(decodeEan13ImageData({ width, height, data })).toBe("4006381333931");
  });

  it("never guesses a product from an unknown or duplicate EAN", () => {
    const products = [
      { ean: "4006381333931", name: "Known item" },
      { ean: "1234567890128", name: "Another item" },
    ];
    expect(findExactEanProduct("4006381333931", products)).toMatchObject({ status: "found" });
    expect(findExactEanProduct("4006381333931", [...products, products[0]])).toMatchObject({ status: "ambiguous" });
    expect(findExactEanProduct("5012345678900", products)).toMatchObject({ status: "missing" });
    expect(findExactEanProduct("000", products)).toMatchObject({ status: "invalid" });
  });
});
