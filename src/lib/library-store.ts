import { create } from "zustand";
import { isDemoId } from "@/lib/demo-books";
import {
  idbDeleteBook,
  idbDeleteFile,
  idbGetAllBooks,
  idbGetAllFiles,
  idbGetFile,
  idbGetGoneIds,
  idbGetStash,
  idbPutBook,
  idbPutFile,
  idbPutGoneIds,
  idbPutStash,
  readCatalog,
  writeCatalog,
} from "@/lib/idb";
import { inspectPdf } from "@/lib/pdf-engine";
import { leatherForTitle, type BookRecord } from "@/lib/types";
import { fileNameToTitle } from "@/lib/utils";
import { useMarks } from "@/lib/marks-store";
import { useProfiles } from "@/lib/profiles-store";
import { useUiPrefs } from "@/lib/ui-prefs";
import { makeTomoPack, parseTomoPack, applyTomoFiles } from "@/lib/tomo-pack";
import { BUNDLED_PACKS, bundledCoverUrl, bundledPdfUrl, seedBundledShelf } from "@/lib/bundled-shelf";
import { recoveryCoverSrc } from "@/lib/recovery-covers";
import { pullClub, pushClub } from "@/lib/club-client";
import type { CloudBookMeta } from "@/lib/vault";

type LibraryState = {
  books: BookRecord[];
  coverUrls: Record<string, string>;
  hoverUrls: Record<string, string>;
  goneIds: string[];
  cloudList: CloudBookMeta[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addPdfBook: (input: {
    file: File;
    cover?: File | null;
    hover?: File | null;
    title: string;
    author: string;
  }) => Promise<BookRecord>;
  updateBook: (input: {
    id: string;
    title: string;
    author: string;
    cover?: File | null;
    clearCover?: boolean;
    hover?: File | null;
    clearHover?: boolean;
  }) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  emptyShelf: () => Promise<void>;
  getCoverSrc: (book: BookRecord) => string;
  getHoverSrc: (book: BookRecord) => string | null;
  getPdfBuffer: (id: string) => Promise<ArrayBuffer>;
  refreshCloud: () => Promise<void>;
  pushToCloud: (id: string) => Promise<void>;
  restoreFromCloud: (id: string) => Promise<void>;
  dropFromCloud: (id: string) => Promise<void>;
  backupAll: () => Promise<{ books: number; blob: Blob | null }>;
  restoreAll: () => Promise<{ books: number }>;
  restoreFromFile: (file: File) => Promise<{ books: number }>;
  exportBackup: () => Promise<Blob>;
  importBackup: (file: File) => Promise<{ books: number }>;
  stashCount: number;
  writeStash: () => Promise<void>;
};

const pdfBuffers = new Map<string, ArrayBuffer>();
let hydrating: Promise<void> | null = null;
let stashTimer: ReturnType<typeof setTimeout> | null = null;
let channel: BroadcastChannel | null = null;
let applyingRemote = false;
const PURGE_KEY = "book-club-purged";

function revokeAll(urls: Record<string, string>) {
  for (const url of Object.values(urls)) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

function asStoredBlob(file: Blob, fallbackMime: string) {
  if (file.type) return file;
  return new Blob([file], { type: fallbackMime });
}

function shelfOf(stored: BookRecord[]): BookRecord[] {
  return stored
    .filter((b) => b?.id && !isDemoId(b.id) && b.kind !== "manuscript")
    .sort((a, b) => b.createdAt - a.createdAt);
}

function scoreBook(book: BookRecord) {
  return (book.hasCover ? 8 : 0) + (book.hasHoverVideo ? 8 : 0) + (book.fileSize ? 2 : 0) + (book.pageCount > 1 ? 1 : 0);
}

function mergeById(lists: BookRecord[][], gone: Set<string>) {
  const map = new Map<string, BookRecord>();
  for (const list of lists) {
    for (const book of list) {
      if (!book?.id || gone.has(book.id) || isDemoId(book.id) || book.kind === "manuscript") continue;
      const prev = map.get(book.id);
      if (!prev || scoreBook(book) >= scoreBook(prev)) map.set(book.id, book);
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function unionGone(...lists: string[][]) {
  return [...new Set(lists.flat().filter(Boolean))];
}

export const useLibrary = create<LibraryState>((set, get) => ({
  books: [],
  coverUrls: {},
  hoverUrls: {},
  goneIds: [],
  cloudList: [],
  stashCount: 0,
  hydrated: false,

  hydrate: async () => {
    if (hydrating) return hydrating;
    hydrating = (async () => {
      try {
        void navigator.storage?.persist?.();
        bootChannel();
        bootPagehide();
        if (sessionStorage.getItem(PURGE_KEY) === "1") {
          const stash = await idbGetStash().catch(() => undefined);
          const gone = unionGone(await idbGetGoneIds().catch(() => []), stash?.goneIds ?? []);
          set({
            books: [],
            coverUrls: {},
            hoverUrls: {},
            goneIds: gone,
            stashCount: stash?.books?.length ?? 0,
            hydrated: true,
          });
          return;
        }
        const gone = unionGone(await idbGetGoneIds().catch(() => []), (await idbGetStash().catch(() => undefined))?.goneIds ?? []);
        const live = await gatherLive();
        let shelf = mergeById([live, readCatalog<BookRecord>()], new Set(gone));
        const coverUrls: Record<string, string> = { ...get().coverUrls };
        const hoverUrls: Record<string, string> = { ...get().hoverUrls };
        for (const book of shelf) {
          if (coverUrls[book.id]) continue;
          const packed = bundledCoverUrl(book.id);
          const recovered = recoveryCoverSrc(book.title);
          if (packed) coverUrls[book.id] = packed;
          else if (recovered) coverUrls[book.id] = recovered;
        }
        set({
          books: shelf,
          coverUrls,
          hoverUrls,
          goneIds: gone,
          stashCount: shelf.length,
          hydrated: true,
        });
        void finishHydrate(gone, shelf);
      } finally {
        hydrating = null;
      }
    })();
    return hydrating;
  },

  addPdfBook: async ({ file, cover, hover, title, author }) => {
    sessionStorage.removeItem(PURGE_KEY);
    const id = crypto.randomUUID();
    await idbPutFile(`pdf:${id}`, file);
    if (cover) await idbPutFile(`cover:${id}`, asStoredBlob(cover, "image/jpeg"));
    const hoverBlob = hover ? asStoredBlob(hover, "video/mp4") : null;
    if (hoverBlob) await idbPutFile(`hover:${id}`, hoverBlob);
    let pageCount = 1;
    let pdfTitle = "";
    try {
      const inspected = await inspectPdf(file);
      pageCount = inspected.pageCount || 1;
      pdfTitle = inspected.title || "";
    } catch {
      /* se guarda el PDF igual */
    }
    const book: BookRecord = {
      id,
      title: title.trim() || pdfTitle || fileNameToTitle(file.name) || "Tomo sin título",
      author: author.trim() || "Copista desconocido",
      pageCount,
      leather: leatherForTitle(title || file.name),
      kind: "pdf",
      createdAt: Date.now(),
      hasCover: Boolean(cover),
      hasHoverVideo: Boolean(hover),
      fileSize: file.size,
    };
    await idbPutBook(book);
    const coverUrl = cover ? URL.createObjectURL(cover) : undefined;
    const hoverUrl = hoverBlob ? URL.createObjectURL(hoverBlob) : undefined;
    set((state) => ({
      books: [book, ...state.books.filter((b) => b.id !== id)],
      coverUrls: coverUrl ? { ...state.coverUrls, [id]: coverUrl } : state.coverUrls,
      hoverUrls: hoverUrl ? { ...state.hoverUrls, [id]: hoverUrl } : state.hoverUrls,
    }));
    writeCatalog(get().books);
    await get().writeStash();
    broadcast();
    return book;
  },

  updateBook: async ({ id, title, author, cover, clearCover, hover, clearHover }) => {
    const current = get().books.find((b) => b.id === id);
    if (!current) return;
    const next: BookRecord = {
      ...current,
      title: title.trim() || current.title,
      author: author.trim() || current.author,
    };
    const coverUrls = { ...get().coverUrls };
    const hoverUrls = { ...get().hoverUrls };

    if (cover) {
      await idbPutFile(`cover:${id}`, cover);
      if (coverUrls[id]?.startsWith("blob:")) URL.revokeObjectURL(coverUrls[id]);
      coverUrls[id] = URL.createObjectURL(cover);
      next.hasCover = true;
    } else if (clearCover) {
      await idbDeleteFile(`cover:${id}`);
      if (coverUrls[id]?.startsWith("blob:")) URL.revokeObjectURL(coverUrls[id]);
      delete coverUrls[id];
      next.hasCover = false;
    }

    if (hover) {
      const hoverBlob = asStoredBlob(hover, "video/mp4");
      await idbPutFile(`hover:${id}`, hoverBlob);
      if (hoverUrls[id]?.startsWith("blob:")) URL.revokeObjectURL(hoverUrls[id]);
      hoverUrls[id] = URL.createObjectURL(hoverBlob);
      next.hasHoverVideo = true;
    } else if (clearHover) {
      await idbDeleteFile(`hover:${id}`);
      if (hoverUrls[id]?.startsWith("blob:")) URL.revokeObjectURL(hoverUrls[id]);
      delete hoverUrls[id];
      next.hasHoverVideo = false;
    }

    await idbPutBook(next);
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? next : b)),
      coverUrls,
      hoverUrls,
    }));
    await get().writeStash();
    broadcast();
  },

  removeBook: async (id) => {
    pdfBuffers.delete(id);
    const gone = unionGone(get().goneIds, [id]);
    await idbPutGoneIds(gone);
    await idbDeleteBook(id);
    const coverPrev = get().coverUrls[id];
    const hoverPrev = get().hoverUrls[id];
    if (coverPrev?.startsWith("blob:")) URL.revokeObjectURL(coverPrev);
    if (hoverPrev?.startsWith("blob:")) URL.revokeObjectURL(hoverPrev);
    set((state) => {
      const coverUrls = { ...state.coverUrls };
      const hoverUrls = { ...state.hoverUrls };
      delete coverUrls[id];
      delete hoverUrls[id];
      return {
        books: state.books.filter((b) => b.id !== id),
        coverUrls,
        hoverUrls,
        goneIds: gone,
      };
    });
    await get().writeStash();
    broadcast();
  },

  emptyShelf: async () => {
    sessionStorage.setItem(PURGE_KEY, "1");
    revokeAll(get().coverUrls);
    revokeAll(get().hoverUrls);
    set({ books: [], coverUrls: {}, hoverUrls: {} });
  },

  getCoverSrc: (book) => {
    const blobUrl = get().coverUrls[book.id];
    if (blobUrl) return blobUrl;
    if (book.coverData) return book.coverData;
    return bundledCoverUrl(book.id) ?? recoveryCoverSrc(book.title) ?? `/covers/leather-${book.leather}.jpg`;
  },

  getHoverSrc: (book) => get().hoverUrls[book.id] ?? BUNDLED_PACKS.find((p) => p.book.id === book.id)?.hover ?? null,

  getPdfBuffer: async (id) => {
    const file = await idbGetFile(`pdf:${id}`);
    if (file?.blob && file.blob.size > 32) {
      const buf = await file.blob.arrayBuffer();
      pdfBuffers.set(id, buf);
      return buf.slice(0);
    }
    const hit = pdfBuffers.get(id);
    if (hit) return hit.slice(0);
    const bundled = bundledPdfUrl(id);
    if (bundled) {
      const res = await fetch(bundled);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 32) {
          await idbPutFile(`pdf:${id}`, blob);
          const buf = await blob.arrayBuffer();
          pdfBuffers.set(id, buf);
          return buf.slice(0);
        }
      }
    }
    throw new Error("Falta el PDF. Pulsa Recuperar y elige tu archivo .tomo.zip");
  },

  refreshCloud: async () => {},
  pushToCloud: async () => {},
  restoreFromCloud: async () => {},
  dropFromCloud: async () => {},

  writeStash: async () => {
    if (sessionStorage.getItem(PURGE_KEY) === "1") return;
    const books = get().books;
    if (!books.length) return;
    const goneIds = get().goneIds;
    writeCatalog(books);
    const marks = useMarks.getState();
    if (!marks.ready) marks.hydrate();
    useProfiles.getState().hydrate();
    const files = await idbGetAllFiles();
    const payload = {
      books,
      files,
      goneIds,
      marks: marks.snapshot(),
      profiles: useProfiles.getState().byId,
      settings: { logo: useUiPrefs.getState().logo, lead: useUiPrefs.getState().lead },
      savedAt: Date.now(),
    };
    try {
      await idbPutStash(payload);
    } catch {
      const existing = await idbGetStash().catch(() => undefined);
      await idbPutStash({
        ...payload,
        files: existing?.files?.length ? existing.files : [],
      });
    }
    set({ stashCount: books.length });
  },

  backupAll: async () => {
    await get().writeStash();
    const n = get().books.length;
    if (!n) return { books: 0, blob: null as Blob | null };
    const marks = useMarks.getState();
    if (!marks.ready) marks.hydrate();
    useProfiles.getState().hydrate();
    await pushClub({
      books: get().books,
      goneIds: get().goneIds,
      marks: marks.snapshot(),
      profiles: useProfiles.getState().byId,
      settings: { logo: useUiPrefs.getState().logo, lead: useUiPrefs.getState().lead },
    });
    return { books: n, blob: null };
  },

  restoreAll: async () => {
    sessionStorage.removeItem(PURGE_KEY);
    let cloud: { books?: BookRecord[]; goneIds?: string[]; marks?: { scores: Record<string, Partial<Record<string, number>>>; spots: Record<string, { x: number; y: number }> }; profiles?: Record<string, { name: string; photo?: string; hideFace?: boolean }> } = {};
    try {
      cloud = await pullClub();
    } catch {
      cloud = {};
    }
    const stash = await idbGetStash().catch(() => undefined);
    await applyStashFiles(stash);
    if (cloud.marks) useMarks.getState().replaceAll(cloud.marks.scores, cloud.marks.spots);
    else if (stash?.marks) useMarks.getState().replaceAll(stash.marks.scores, stash.marks.spots);
    if (cloud.profiles) {
      useProfiles.getState().replaceAll(cloud.profiles as ReturnType<typeof useProfiles.getState>["byId"]);
    } else if (stash?.profiles) {
      useProfiles.getState().replaceAll(stash.profiles as ReturnType<typeof useProfiles.getState>["byId"]);
    }
    const live = await gatherLive();
    const gone = unionGone(await idbGetGoneIds().catch(() => []), get().goneIds, cloud.goneIds ?? [], stash?.goneIds ?? []);
    await idbPutGoneIds(gone);
    const shelf = mergeById([live, (stash?.books as BookRecord[] | undefined) ?? [], cloud.books ?? [], get().books], new Set(gone));
    for (const book of shelf) await idbPutBook(book);
    const { coverUrls, hoverUrls } = await bindMedia(shelf);
    writeCatalog(shelf);
    set({
      books: shelf,
      coverUrls,
      hoverUrls,
      goneIds: gone,
      stashCount: shelf.length,
      hydrated: true,
    });
    await get().writeStash();
    broadcast();
    return { books: shelf.length };
  },

  restoreFromFile: async (file: File) => {
    sessionStorage.removeItem(PURGE_KEY);
    const { meta, files } = await parseTomoPack(file);
    const gone = unionGone(get().goneIds, meta.goneIds ?? []);
    await idbPutGoneIds(gone);
    await applyTomoFiles(files);
    if (meta.marks) useMarks.getState().replaceAll(meta.marks.scores, meta.marks.spots);
    if (meta.profiles) {
      useProfiles.getState().replaceAll(meta.profiles as ReturnType<typeof useProfiles.getState>["byId"]);
    }
    if (meta.reading) {
      const { useReading } = await import("@/lib/reading-store");
      useReading.getState().replaceAll(meta.reading);
    }
    const shelf = mergeById([meta.books ?? []], new Set(gone));
    for (const book of shelf) await idbPutBook(book);
    const { coverUrls, hoverUrls } = await bindMedia(shelf);
    writeCatalog(shelf);
    set({
      books: shelf,
      coverUrls,
      hoverUrls,
      goneIds: gone,
      stashCount: shelf.length,
      hydrated: true,
    });
    await get().writeStash();
    broadcast();
    return { books: shelf.length };
  },

  exportBackup: async () => {
    await get().writeStash();
    return makeTomoPack(get().books, get().goneIds);
  },

  importBackup: async (file: File) => {
    const payload = JSON.parse(await file.text()) as { books?: BookRecord[]; goneIds?: string[] };
    const gone = unionGone(get().goneIds, payload.goneIds ?? []);
    await idbPutGoneIds(gone);
    const incoming = (payload.books ?? []).filter((b) => b?.id && !gone.includes(b.id));
    const shelf = mergeById([get().books, incoming], new Set(gone));
    for (const book of shelf) await idbPutBook(book);
    const { coverUrls, hoverUrls } = await bindMedia(shelf);
    set({ books: shelf, coverUrls, hoverUrls, goneIds: gone, hydrated: true });
    await get().writeStash();
    return { books: shelf.length };
  },
}));

