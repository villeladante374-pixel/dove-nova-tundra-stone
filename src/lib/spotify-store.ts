import { create } from "zustand";

const KEY = "el-tomo-spotify-ui";
const DEFAULT_PATH = "playlist/37i9dQZF1DX4sWSpwq3LiO";

type Pos = { x: number; y: number };

function load() {
  if (typeof window === "undefined") {
    return { pos: { x: 24, y: 72 }, path: DEFAULT_PATH, docked: false };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { pos: { x: 24, y: 72 }, path: DEFAULT_PATH, docked: false };
    const p = JSON.parse(raw) as { x?: number; y?: number; path?: string; docked?: boolean };
    return {
      pos: { x: typeof p.x === "number" ? p.x : 24, y: typeof p.y === "number" ? p.y : 72 },
      path: typeof p.path === "string" ? p.path : DEFAULT_PATH,
      docked: Boolean(p.docked),
    };
  } catch {
    return { pos: { x: 24, y: 72 }, path: DEFAULT_PATH, docked: false };
  }
}

function save(state: { open: boolean; pos: Pos; path: string; docked: boolean }) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ x: state.pos.x, y: state.pos.y, path: state.path, docked: state.docked }),
    );
  } catch {
    /* ignore */
  }
}

const boot = load();

type SpotifyState = {
  open: boolean;
  docked: boolean;
  pos: Pos;
  path: string;
  show: () => void;
  close: () => void;
  setDocked: (docked: boolean) => void;
  setPos: (pos: Pos) => void;
  setPath: (path: string) => void;
};

export const useSpotify = create<SpotifyState>((set, get) => ({
  open: false,
  docked: boot.docked,
  pos: boot.pos,
  path: boot.path,
  show: () => {
    set({ open: true });
    save({ ...get(), open: true });
  },
  close: () => {
    set({ open: false });
    save({ ...get(), open: false });
  },
  setDocked: (docked) => {
    set({ docked });
    save({ ...get(), docked });
  },
  setPos: (pos) => {
    set({ pos });
    save({ ...get(), pos });
  },
  setPath: (path) => {
    set({ path });
    save({ ...get(), path });
  },
}));

export function parseSpotify(input: string) {
  const raw = input.trim();
  if (!raw) return DEFAULT_PATH;
  const embed = raw.match(/open\.spotify\.com\/embed\/(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/i);
  if (embed) return `${embed[1].toLowerCase()}/${embed[2]}`;
  const open = raw.match(/open\.spotify\.com\/(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/i);
  if (open) return `${open[1].toLowerCase()}/${open[2]}`;
  const uri = raw.match(/spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]+)/i);
  if (uri) return `${uri[1].toLowerCase()}/${uri[2]}`;
  if (/^(playlist|album|track|artist|episode|show)\//i.test(raw)) return raw;
  if (/^[A-Za-z0-9]{10,}$/.test(raw)) return `playlist/${raw}`;
  return DEFAULT_PATH;
}
