import { idbGetFile, idbPutBook, idbPutFile } from "@/lib/idb";
import type { BookRecord } from "@/lib/types";

type Pack = {
  book: BookRecord;
  cover: string;
  pdf?: string;
  hover?: string;
};

export const BUNDLED_PACKS: Pack[] = [
  {
    book: {
      id: "tomo-hail-mary",
      title: "Project Hail Mary",
      author: "Andy Weir",
      pageCount: 496,
      leather: "tan",
      kind: "pdf",
      createdAt: 4,
      hasCover: true,
      hasHoverVideo: true,
      fileSize: 10391506,
    },
    cover: "/tomes/hail-mary.jpg",
    pdf: "/tomes/hail-mary.pdf",
    hover: "/tomes/hail-mary-hover.mp4",
  },
];

export function bundledPdfUrl(id: string) {
  return BUNDLED_PACKS.find((p) => p.book.id === id)?.pdf ?? null;
}

export function bundledCoverUrl(id: string) {
  return BUNDLED_PACKS.find((p) => p.book.id === id)?.cover ?? null;
}

async function putIfMissing(id: string, url: string, mime: string) {
  const existing = await idbGetFile(id).catch(() => undefined);
  if (existing?.blob && existing.blob.size > 32) return;
  const res = await fetch(url);
  if (!res.ok) return;
  const blob = await res.blob();
  if (blob.size < 32) return;
  await idbPutFile(id, blob.type ? blob : new Blob([blob], { type: mime }));
}

/** Adds bundled tomos if they are missing and not in goneIds. */
export async function seedBundledShelf(gone: Set<string>, live: BookRecord[]) {
  const extra: BookRecord[] = [];
  const titles = new Set(live.map((b) => b.title.trim().toLowerCase()));
  const ids = new Set(live.map((b) => b.id));
  for (const pack of BUNDLED_PACKS) {
    if (gone.has(pack.book.id)) continue;
    const known = ids.has(pack.book.id) || titles.has(pack.book.title.trim().toLowerCase());
    if (!known) {
      extra.push(pack.book);
      await idbPutBook(pack.book).catch(() => undefined);
    }
    try {
      await putIfMissing(`cover:${pack.book.id}`, pack.cover, "image/jpeg");
      if (pack.pdf) await putIfMissing(`pdf:${pack.book.id}`, pack.pdf, "application/pdf");
      if (pack.hover) await putIfMissing(`hover:${pack.book.id}`, pack.hover, "video/mp4");
    } catch {
      /* offline */
    }
  }
  return extra;
}
