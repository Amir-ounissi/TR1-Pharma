"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { shopifyResponsivePhoto } from "@/lib/catalogue-photo-quality";

/** Format homogène de packshot, sans recadrer l'emballage ni déformer la photo. */
export function CataloguePackshot({
  src,
  alt,
  variant = "card",
  priority = false,
}: {
  src: string | null;
  alt: string;
  variant?: "card" | "list";
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isList = variant === "list";
  const canShowPhoto = Boolean(src && src !== failedSrc);

  return (
    <div className={isList
      ? "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#eceeef] bg-white"
      : "relative flex h-[220px] w-full items-center justify-center overflow-hidden bg-white sm:h-[250px] xl:h-[270px]"}>
      {canShowPhoto && src ? (
        <Image
          src={shopifyResponsivePhoto(src, isList ? 320 : 960)}
          alt={alt}
          fill
          unoptimized
          priority={priority && !isList}
          loading={priority && !isList ? "eager" : "lazy"}
          sizes={isList ? "64px" : "(max-width: 640px) calc(100vw - 36px), (max-width: 1024px) 45vw, 480px"}
          onError={() => setFailedSrc(src)}
          className={isList
            ? "object-contain p-1"
            : "object-contain p-3 transition-transform duration-300 ease-out group-hover:scale-[1.04] sm:p-4"}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#8b99a5]">
          <ImageOff size={isList ? 20 : 34} strokeWidth={1.3} aria-hidden="true" />
          {!isList ? <span className="text-[11px] font-semibold">Photo indisponible</span> : null}
        </div>
      )}
    </div>
  );
}
