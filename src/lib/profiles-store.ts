import { create } from "zustand";
import { READERS, type ReaderId } from "@/lib/readers";
import { prepCanvas, toHiResJpeg } from "@/lib/hires-image";

const KEY = "book-club-profiles-v1";

export type Profile = {
  name: string;
  photo?: string;
  hideFace?: boolean;
};

type ProfilesState = {
  byId: Record<ReaderId, Profile>;
  ready: boolean;
  hydrate: () => void;
  setName: (id: ReaderId, name: string) => void;
  setPhoto: (id: ReaderId, photo: string | undefined) => void;
  replaceAll: (byId: Record<ReaderId, Profile>) => void;
};

function defaults(): Record<ReaderId, Profile> {
  return {
    elsa: { name: "Elsa" },
    alexis: { name: "Alexis" },
    dante: { name: "Dante" },
    fernando: { name: "Fernando" },
    daniela: { name: "Daniela" },
  };
}

function load(): Record<ReaderId, Profile> {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ReaderId, Profile>>;
    for (const r of READERS) {
      const hit = parsed[r.id];
      if (!hit) continue;
      base[r.id] = {
        name: hit.name?.trim() || base[r.id].name,
        photo: typeof hit.photo === "string" && hit.photo.startsWith("data:") ? hit.photo : undefined,
        hideFace: Boolean(hit.hideFace),
      };
    }
  } catch {
    /* ignore */
  }
  return base;
}

function persist(byId: Record<ReaderId, Profile>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(byId));
  } catch {
    /* quota */
  }
}

export function portraitOf(id: ReaderId, profile?: { photo?: string; hideFace?: boolean } | null) {
  if (profile?.hideFace) return undefined;
  if (profile?.photo) return profile.photo;
  if (id === "dante") return "/profiles/dante.jpg";
  return undefined;
}

export function initialOf(name: string, fallback: string) {
  const ch = name.trim()[0];
  return (ch || fallback).toUpperCase();
}

export async function fileToAvatar(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await bakeAvatar(url, { mode: "crop", zoom: 1, x: 0, y: 0 });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type AvatarCrop = {
  mode: "fit" | "crop";
  zoom: number;
  x: number;
  y: number;
};

export function bakeAvatar(src: string, crop: AvatarCrop) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      let ctx: CanvasRenderingContext2D;
      let canvas: HTMLCanvasElement;
      try {
        ({ canvas, ctx } = prepCanvas(size));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("No se pudo recortar la foto."));
        return;
      }
      ctx.fillStyle = "#1c140e";
      ctx.fillRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (crop.mode === "fit") {
        const scale = Math.min(size / iw, size / ih);
        const w = iw * scale;
        const h = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      } else {
        const zoom = Math.min(3, Math.max(1, crop.zoom || 1));
        const scale = Math.max(size / iw, size / ih) * zoom;
        const w = iw * scale;
        const h = ih * scale;
        const nx = Math.min(1, Math.max(-1, crop.x || 0));
        const ny = Math.min(1, Math.max(-1, crop.y || 0));
        const extraX = Math.max(0, w - size);
        const extraY = Math.max(0, h - size);
        const dx = (size - w) / 2 + nx * extraX * 0.5;
        const dy = (size - h) / 2 + ny * extraY * 0.5;
        ctx.drawImage(img, dx, dy, w, h);
      }
      resolve(toHiResJpeg(canvas, 0.94));
    };
    img.onerror = () => reject(new Error("No se pudo leer esa foto."));
    img.src = src;
  });
}

export const useProfiles = create<ProfilesState>((set, get) => ({
  byId: defaults(),
  ready: false,
  hydrate: () => {
    set({ byId: load(), ready: true });
  },
  setName: (id, name) => {
    const byId = {
      ...get().byId,
      [id]: { ...get().byId[id], name: name.trim() || get().byId[id].name },
    };
    persist(byId);
    set({ byId });
  },
  setPhoto: (id, photo) => {
    const byId = {
      ...get().byId,
      [id]: { ...get().byId[id], photo, hideFace: !photo },
    };
    persist(byId);
    set({ byId });
  },
  replaceAll: (byId) => {
    persist(byId);
    set({ byId, ready: true });
  },
}));
