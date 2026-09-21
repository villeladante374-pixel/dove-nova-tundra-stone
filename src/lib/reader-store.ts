import { create } from "zustand";
import { READERS, type ReaderId } from "@/lib/readers";

type ReaderState = {
  readerId: ReaderId | null;
  ready: boolean;
  hydrate: () => void;
  select: (id: ReaderId) => void;
  clear: () => void;
};

export const useReader = create<ReaderState>((set) => ({
  readerId: null,
  ready: true,
  hydrate: () => set({ ready: true }),
  select: (id) => {
    if (!READERS.some((r) => r.id === id)) return;
    set({ readerId: id, ready: true });
  },
  clear: () => set({ readerId: null, ready: true }),
}));