async function finishHydrate(goneIn: string[], first: BookRecord[]) {
  const gone = [...goneIn];
  await idbPutGoneIds(gone).catch(() => undefined);
  await applyStashFiles(await idbGetStash().catch(() => undefined));
  let live = await gatherLive();
  const bundled = await seedBundledShelf(new Set(gone), live).catch(() => [] as BookRecord[]);
  let cloudBooks: BookRecord[] = [];
  try {
    const pack = await pullClub();
    const cloudGone = unionGone(gone, pack.goneIds ?? []);
    await idbPutGoneIds(cloudGone);
    gone.splice(0, gone.length, ...cloudGone);
    cloudBooks = pack.books ?? [];
  } catch {
    /* sin nube aún */
  }
  live = await gatherLive();
  let shelf = mergeById([live, first, cloudBooks, bundled, readCatalog<BookRecord>()], new Set(gone));
  for (const book of shelf) await idbPutBook(book).catch(() => undefined);
  const covers = await bindMedia(shelf, "cover");
  useLibrary.setState({
    books: shelf,
    coverUrls: covers.coverUrls,
    hoverUrls: covers.hoverUrls,
    goneIds: gone,
    stashCount: shelf.length,
  });
  const videos = await bindMedia(shelf, "hover");
  useLibrary.setState({
    coverUrls: videos.coverUrls,
    hoverUrls: videos.hoverUrls,
  });
  queueStash();
  if (shelf.length) {
    window.setTimeout(() => {
      void useLibrary.getState().backupAll().catch(() => undefined);
    }, 1800);
  }
}

