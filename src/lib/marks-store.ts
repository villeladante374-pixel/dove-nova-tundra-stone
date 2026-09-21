import { create } from "zustand";
import { READERS, type ReaderId } from "@/lib/readers";

const KEY = "book-club-marks-v1";

export type Spot = { x: number; y: number };
export type ScoreMap = Partial<Record<ReaderId, number>>;

type PersistShape = {
  scores: Record<string, ScoreMap>;
  spots: Record<string, Spot>;
};

type MarksState = PersistShape & {
  ready: boolean;
  hydrate: () => void;
  setScore: (bookId: string, readerId: ReaderId, value: number | null) => void;
  setSpot: (bookId: string, spot: Spot) => void;
  setSpots: (spots: Record<string, Spot>) => void;
  forgetBook: (bookId: string) => void;
  replaceAll: (scores: Record<string, ScoreMap>, spots: Record<string, Spot>) => void;
  resetScores: () => void;
  snapshot: () => PersistShape;
};

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { scores: {}, spots: {} };
    const parsed = JSON.parse(raw) as PersistShape & { pack?: number };
    return {
      scores: parsed.scores ?? {},
      spots: parsed.pack === 2 ? (parsed.spots ?? {}) : {},
    };
  } catch {
    return { scores: {}, spots: {} };
  }
}

function save(state: PersistShape) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ scores: state.scores, spots: state.spots, pack: 2 }),
    );
  } catch {
    /* quota */
  }
}

export function clampScore(value: number) {
  const stepped = Math.round(value * 10) / 10;
  return Math.min(10, Math.max(0, stepped));
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function tally(scores: ScoreMap | undefined) {
  const votes = READERS.map((r) => scores?.[r.id]).filter((n): n is number => typeof n === "number");
  if (!votes.length) {
    return { avg: null as number | null, percent: null as number | null, votes: 0 };
  }
  const avg = votes.reduce((a, b) => a + b, 0) / votes.length;
  return { avg, percent: avg * 10, votes: votes.length };
}

export function gradeLabel(avg: number | null) {
  if (avg == null) return "Sin nota";
  if (avg >= 9) return "Obra maestra";
  if (avg >= 8) return "Excelente";
  if (avg >= 7) return "Notable";
  if (avg >= 6) return "Bien";
  if (avg >= 5) return "Aprobado";
  return "En duda";
}

export function defaultSpot(index: number, cols = 4): Spot {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const stride = cols <= 2 ? 49.5 : 20.55;
  const origin = cols <= 2 ? 0.8 : 0.55;
  return { x: origin + col * stride, y: 1.2 + row * 58 };
}

export const useMarks = create<MarksState>((set, get) => ({
  scores: {},
  spots: {},
  ready: false,

  hydrate: () => {
    if (get().ready) return;
    const stored = load();
    set({ ...stored, ready: true });
  },

  setScore: (bookId, readerId, value) => {
    set((state) => {
      const current = { ...(state.scores[bookId] ?? {}) };
      if (value == null) delete current[readerId];
      else current[readerId] = clampScore(value);
      const scores = { ...state.scores, [bookId]: current };
      save({ scores, spots: state.spots });
      return { scores };
    });
  },

  setSpot: (bookId, spot) => {
    set((state) => {
      const spots = {
        ...state.spots,
        [bookId]: {
          x: Math.min(79, Math.max(0, spot.x)),
          y: Math.min(220, Math.max(0, spot.y)),
        },
      };
      save({ scores: state.scores, spots });
      return { spots };
    });
  },

  setSpots: (spots) => {
    set((state) => {
      save({ scores: state.scores, spots });
      return { spots };
    });
  },

  forgetBook: (bookId) => {
    set((state) => {
      const scores = { ...state.scores };
      const spots = { ...state.spots };
      delete scores[bookId];
      delete spots[bookId];
      save({ scores, spots });
      return { scores, spots };
    });
  },

  replaceAll: (scores, spots) => {
    save({ scores, spots });
    set({ scores, spots, ready: true });
  },

  resetScores: () => {
    const spots = get().spots;
    save({ scores: {}, spots });
    set({ scores: {} });
  },

  snapshot: () => {
    const state = get();
    return { scores: state.scores, spots: state.spots };
  },
}));
