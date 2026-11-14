"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Expand, ImageOff, X } from "lucide-react";
import { shopifyResponsivePhoto } from "@/lib/catalogue-photo-quality";

type ProductImageGalleryProps = {
  images: string[];
  brand: string;
  productName: string;
  format: string;
};

export function ProductImageGallery({ images, brand, productName, format }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [failedHdVariants, setFailedHdVariants] = useState<Set<string>>(() => new Set());
  const zoomRef = useRef<HTMLDialogElement>(null);
  const activeImage = images[Math.min(activeIndex, images.length - 1)];
  const displayable = Boolean(activeImage && !failedImages.has(activeImage));
  const displaySrc = (url: string, width: number) =>
    failedHdVariants.has(url) ? url : shopifyResponsivePhoto(url, width);
  const markFailed = (url: string, width: number) => {
    if (displaySrc(url, width) !== url) {
      setFailedHdVariants((old) => new Set(old).add(url));
    } else {
      setFailedImages((old) => new Set(old).add(url));
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center gap-3 rounded-2xl border border-[#e6eaec] bg-white text-sm font-semibold text-[#71808b]">
        <ImageOff size={22} aria-hidden="true" /> Photo indisponible
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-[#e6eaec] bg-white">
        {displayable ? (
          <Image
            src={displaySrc(activeImage, 1600)}
            alt={brand + " " + productName + " — " + format + ", photo " + (activeIndex + 1)}
            fill
            unoptimized
            priority
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 55vw, 650px"
            onError={() => markFailed(activeImage, 1600)}
            className="object-contain p-5 sm:p-8"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#7e8d99]">
            <ImageOff size={32} aria-hidden="true" />
            <span className="text-xs font-semibold">Visuel indisponible</span>
          </div>
        )}
        {displayable ? (
          <button
            type="button"
            onClick={() => zoomRef.current?.showModal()}
            className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e1e6e9] bg-white/95 px-3 text-xs font-bold text-[#142941] shadow-sm hover:bg-white sm:bottom-4 sm:right-4"
            aria-label={"Agrandir la photo de " + productName}>
            <Expand size={16} aria-hidden="true" /> Agrandir
          </button>
        ) : null}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={"Galerie de " + productName}>
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={"Afficher la photo " + (index + 1) + " sur " + images.length}
              aria-pressed={activeIndex === index}
              className={"relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-white transition focus-visible:outline-2 focus-visible:outline-[#b56d3e] " + (activeIndex === index
                ? "border-[#b56d3e] ring-2 ring-[#b56d3e]/20"
                : "border-[#e6eaec] hover:border-[#aab6bd]")}
            >
              {failedImages.has(url) ? <ImageOff size={19} className="mx-auto text-[#9aa6ac]" /> : (
                <Image
                  src={displaySrc(url, 320)}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  loading="lazy"
                  onError={() => markFailed(url, 320)}
                  className="object-contain p-1"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={zoomRef}
        aria-label={"Photo agrandie de " + brand + " " + productName}
        className="fixed inset-0 m-auto h-[92dvh] max-h-[92dvh] w-[96vw] max-w-[1200px] overflow-hidden rounded-2xl border border-[#e6eaec] bg-white p-3 shadow-2xl backdrop:bg-[#0e1d31]/80 sm:p-5"
      >
        <button type="button" onClick={() => zoomRef.current?.close()}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#e1e6e9] bg-white text-[#142941] hover:bg-[#f4f6f6]"
          aria-label="Fermer la photo agrandie"><X size={21} /></button>
        {displayable ? (
          <div className="relative h-full w-full">
            <Image
              src={displaySrc(activeImage, 1600)}
              alt={brand + " " + productName + " — détail agrandi"}
              fill
              unoptimized
              sizes="(max-width: 640px) 90vw, 1100px"
              onError={() => markFailed(activeImage, 1600)}
              className="object-contain p-3 sm:p-5"
            />
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
