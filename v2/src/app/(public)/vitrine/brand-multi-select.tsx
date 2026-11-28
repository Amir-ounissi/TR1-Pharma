"use client";

import {useState} from "react";
import {Check,Leaf,PackageCheck,Sparkles} from "lucide-react";

export type SelectableBrand={id:string;name:string;slug:string;description:string|null};

const brandMeta:Record<string,{category:string;kind:"beauty"|"nutrition"|"wellness"}>={
  "beauty-of-joseon":{category:"K-beauty · Soins visage",kind:"beauty"},
  biodance:{category:"K-beauty · Masques & soins",kind:"beauty"},
  "dr-althea":{category:"K-beauty · Dermocosmétique",kind:"beauty"},
  medicube:{category:"K-beauty · Skin care",kind:"beauty"},
  bloomster:{category:"Micronutrition · Champignons",kind:"nutrition"},
  vitalora:{category:"Micronutrition · Compléments",kind:"nutrition"},
  noto:{category:"Bien-être · Capillaire",kind:"wellness"},
  "vk-swiss":{category:"Compléments alimentaires",kind:"nutrition"},
};

function BrandGlyph({kind}:{kind:"beauty"|"nutrition"|"wellness"}){
  if(kind==="beauty")return <Sparkles size={17}/>;
  if(kind==="wellness")return <Leaf size={17}/>;
  return <PackageCheck size={17}/>;
}

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
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {brands.map((brand,index)=>{
        const meta=brandMeta[brand.slug]??{category:"Sélection officinale",kind:"wellness" as const};
        const active=selected.includes(brand.slug);
        return <label
          key={brand.id}
          className={`group relative flex min-h-[104px] cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border p-4 transition duration-200 focus-within:ring-2 focus-within:ring-[#d79b69] ${active?"border-[#244a60] bg-[#edf3f3] shadow-[0_6px_20px_rgba(20,41,65,0.08)]":"border-[#e1e7e8] bg-white hover:-translate-y-0.5 hover:border-[#b8c8ce] hover:shadow-[0_8px_22px_rgba(20,41,65,0.06)]"}`}
        >
          <input
            type="checkbox"
            name="brand_slugs"
            value={brand.slug}
            checked={active}
            required={index===0&&selected.length===0}
            onChange={()=>toggle(brand.slug)}
            className="peer sr-only"
          />
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${active?"bg-[#17354c] text-[#f2c69f]":"bg-[#f2f5f4] text-[#587383] group-hover:bg-[#e8efef]"}`}>
            <BrandGlyph kind={meta.kind}/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a66a43]">{meta.category}</span>
            <span className="mt-1.5 block text-[15px] font-extrabold tracking-tight text-[#142941]">{brand.name}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[#74838b]">{brand.description||"Présentation et étude de référencement"}</span>
          </span>
          <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${active?"border-[#17354c] bg-[#17354c] text-white":"border-[#cbd6da] bg-white text-transparent"}`}>
            <Check size={12} strokeWidth={3}/>
          </span>
          <span className="sr-only">{active?"Sélectionnée":"Non sélectionnée"}</span>
        </label>;
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
