"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { isValidEan13 } from "@/lib/ean13";

const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function encodeEan13(ean: string): string {
  const parity = PARITY[Number(ean[0])];
  const left = [...ean.slice(1,7)].map((digit, i) => (parity[i] === "G" ? G : L)[Number(digit)]).join("");
  const right = [...ean.slice(7)].map((digit) => R[Number(digit)]).join("");
  return "101" + left + "01010" + right + "101";
}

export function Ean13Barcode({ ean }: { ean?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!ean || !isValidEan13(ean)) {
    return (
      <div className="rounded-xl border border-dashed border-[#d9e0e3] bg-[#fafaf8] p-5 text-center">
        <p className="text-sm font-bold text-[#152d40]">Code-barres non disponible</p>
        <p className="mt-2 text-xs leading-5 text-[#73808d]">
          Le fournisseur n’a pas communiqué d’EAN-13 valide. Aucun code n’est généré artificiellement.
        </p>
      </div>
    );
  }
  const bits = encodeEan13(ean);
  return (
    <div className="rounded-xl border border-[#e1e7e8] bg-white px-3 py-4">
      <div className="mx-auto max-w-[440px]">
        <svg viewBox="0 0 119 98" role="img" aria-label={"Code-barres EAN-13 " + ean} className="block h-auto w-full bg-white" shapeRendering="crispEdges">
          <rect x="0" y="0" width="119" height="98" fill="#fff"/>
          {bits.split("").map((bit, i) => bit === "1" ? (
            <rect key={i} x={12 + i} y="5" width="1" height={i < 3 || (i >= 45 && i < 50) || i >= 92 ? 77 : 70} fill="#000"/>
          ) : null)}
          <g fill="#000" fontFamily="Arial, sans-serif" fontSize="10" textAnchor="middle">
            <text x="6.5" y="87">{ean[0]}</text>
            {[...ean.slice(1,7)].map((digit,i)=><text key={"l"+i} x={18 + 7 * i} y="88">{digit}</text>)}
            {[...ean.slice(7)].map((digit,i)=><text key={"r"+i} x={66 + 7 * i} y="88">{digit}</text>)}
          </g>
        </svg>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#edf0f1] pt-3">
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#81909a]">EAN-13 · Identifiant GTIN</p>
          <p className="mt-1 font-mono text-sm font-bold tracking-wide text-[#152d40]">{ean}</p>
        </div>
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(ean);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e7e8] px-3 text-xs font-bold text-[#213c51]" aria-label="Copier le code EAN">
          {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#78858e]">Agrandir la fiche à l’écran si nécessaire pour une lecture par douchette. Le résultat dépend du lecteur, de l’écran et de sa luminosité.</p>
    </div>
  );
}
