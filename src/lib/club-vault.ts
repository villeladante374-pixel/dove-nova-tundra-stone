import type { BookRecord } from "@/lib/types";

const ROOT = process.env.VERCEL ? "/tmp/club" : "/workspace/.data/club";
const FILES = `${ROOT}/files`;
const LIB = `${ROOT}/library.json`;

export type ClubFileKind = "pdf" | "cover" | "hover";

export type ClubSettings = {
  logo?: number;
  lead?: number;
};

export type ClubPack = {
  books: BookRecord[];
  goneIds: string[];
  marks: { scores: Record<string, Partial<Record<string, number>>>; spots: Record<string, { x: number; y: number }> };
  profiles: Record<string, { name: string }>;
  settings: ClubSettings;
  savedAt: number;
};

function emptyPack(): ClubPack {
  return {
    books: [],
    goneIds: [],
    marks: { scores: {}, spots: {} },
    profiles: {},
    settings: {},
    savedAt: 0,
  };
}

export function clubFileAbs(bookId: string, kind: ClubFileKind) {
  return `${FILES}/${bookId}/${kind}`;
}
export function clubMimeAbs(bookId: string, kind: ClubFileKind) {
  return `${FILES}/${bookId}/${kind}.mime`;
}

async function io() {
  const fs = await import("node:fs");
  return { fs };
}

export async function diskReadPack(): Promise<ClubPack> {
  const { fs } = await io();
  fs.mkdirSync(FILES, { recursive: true });
  if (!fs.existsSync(LIB)) return emptyPack();
  try {
    const parsed = JSON.parse(fs.readFileSync(LIB, "utf8")) as Partial<ClubPack>;
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      goneIds: Array.isArray(parsed.goneIds) ? parsed.goneIds : [],
      marks: parsed.marks ?? { scores: {}, spots: {} },
      profiles: parsed.profiles ?? {},
      settings: parsed.settings ?? {},
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return emptyPack();
  }
}

async function writePack(pack: ClubPack) {
  const { fs } = await io();
  fs.mkdirSync(FILES, { recursive: true });
  const next = { ...pack, savedAt: Date.now() };
  fs.writeFileSync(LIB, JSON.stringify(next));
  return next;
}

function completeness(book: BookRecord) {
  return (book.hasCover ? 4 : 0) + (book.hasHoverVideo ? 4 : 0) + (book.fileSize ? 2 : 0) + (book.pageCount > 1 ? 1 : 0);
}

function stripCloud(book: BookRecord): BookRecord {
  const { coverData: _drop, ...rest } = book;
  return {
    ...rest,
    coverMedia: book.hasCover ? `/media/${book.id}/cover` : undefined,
    hoverMedia: book.hasHoverVideo ? `/media/${book.id}/hover` : undefined,
  };
}

function mergeBooks(a: BookRecord[], b: BookRecord[], gone: Set<string>) {
  const map = new Map<string, BookRecord>();
  for (const book of [...a, ...b]) {
    if (!book?.id || gone.has(book.id)) continue;
    const prev = map.get(book.id);
    if (!prev) {
      map.set(book.id, stripCloud(book));
      continue;
    }
    map.set(book.id, completeness(book) >= completeness(prev) ? stripCloud(book) : prev);
  }
  return [...map.values()].sort((x, y) => y.createdAt - x.createdAt);
}

function unionIds(a: string[], b: string[]) {
  return [...new Set([...a, ...b])];
}

export async function diskMergePack(data: Omit<ClubPack, "savedAt">) {
  const current = await diskReadPack();
  const goneIds = unionIds(current.goneIds, data.goneIds ?? []);
  const gone = new Set(goneIds);
  const books = mergeBooks(current.books, data.books ?? [], gone);
  return writePack({
    books,
    goneIds,
    marks: data.marks ?? current.marks,
    profiles: data.profiles ?? current.profiles,
    settings: { ...current.settings, ...data.settings },
    savedAt: Date.now(),
  });
}

export async function diskDeleteBookFiles(bookId: string) {
  const { fs } = await io();
  for (const kind of ["pdf", "cover", "hover"] as ClubFileKind[]) {
    const file = clubFileAbs(bookId, kind);
    const mime = clubMimeAbs(bookId, kind);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(mime)) fs.unlinkSync(mime);
  }
}

export async function diskPublicPack() {
  const pack = await diskReadPack();
  const gone = new Set(pack.goneIds);
  return { ...pack, books: pack.books.filter((b) => !gone.has(b.id)) };
}