async function gatherLive() {
  const live = shelfOf(await idbGetAllBooks<BookRecord>());
  if (live.length) return live;
  const files = await idbGetAllFiles();
  const ids = new Set<string>();
  for (const file of files) {
    const [, id] = file.id.split(":");
    if (id) ids.add(id);
  }
  return [...ids].map((id, i) => ({
    id,
    title: "Tomo recuperado",
    author: "Archivo interno",
    pageCount: 1,
    leather: leatherForTitle(id),
    kind: "pdf" as const,
    createdAt: Date.now() - i,
    hasCover: files.some((f) => f.id === `cover:${id}`),
    hasHoverVideo: files.some((f) => f.id === `hover:${id}`),
  }));
}

async function bindMedia(shelf: BookRecord[], kind: "all" | "cover" | "hover" = "all") {
  const coverUrls: Record<string, string> = { ...useLibrary.getState().coverUrls };
  const hoverUrls: Record<string, string> = { ...useLibrary.getState().hoverUrls };
  await Promise.all(
    shelf.map(async (book) => {
      if (kind !== "hover") {
        const coverFile = await idbGetFile(`cover:${book.id}`);
        if (coverFile?.blob && coverFile.blob.size > 32) {
          if (coverUrls[book.id]?.startsWith("blob:")) URL.revokeObjectURL(coverUrls[book.id]);
          coverUrls[book.id] = URL.createObjectURL(coverFile.blob);
          book.hasCover = true;
        } else if (!coverUrls[book.id]) {
          const packed = bundledCoverUrl(book.id);
          const recovered = recoveryCoverSrc(book.title);
          if (packed) coverUrls[book.id] = packed;
          else if (recovered) coverUrls[book.id] = recovered;
        }
      }
      if (kind !== "cover") {
        const hoverFile = await idbGetFile(`hover:${book.id}`);
        if (hoverFile?.blob && hoverFile.blob.size > 32) {
          const blob = asStoredBlob(hoverFile.blob, hoverFile.mime || "video/mp4");
          if (hoverUrls[book.id]?.startsWith("blob:")) URL.revokeObjectURL(hoverUrls[book.id]);
          hoverUrls[book.id] = URL.createObjectURL(blob);
          book.hasHoverVideo = true;
        }
      }
    }),
  );
  return { coverUrls, hoverUrls };
}

