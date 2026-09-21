export type LeatherId = "burgundy" | "forest" | "navy" | "tan";

export type BookKind = "pdf" | "manuscript";

export type BookRecord = {
  id: string;
  title: string;
  author: string;
  pageCount: number;
  leather: LeatherId;
  kind: BookKind;
  manuscriptKey?: string;
  createdAt: number;
  hasCover: boolean;
  coverData?: string;
  coverMedia?: string;
  hoverMedia?: string;
  hasHoverVideo?: boolean;
  fileSize?: number;
  cloudSaved?: boolean;
};

export const LEATHER_SRC: Record<LeatherId, string> = {
  burgundy: "/covers/leather-burgundy.jpg",
  forest: "/covers/leather-forest.jpg",
  navy: "/covers/leather-navy.jpg",
  tan: "/covers/leather-tan.jpg",
};

export const DEMO_COVER_SRC: Record<string, string> = {
  bestiary: "/covers/bestiary.jpg",
  chronicles: "/covers/chronicles.jpg",
  herbarium: "/covers/herbarium.jpg",
};

export function leatherForTitle(title: string): LeatherId {
  const keys: LeatherId[] = ["burgundy", "forest", "navy", "tan"];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash + title.charCodeAt(i) * (i + 1)) % 997;
  return keys[hash % keys.length] ?? "burgundy";
}
