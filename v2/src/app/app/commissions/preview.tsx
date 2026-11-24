"use client";

import { useState } from "react";
const euro=(n:number)=>n.toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
export function CommissionPreview({rate,confirmed}:{rate:number,confirmed:boolean}) {
  const [amount,setAmount]=useState("1000");
  const num=Number(amount);
  const valid=amount.trim()!=="" && Number.isFinite(num)&&num>=0;
  return <div className="rounded-lg border border-[#e3e9ec] bg-[#f9fbfc] p-4">
    <h3 className="text-sm font-bold">Simulation de commission</h3>
    <p className="mt-1 text-xs leading-5 text-[#768591]">
      Calcul purement indicatif sur une assiette HT saisie manuellement. Ce montant ne constitue pas une créance ni un paiement dû.
    </p>
    <label className="mt-3 block text-xs font-semibold text-[#536a7b]">Assiette hypothétique (euros)
      <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"/>
    </label>
    <div className="mt-3 flex justify-between gap-3 border-t pt-3 text-sm">
      <span>Simulation à {rate.toLocaleString("fr-FR")} %</span>
      <strong>{valid?euro(Math.round(num*rate)/100):"—"}</strong>
    </div>
    <p className="mt-2 text-[11px] font-semibold text-[#9d5a23]">{confirmed?"Taux contractuel confirmé, simulation indicative.":"Taux EasyVRP non confirmé contractuellement."}</p>
  </div>;
}