async function applyStashFiles(stash: Awaited<ReturnType<typeof idbGetStash>> | undefined) {
  if (!stash?.files?.length) return;
  for (const file of stash.files) {
    if (file?.id && file.blob) await idbPutFile(file.id, file.blob);
  }
}

function queueStash() {
  if (stashTimer) clearTimeout(stashTimer);
  stashTimer = setTimeout(() => {
    void useLibrary.getState().writeStash().catch(() => undefined);
  }, 1500);
}

function broadcast() {
  if (applyingRemote) return;
  try {
    channel?.postMessage({ at: Date.now() });
  } catch {
    /* ignore */
  }
}

function bootChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel("book-club-shelf");
  channel.addEventListener("message", () => {
    void (async () => {
      applyingRemote = true;
      try {
        const gone = await idbGetGoneIds();
        const shelf = mergeById([await gatherLive()], new Set(gone));
        const { coverUrls, hoverUrls } = await bindMedia(shelf);
        useLibrary.setState({ books: shelf, coverUrls, hoverUrls, goneIds: gone });
      } finally {
        applyingRemote = false;
      }
    })();
  });
}

function bootPagehide() {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => {
    void useLibrary.getState().writeStash().catch(() => undefined);
  });
}

export function disposeLibraryUrls() {
  revokeAll(useLibrary.getState().coverUrls);
  revokeAll(useLibrary.getState().hoverUrls);
}
