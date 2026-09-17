"use client";

import { useRef, useState } from "react";
import { Camera, Images } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_PHOTOS = 3;
const COMPRESSED_MAX_BYTES = 900_000;
const ACCEPTED_PHOTOS = "image/jpeg,image/png,image/webp";

async function compressVisitPhoto(file: File) {
  if (file.size <= COMPRESSED_MAX_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
      image.src = url;
    });

    const largest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / largest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const base = file.name.replace(/\.[^.]+$/, "") || "photo-visite";
    for (const quality of [0.78, 0.65, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= COMPRESSED_MAX_BYTES) {
        return new File([blob], `${base}.jpg`, {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }

    throw new Error("image_too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VisitCloseoutPhotoPicker({ disabled = false }: { disabled?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const masterRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function syncMaster(nextFiles: File[]) {
    if (!masterRef.current) return;
    const transfer = new DataTransfer();
    nextFiles.forEach((file) => transfer.items.add(file));
    masterRef.current.files = transfer.files;
  }

  async function appendPhotos(incoming: FileList | null) {
    if (!incoming?.length) return;
    setError(null);
    try {
      const available = Math.max(0, MAX_PHOTOS - files.length);
      const prepared = await Promise.all(
        Array.from(incoming)
          .slice(0, available)
          .map(compressVisitPhoto),
      );
      const nextFiles = [...files, ...prepared].slice(0, MAX_PHOTOS);
      setFiles(nextFiles);
      syncMaster(nextFiles);
    } catch {
      setError("Une photo est trop lourde ou illisible. Reprenez-la avec l’appareil photo.");
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    const nextFiles = files.filter((_, itemIndex) => itemIndex !== index);
    setFiles(nextFiles);
    syncMaster(nextFiles);
  }

  return (
    <div className="space-y-2 rounded-xl border bg-white p-3">
      <input
        ref={masterRef}
        className="sr-only"
        type="file"
        name="photos"
        accept={ACCEPTED_PHOTOS}
        multiple
      />
      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_PHOTOS}
        capture="environment"
        onChange={(event) => void appendPhotos(event.target.files)}
      />
      <input
        ref={libraryRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_PHOTOS}
        multiple
        onChange={(event) => void appendPhotos(event.target.files)}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--tr1-navy)]">Photos · {files.length}/{MAX_PHOTOS}</p>
          <p className="text-xs text-muted-foreground">Facings, stock, PLV, implantation…</p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || files.length >= MAX_PHOTOS}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-4" />
            Photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || files.length >= MAX_PHOTOS}
            onClick={() => libraryRef.current?.click()}
          >
            <Images className="size-4" />
            Photothèque
          </Button>
        </div>
      </div>

      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}

      {files.length ? (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{file.name}</span>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => removePhoto(index)}>
                Retirer
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground disabled:opacity-50"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="size-5" />
          Ajouter une photo de la visite
        </button>
      )}
    </div>
  );
}
