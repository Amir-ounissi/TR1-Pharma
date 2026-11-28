"use client";

import {useState} from "react";

const logoSpritePositions:Record<string,string>={
  biodance:"50% 0%",
  medicube:"0% 50%",
  cosrx:"50% 50%",
  noto:"100% 50%",
  bloomster:"0% 100%",
  vitalora:"50% 100%",
  "vk-swiss":"100% 100%",
};

const remoteLogos:Record<string,string>={
  "beauty-of-joseon":"https://di52x3c4ntpb8.cloudfront.net/production/brands/1000062898_1754783832892.png",
  "dr-althea":"https://doctoraltheaglobal.com/cdn/shop/files/dr.alteha_75ebcb8c-e3d4-4c24-a0a4-ef60987d5a49.png?v=1738920590&width=600",
  "vk-swiss":"https://static.wixstatic.com/media/89c805_f732ebba700045888a4925b7d04d91f8~mv2.png",
};

const heroImages:Record<string,string>={
  "beauty-of-joseon":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/Untitled_design_-_2025-04-29T145024.067.png?v=1745905839",
  biodance:"https://cdn.shopify.com/s/files/1/0894/2554/3511/files/Biodance_real_deep.png?v=1769774509",
  "dr-althea":"https://doctoraltheaglobal.com/cdn/shop/files/260227___345___1200_-02_01001f4e-f46e-4aa0-918d-28228f558fdf.jpg?v=1782870711",
  medicube:"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/Group_48096714.jpg?v=1742186065",
  cosrx:"https://www.cosrx.com/cdn/shop/files/Snail_96_Promo-Image-1_1024x1024.png?v=1763519441",
  noto:"https://www.notocbd.com/assets/hero-oils-4IsR29eq.webp",
  bloomster:"https://www.bloomster.fr/wp-content/uploads/2024/05/Untitled-design-2.png",
  vitalora:"https://www.vitalora.fr/assets/products-hero-BuNiBZG4.png",
  "vk-swiss":"https://static.wixstatic.com/media/89c805_9ba09e205e5148a0b36ab81c2423ec4c~mv2.jpg/v1/fill/w_980%2Ch_490%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/89c805_9ba09e205e5148a0b36ab81c2423ec4c~mv2.jpg",
};

function catalogueHref(slug:string){
  if(slug==="cosrx")return "/vitrine/cosrx";
  if(slug==="bloomster")return "/vitrine/bloomster";
  return "/vitrine/brands/"+slug;
}

export function BrandLogo({slug,name,compact=false}:{slug:string;name:string;compact?:boolean}){
  const [failed,setFailed]=useState(false);
  const remote=remoteLogos[slug];
  const box=compact?"h-9 w-24":"h-11 w-36";
  const href=catalogueHref(slug);
  if(remote&&!failed){
    const logo=<span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white px-2`}>
      <img src={remote} alt={`Logo ${name}`} loading="lazy" decoding="async" onError={()=>setFailed(true)} className="max-h-full max-w-full object-contain"/>
    </span>;
    return compact?logo:<a href={href} title={`Consulter le catalogue ${name}`} aria-label={`Consulter le catalogue ${name}`} className="inline-flex shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#31576a]">{logo}</a>;
  }
  const position=logoSpritePositions[slug];
  if(position){
    const mark=<span
      role="img"
      aria-label={`Logo ${name}`}
      className={`block ${slug==="cosrx"&&!compact?"h-11 w-24":box} shrink-0 bg-no-repeat`}
      style={{
        backgroundImage:"url('/brand-assets/brand-logos-sprite.png')",
        backgroundSize:"300% 300%",
        backgroundPosition:position,
      }}
    />;
    return compact?mark:<a href={href} title={`Consulter le catalogue ${name}`} aria-label={`Consulter le catalogue ${name}`} className="inline-flex shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#31576a]">{mark}</a>;
  }
  const wordmark=<span className={`flex ${box} shrink-0 items-center justify-center rounded-lg bg-white px-2 font-serif text-sm font-semibold tracking-wide text-[#234d3a]`}>{name}</span>;
  return compact?wordmark:<a href={href} title={`Consulter le catalogue ${name}`} aria-label={`Consulter le catalogue ${name}`} className="inline-flex shrink-0 rounded-lg">{wordmark}</a>;
}

export function BrandHero({slug,name}:{slug:string;name:string}){
  const [failed,setFailed]=useState(false);
  const src=heroImages[slug];
  if(!src||failed)return <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#e5ece7] via-[#f3eee7] to-[#e9e1d6]"/>;
  return <img
    src={src}
    alt={`Visuel de la marque ${name}`}
    loading="lazy"
    decoding="async"
    onError={()=>setFailed(true)}
    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
  />;
}
