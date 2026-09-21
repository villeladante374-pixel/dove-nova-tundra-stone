import { create } from "zustand";
import { idbDeleteFile, idbGetFile, idbPutFile } from "@/lib/idb";

const KEY = "book-club-ui-prefs";
const LOGO_ID = "brand:logo";

export type UiPrefs = {
  logo: number;
  lead: number;
};

type State = UiPrefs & {
  ready: boolean;
  logoUrl: string | null;
  hydrate: () => void;
  setLogo: (n: number) => void;
  setLead: (n: number) => void;
  setLogoFile: (blob: Blob | null) => Promise<void>;
};

function clampLogo(n: number) {
  return Math.min(1.8, Math.max(0.7, n));
}
function clampLead(n: number) {
  return Math.min(1.9, Math.max(1.15, n));
}

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { logo: 1, lead: 1.45 };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      logo: clampLogo(Number(parsed.logo) || 1),
      lead: clampLead(Number(parsed.lead) || 1.45),
    };
  } catch {
    return { logo: 1, lead: 1.45 };
  }
}

function save(prefs: UiPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export const useUiPrefs = create<State>((set, get) => ({
  logo: 1,
  lead: 1.45,
  logoUrl: null,
  ready: false,
  hydrate: () => {
    if (get().ready) return;
    set({ ...load(), ready: true });
    void idbGetFile(LOGO_ID).then((file) => {
      if (!file) return;
      const url = URL.createObjectURL(file.blob);
      const prev = get().logoUrl;
      set({ logoUrl: url });
      if (prev) URL.revokeObjectURL(prev);
    });
  },
  setLogo: (n) => {
    const logo = clampLogo(n);
    save({ logo, lead: get().lead });
    set({ logo });
  },
  setLead: (n) => {
    const lead = clampLead(n);
    save({ logo: get().logo, lead });
    set({ lead });
  },
  setLogoFile: async (blob) => {
    const prev = get().logoUrl;
    if (prev) URL.revokeObjectURL(prev);
    if (!blob) {
      await idbDeleteFile(LOGO_ID);
      set({ logoUrl: null });
      return;
    }
    await idbPutFile(LOGO_ID, blob);
    set({ logoUrl: URL.createObjectURL(blob) });
  },
}));
