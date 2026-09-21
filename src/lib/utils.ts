import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFolio(current: number, total: number) {
  return `${current} / ${total}`;
}

export function pageThickness(pageCount: number) {
  return Math.min(32, Math.max(8, Math.round(4 + pageCount / 10)));
}

export function fileNameToTitle(name: string) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64: string, mime: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function isUnauthorized(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const rec = err as { status?: number; message?: string };
  return rec.status === 401 || rec.message === "Unauthorized";
}

export function isVideoFile(file: File) {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/")) return true;
  return /\.(mp4|m4v|m4p|webm|mov|qt|mkv|ogv|ogg|avi)$/i.test(file.name);
}
