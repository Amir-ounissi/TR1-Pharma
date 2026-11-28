"use client";

import {useState} from "react";
import {ArrowUpRight,Check} from "lucide-react";
import Link from "next/link";
import {BrandLogo} from "./brand-visuals";

export type SelectableBrand={id:string;name:string;slug:string;description:string|null};

const brandMeta:Record<string,{category:string}>={
  "beauty-of-joseon":{category:"K-beauty · Soins visage"},
  biodance:{category:"K-beauty · Masques & soins"},
  "dr-althea":{category:"K-beauty · Dermocosmétique"},
  medicube:{category:"K-beauty · Skin care"},
  cosrx:{category:"K-beauty · Soins du visage"},
  bloomster:{category:"Micronutrition · Champignons"},
  vitalora:{category:"Micronutrition · Compléments"},
  noto:{category:"Bien-être · Douleur, stress & sommeil"},
  "vk-swiss":{category:"Compléments alimentaires"},
};

export function BrandMultiSelect({
  brands,
  initialSlugs=[],
}:{
  brands:SelectableBrand[];
  initialSlugs?:string[];
}){
  const [selected,setSelected]=useState<string[]>(initialSlugs.filter(slug=>brands.some(b=>b.slug===slug)));
  const toggle=(slug:string)=>{
    setSelected(current=>current.includes(slug)?current.filter(x=>x!==slug):[...current,slug]);
  };

  return <fieldset className="mt-5">
    <legend className="sr-only">Marques souhaitées</legend>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {brands.map(brand=>{
        const meta=brandMeta[brand.slug]??{category:"Sélection officinale"};
        const active=selected.includes(brand.slug);
        return <div key={brand.id} className="flex flex-col gap-2">
        <label
          className={`group relative flex min-h-[112px] cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border p-4 transition duration-200 focus-within:ring-2 focus-within:ring-[#d79b69] ${active?"border-[#244a60] bg-[#edf3f3] shadow-[0_6px_20px_rgba(20,41,65,0.08)]":"border-[#e1e7e8] bg-white hover:-translate-y-0.5 hover:border-[#b8c8ce] hover:shadow-[0_8px_22px_rgba(20,41,65,0.06)]"}`}
        >
          <input
            type="checkbox"
            name="brand_slugs"
            value={brand.slug}
            checked={active}
            onChange={()=>toggle(brand.slug)}
            className="peer sr-only"
          />
          <span className="flex h-12 w-28 shrink-0 items-center justify-center rounded-xl border border-[#e8ebe6] bg-[#fbfaf7] px-2">
            <BrandLogo slug={brand.slug} name={brand.name} compact/>
          </span>
          <span className="min-w-0 flex-1 pr-4">
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#a66a43]">{meta.category}</span>
            <span className="mt-1 block text-[14px] font-extrabold tracking-tight text-[#142941]">{brand.name}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[#74838b]">{brand.description||"Présentation et étude de référencement"}</span>
          </span>
          <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${active?"border-[#17354c] bg-[#17354c] text-white":"border-[#cbd6da] bg-white text-transparent"}`}>
            <Check size={12} strokeWidth={3}/>
          </span>
          <span className="sr-only">{active?"Sélectionnée":"Non sélectionnée"}</span>
        </label>
        <Link href={"/vitrine/brands/"+encodeURIComponent(brand.slug)+"#assortiment"} target="_blank" rel="noopener noreferrer" aria-label={"Consulter les produits de "+brand.name+" (nouvel onglet)"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd6da] bg-white px-3 text-xs font-bold text-[#31576a] hover:bg-[#edf3f3]">Consulter les produits <ArrowUpRight size={14}/></Link>
        </div>;
      })}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" className="text-xs font-semibold text-[#536b79]">
        {selected.length===0?"Aucune marque sélectionnée":selected.length===1?"1 marque sélectionnée":`${selected.length} marques sélectionnées`}
      </p>
      <p className="text-[11px] text-[#87949b]">Vous pouvez sélectionner plusieurs marques.</p>
    </div>
  </fieldset>;
}
