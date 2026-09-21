import type { BookRecord } from "@/lib/types";
import { idbGetFile, idbPutFile } from "@/lib/idb";

const KINDS = ["pdf", "cover", "hover"] as const;
type Kind = (typeof KINDS)[number];

export type ClubMeta = {
  books: BookRecord[];
  goneIds: string[];
  marks: { scores: Record<string, Partial<Record<string, number>>>; spots: Record<string, { x: number; y: number }> };
  profiles: Record<string, { name: string; photo?: string; hideFace?: boolean }>;
  settings: { logo?: number; lead?: number };
  savedAt?: number;
};

async function sameOnServer(bookId: string, kind: Kind, size: number) {
  try {
    const res = await fetch(`/media/${bookId}/${kind}`, { method: "HEAD" });
    if (!res.ok) return false;
    return Number(res.headers.get("content-length") || 0) === size;
  } catch {
    return false;
  }
}

async function postMeta(meta: ClubMeta) {
  const res = await fetch("/api/club", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      books: meta.books.map(({ coverData: _c, ...rest }) => rest),
      goneIds: meta.goneIds,
      marks: meta.marks,
      profiles: meta.profiles,
      settings: meta.settings,
    }),
  });
  if (!res.ok) throw new Error("No se pudo guardar en la nube.");
}

async function pushFile(bookId: string, kind: Kind, blob: Blob) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`/media/${bookId}/${kind}`, {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
      signal: ctrl.signal,
    });
    return res.ok;
  } finally {
    window.clearTimeout(t);
  }
}

export async function pushClub(meta: ClubMeta) {
  await postMeta(meta);
  for (const book of meta.books) {
    for (const kind of KINDS) {
      try {
        const file = await idbGetFile(`${kind}:${book.id}`);
        if (!file?.blob || file.blob.size < 32) continue;
        if (await sameOnServer(book.id, kind, file.blob.size)) continue;
        await pushFile(book.id, kind, file.blob);
      } catch {
        /* un archivo no debe bloquear el resto */
      }
    }
  }
}

export async function pullClub() {
  const res = await fetch("/api/club");
  if (!res.ok) throw new Error("No hay copia en la nube.");
  const pack = (await res.json()) as ClubMeta;
  const books = Array.isArray(pack.books) ? pack.books : [];
  for (const book of books) {
    for (const kind of KINDS) {
      try {
        const existing = await idbGetFile(`${kind}:${book.id}`).catch(() => undefined);
        if (existing?.blob && existing.blob.size > 32) continue;
        const file = await fetch(`/media/${book.id}/${kind}`);
        if (!file.ok) continue;
        const blob = await file.blob();
        if (blob.size < 32) continue;
        await idbPutFile(`${kind}:${book.id}`, blob);
      } catch {
        /* sigue con el siguiente */
      }
    }
  }
  return pack;
}
