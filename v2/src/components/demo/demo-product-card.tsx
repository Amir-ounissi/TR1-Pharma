import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { DemoQuantityForm } from "@/components/demo/demo-quantity-form";
import { demoMoney, type DemoTier } from "@/lib/demo-display";

export type DemoProductCardData = {
  id:string; name:string; sku:string;
  ean:string|null; format:string|null; category:string|null;
  description:string|null; image_url:string|null;
  demo_price_ht:number; min_qty:number; qty_step:number;
};

export function DemoProductCard({product,tiers}:{
  product:DemoProductCardData; tiers:DemoTier[];
}) {
  return <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#e1e5e6] bg-white shadow-[0_2px_12px_rgb(14_29_49/0.035)] transition hover:border-[#b9c9d0] hover:shadow-[0_10px_30px_rgb(14_29_49/0.09)]">
    <Link href={`/catalogue/demo/produit/${product.id}`} className="relative block border-b border-[#f0f1f2] bg-[#f7f8f7]">
      <div className="flex h-48 items-center justify-center px-8 py-5">
        {product.image_url
          ? <img src={product.image_url} alt={`Visuel produit ${product.name}`}
              loading="lazy" className="h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.035]"/>
          : <Package size={42} className="text-[#9faab1]" aria-hidden="true"/>}
      </div>
      <span className="absolute left-3 top-3 rounded-md border border-[#e9d1a9] bg-[#fff8ec] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9b511b]">TEST</span>
      <span className="absolute right-3 bottom-3 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-[#5b6b77]">Voir la fiche <ArrowUpRight size={12} className="inline"/></span>
    </Link>
    <div className="flex flex-1 flex-col px-4 pt-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#647786]">{product.category||"Compléments alimentaires"}</p>
      <Link href={`/catalogue/demo/produit/${product.id}`} className="mt-2 line-clamp-2 min-h-12 text-[17px] font-bold leading-6 text-[#152b40] hover:underline">
        {product.name}
      </Link>
      <p className="mt-1 text-xs text-[#677682]">{product.format||"Format non renseigné"}</p>
      <p className="mt-1 font-mono text-[11px] text-[#89949c]">EAN {product.ean||"non renseigné"}</p>
      <p className="mt-3 line-clamp-2 min-h-10 text-[12px] leading-5 text-[#697782]">
        {product.description||"Composition et bénéfices à confirmer auprès de la marque."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f1] pt-3">
        <div>
          <p className="text-[11px] font-medium text-[#73818c]">Prix d'achat HT · fictif</p>
          <p className="text-xl font-extrabold tabular-nums text-[#172e44]">{demoMoney(product.demo_price_ht)}</p>
        </div>
        <span className="rounded-lg border border-[#e0e6e8] bg-[#f6f8f8] px-2 py-1.5 text-[11px] font-semibold text-[#5a6a77]">
          Min. {product.min_qty} u.
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {tiers.map(t=><div key={t.min_qty} className="rounded-md bg-[#f3f5f6] px-2 py-2 text-center">
          <p className="text-[11px] text-[#697782]">{t.min_qty} u.</p>
          <p className="mt-0.5 text-[11px] font-bold tabular-nums text-[#142941]">{demoMoney(t.price_ht)}</p>
        </div>)}
      </div>
      <div className="mt-auto pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#75828d]">
          <span>Stock : non communiqué</span><span>PVC / marge : n.d.</span>
        </div>
        <div className="-mx-4 border-t border-[#edf0f1] bg-[#fbfcfc] px-4 py-4">
          <DemoQuantityForm productId={product.id} basePrice={product.demo_price_ht}
            tiers={tiers} minQty={product.min_qty} qtyStep={product.qty_step}/>
        </div>
      </div>
    </div>
  </article>;
}
