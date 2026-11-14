"use client";

import { useState } from "react";
import Image from "next/image";

type ProductImageGalleryProps = {
  images: string[];
  brand: string;
  productName: string;
  format: string;
};

export function ProductImageGallery({ images, brand, productName, format }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-[#e6eaec] bg-[#f5f4f0] text-sm font-semibold text-[#71808b]">
        Visuel non disponible
      </div>
    );
  }

  const activeImage = images[Math.min(activeIndex, images.length - 1)];

  return (
    <div className="space-y-3">
      <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-[#e6eaec] bg-[#f5f4f0] p-7 sm:min-h-[470px]">
        <Image
          src={activeImage}
          alt={brand + " " + productName + ", " + format + " — visuel " + (activeIndex + 1)}
          width={1000}
          height={1000}
          unoptimized
          priority
          className="max-h-[430px] w-full object-contain drop-shadow-[0_12px_18px_rgba(15,30,38,.08)]"
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={"Afficher le visuel " + (index + 1) + " de " + productName}
              aria-pressed={activeIndex === index}
              className={"relative aspect-square overflow-hidden rounded-xl border bg-white p-2 transition " + (activeIndex === index ? "border-[#b56d3e] ring-2 ring-[#b56d3e]/20" : "border-[#e6eaec] hover:border-[#aab6bd]")}
            >
              <Image
                src={image}
                alt=""
                width={180}
                height={180}
                unoptimized
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
