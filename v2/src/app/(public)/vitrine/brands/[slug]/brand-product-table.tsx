"use client";

import {useMemo} from "react";

export type CatalogueProduct = {
  id:string;
  name:string;
  sku:string|null;
  ean:string|null;
  format:string|null;
  category:string|null;
  price_ht:number|string|null;
  image_url:string|null;
  units_per_carton:number|null;
};

function money(value:number|string|null){
  if(value===null||value==="")return "Sur demande";
  return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(value));
}

export function BrandProductTable({products}:{products:CatalogueProduct[]}){
  const groups=useMemo(()=>{
    const map=new Map<string,CatalogueProduct[]>();
    for(const product of products){
      const category=product.category?.trim()||"Autres références";
      const items=map.get(category)??[];
      items.push(product);
      map.set(category,items);
    }
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"fr"));
  },[products]);

  const showVisuals=products.some(product=>Boolean(product.image_url));

  return <div className="mt-6 space-y-3">
    {groups.map(([category,rows],index)=><details key={category} open={index===0} className="group overflow-hidden rounded-2xl border border-[#e2e5e1] bg-white shadow-[0_5px_18px_rgba(20,41,65,0.035)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#f8f7f3] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-extrabold text-[#203b4d]">{category}</span>
          <span className="mt-1 block text-[11px] text-[#879399]">{rows.length} références</span>
        </span>
        <span className="rounded-full bg-[#edf1ed] px-3 py-1.5 text-[11px] font-bold text-[#31576a]">{rows.length}</span>
      </summary>
      <div className="overflow-x-auto border-t border-[#edf0ec]">
        <table className="w-full min-w-[790px] border-collapse text-left">
          <thead className="bg-[#f8f8f5] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#78868b]">
            <tr>
              {showVisuals&&<th className="w-[92px] px-4 py-3">Visuel</th>}
              <th className="px-4 py-3">Produit / format</th>
              <th className="px-4 py-3">EAN / Réf. fournisseur</th>
              <th className="px-4 py-3 text-center">Unités / carton</th>
              <th className="px-5 py-3 text-right">Prix unitaire HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eff0ec]">
            {rows.map(product=><tr key={product.id} className="transition hover:bg-[#fbfaf7]">
              {showVisuals&&<td className="px-4 py-3">
                {product.image_url&&<div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl bg-[#f5f6f2] p-1.5">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain"
                    onError={event=>{const frame=event.currentTarget.parentElement;if(frame)frame.style.display="none";}}
                  />
                </div>}
              </td>}
              <td className="px-4 py-3.5">
                <span className="block text-xs font-bold text-[#203b4d]">{product.name}</span>
                <span className="mt-1 block text-[11px] text-[#849096]">{product.format||"Format non précisé"}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5"><span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#9aa5a7]">{product.ean?"EAN":"Réf. fournisseur"}</span><span className="mt-1 block font-mono text-[11px] text-[#687982]">{product.ean||product.sku||"—"}</span></td>
              <td className="px-4 py-3.5 text-center text-xs tabular-nums text-[#687982]">{product.units_per_carton??"—"}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right text-sm font-extrabold tabular-nums text-[#142941]">{money(product.price_ht)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </details>)}
  </div>;
}
