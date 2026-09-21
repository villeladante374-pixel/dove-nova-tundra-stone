import { idbGetAllFiles, idbGetFile, idbPutFile } from "@/lib/idb";
import { useMarks } from "@/lib/marks-store";
import { useProfiles } from "@/lib/profiles-store";
import { useUiPrefs } from "@/lib/ui-prefs";
import { useReading } from "@/lib/reading-store";
import type { BookRecord } from "@/lib/types";
import { buildZip, readZip } from "@/lib/zip-store";

export type TomoPackMeta = {
  v: 2 | 3;
  books: BookRecord[];
  goneIds: string[];
  marks: { scores: Record<string, Partial<Record<string, number>>>; spots: Record<string, { x: number; y: number }> };
  profiles: Record<string, { name: string }>;
  settings: { logo?: number; lead?: number };
  reading?: {
    favorites: string[];
    bookmarks: Record<string, number>;
    progress?: Record<string, number>;
    highlights: { id: string; bookId: string; page: number; text: string; note?: string; createdAt: number }[];
  };
  savedAt: number;
};

function emptyMeta(): TomoPackMeta {
  return {
    v: 3,
    books: [],
    goneIds: [],
    marks: { scores: {}, spots: {} },
    profiles: {},
    settings: {},
    savedAt: 0,
  };
}

function asMeta(raw: unknown): TomoPackMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<TomoPackMeta> & { pack?: TomoPackMeta };
  const src = data.books || data.v ? data : data.pack;
  if (!src || typeof src !== "object") return null;
  const books = Array.isArray(src.books) ? src.books : [];
  if (!books.length && !Array.isArray(src.goneIds) && src.v == null) return null;
  return {
    ...emptyMeta(),
    ...src,
    books,
    goneIds: Array.isArray(src.goneIds) ? src.goneIds : [],
    marks: src.marks ?? { scores: {}, spots: {} },
    profiles: src.profiles ?? {},
    settings: src.settings ?? {},
    reading: src.reading,
    savedAt: Number(src.savedAt) || Date.now(),
  };
}

function looksJson(buf: Uint8Array) {
  let i = 0;
  while (i < buf.length && (buf[i] === 32 || buf[i] === 10 || buf[i] === 13 || buf[i] === 9)) i += 1;
  return buf[i] === 123 || buf[i] === 91;
}

export async function makeTomoPack(books: BookRecord[], goneIds: string[]) {
  const marks = useMarks.getState();
  if (!marks.ready) marks.hydrate();
  useProfiles.getState().hydrate();
  const meta: TomoPackMeta = {
    v: 3,
    books: books.map(({ coverData: _c, ...rest }) => rest),
    goneIds,
    marks: marks.snapshot(),
    profiles: useProfiles.getState().byId,
    settings: { logo: useUiPrefs.getState().logo, lead: useUiPrefs.getState().lead },
    reading: useReading.getState().snapshot(),
    savedAt: Date.now(),
  };
  const files = await idbGetAllFiles();
  const entries = [{ name: "pack.json", data: new TextEncoder().encode(JSON.stringify(meta)) }];
  for (const file of files) {
    if (!file?.id || !file.blob) continue;
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    entries.push({ name: `files/${file.id}`, data: bytes });
    if (file.mime) {
      entries.push({
        name: `files/${file.id}.mime`,
        data: new TextEncoder().encode(file.mime),
      });
    }
  }
  return buildZip(entries);
}

function packName() {
  return `book-club-${new Date().toISOString().slice(0, 10)}.tomo.zip`;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function pickTomoSave(): Promise<FileSystemFileHandle | null> {
  const picker = (window as Window & { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (!picker) return null;
  return picker({
    suggestedName: packName(),
    types: [{ description: "Book Club", accept: { "application/zip": [".zip"] } }],
  });
}

export async function downloadTomoPack(blob: Blob, handle?: FileSystemFileHandle | null) {
  const name = packName();
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "file";
  }
  const file = new File([blob], name, { type: "application/zip" });
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);

  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch {
      /* user cancelled share; the download already fired */
    }
  }
  return "download";
}

export async function parseTomoPack(file: File) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!buf.byteLength) throw new Error("El archivo está vacío. En el celular elige el .tomo.zip desde Archivos, no una foto.");

  if (looksJson(buf)) {
    try {
      const meta = asMeta(JSON.parse(new TextDecoder().decode(buf)));
      if (meta) return { meta, files: [] as { id: string; blob: Blob; mime: string }[] };
    } catch {
      /* not json */
    }
  }

  let entries;
  try {
    entries = await readZip(buf);
  } catch (err) {
    const why = err instanceof Error ? err.message : "";
    if (why === "ZIP_EOCD") {
      throw new Error("Esa copia no llegó completa. En el celular abre el .tomo.zip (no un enlace ni una captura).");
    }
    throw err instanceof Error ? err : new Error("No se pudo leer esa copia.");
  }

  const byName = new Map(entries.map((e) => [e.name.replace(/^\/+/, ""), e.data]));
  const packRaw = byName.get("pack.json") ?? byName.get("library.json");
  if (!packRaw) throw new Error("Ese zip no es un guardado de Book Club (falta pack.json).");
  const meta = asMeta(JSON.parse(new TextDecoder().decode(packRaw)));
  if (!meta) throw new Error("El guardado está dañado.");

  const files: { id: string; blob: Blob; mime: string }[] = [];
  for (const [name, data] of byName) {
    if (!name.startsWith("files/") || name.endsWith(".mime")) continue;
    const id = name.slice("files/".length);
    const mimeBytes = byName.get(`${name}.mime`);
    const mime = mimeBytes ? new TextDecoder().decode(mimeBytes) : guessMime(id);
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    files.push({ id, blob: new Blob([copy], { type: mime }), mime });
  }
  return { meta, files };
}

function guessMime(id: string) {
  if (id.startsWith("pdf:")) return "application/pdf";
  if (id.startsWith("hover:")) return "video/mp4";
  if (id.startsWith("cover:")) return "image/jpeg";
  return "application/octet-stream";
}

export async function applyTomoFiles(files: { id: string; blob: Blob }[]) {
  for (const file of files) {
    if (file.id && file.blob && file.blob.size > 8) await idbPutFile(file.id, file.blob);
  }
}

export async function hasPdf(id: string) {
  const file = await idbGetFile(`pdf:${id}`);
  return Boolean(file?.blob && file.blob.size > 32);
}
