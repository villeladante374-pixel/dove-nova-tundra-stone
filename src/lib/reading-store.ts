import { create } from "zustand";

const KEY = "book-club-reading-v1";

export type Highlight = {
  id: string;
  bookId: string;
  page: number;
  text: string;
  note?: string;
  mark?: { x: number; y: number; w: number; h: number; leaf: 0 | 1 };
  createdAt: number;
};

export type ReadingSnap = {
  favorites: string[];
  bookmarks: Record<string, number>;
  progress: Record<string, number>;
  highlights: Highlight[];
};

type ReadingState = ReadingSnap & {
  ready: boolean;
  hydrate: () => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  setBookmark: (bookId: string, pageIndex: number) => void;
  clearBookmark: (bookId: string) => void;
  setProgress: (bookId: string, pageIndex: number) => void;
  addHighlight: (hit: Omit<Highlight, "id" | "createdAt">) => Highlight;
  updateHighlight: (id: string, patch: Partial<Pick<Highlight, "note" | "text">>) => void;
  removeHighlight: (id: string) => void;
  snapshot: () => ReadingSnap;
  replaceAll: (snap: Partial<ReadingSnap>) => void;
};

function empty(): ReadingSnap {
  return { favorites: [], bookmarks: {}, progress: {}, highlights: [] };
}

function load(): ReadingSnap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ReadingSnap>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      bookmarks: parsed.bookmarks && typeof parsed.bookmarks === "object" ? parsed.bookmarks : {},
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : { ...(parsed.bookmarks ?? {}) },
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    };
  } catch {
    return empty();
  }
}

function persist(snap: ReadingSnap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

function pack(get: () => ReadingState): ReadingSnap {
  return {
    favorites: get().favorites,
    bookmarks: get().bookmarks,
    progress: get().progress,
    highlights: get().highlights,
  };
}

export const useReading = create<ReadingState>((set, get) => ({
  ...empty(),
  ready: false,
  hydrate: () => {
    if (get().ready) return;
    set({ ...load(), ready: true });
  },
  toggleFavorite: (id) => {
    const has = get().favorites.includes(id);
    const favorites = has ? get().favorites.filter((x) => x !== id) : [id, ...get().favorites];
    const next = { ...pack(get), favorites };
    persist(next);
    set({ favorites });
  },
  isFavorite: (id) => get().favorites.includes(id),
  setBookmark: (bookId, pageIndex) => {
    const bookmarks = { ...get().bookmarks, [bookId]: pageIndex };
    const next = { ...pack(get), bookmarks };
    persist(next);
    set({ bookmarks });
  },
  clearBookmark: (bookId) => {
    const bookmarks = { ...get().bookmarks };
    delete bookmarks[bookId];
    const next = { ...pack(get), bookmarks };
    persist(next);
    set({ bookmarks });
  },
  setProgress: (bookId, pageIndex) => {
    if (get().progress[bookId] === pageIndex) return;
    const progress = { ...get().progress, [bookId]: pageIndex };
    persist({ ...pack(get), progress });
    set({ progress });
  },
  addHighlight: (hit) => {
    const item: Highlight = { ...hit, id: crypto.randomUUID(), createdAt: Date.now() };
    const highlights = [item, ...get().highlights];
    persist({ ...pack(get), highlights });
    set({ highlights });
    return item;
  },
  updateHighlight: (id, patch) => {
    const highlights = get().highlights.map((h) => (h.id === id ? { ...h, ...patch } : h));
    persist({ ...pack(get), highlights });
    set({ highlights });
  },
  removeHighlight: (id) => {
    const highlights = get().highlights.filter((h) => h.id !== id);
    persist({ ...pack(get), highlights });
    set({ highlights });
  },
  snapshot: () => pack(get),
  replaceAll: (snap) => {
    const next: ReadingSnap = {
      favorites: snap.favorites ?? get().favorites,
      bookmarks: snap.bookmarks ?? get().bookmarks,
      progress: snap.progress ?? get().progress,
      highlights: snap.highlights ?? get().highlights,
    };
    persist(next);
    set({ ...next, ready: true });
  },
}));
