const DB_NAME = "el-scriptorium";
const DB_VERSION = 4;
const HIDDEN_KEY = "book-club-hidden-demos";

export type FileRecord = {
  id: string;
  blob: Blob;
  mime: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      if (!db.objectStoreNames.contains("stash")) db.createObjectStore("stash");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("No se pudo abrir el archivo"));
    };
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Fallo del archivo"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Fallo del archivo"));
    tx.onabort = () => reject(tx.error ?? new Error("Se abortó el archivo"));
  });
}

export async function idbPutBook(book: unknown) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").put(book);
    await txDone(tx);
  });
}

export async function idbGetAllBooks<T>(): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction("books", "readonly");
  return reqToPromise(tx.objectStore("books").getAll()) as Promise<T[]>;
}

export async function idbDeleteBook(id: string) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction(["books", "files"], "readwrite");
    tx.objectStore("books").delete(id);
    tx.objectStore("files").delete(`pdf:${id}`);
    tx.objectStore("files").delete(`cover:${id}`);
    tx.objectStore("files").delete(`hover:${id}`);
    await txDone(tx);
  });
}

export async function idbPutFile(id: string, blob: Blob) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put({ id, blob, mime: blob.type } satisfies FileRecord);
    await txDone(tx);
  });
}

export async function idbDeleteFile(id: string) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction("files", "readwrite");
    await reqToPromise(tx.objectStore("files").delete(id));
  });
}

export async function idbGetFile(id: string): Promise<FileRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction("files", "readonly");
  return reqToPromise(tx.objectStore("files").get(id)) as Promise<FileRecord | undefined>;
}

export function getHiddenDemos(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setHiddenDemos(ids: string[]) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
}

export type StashRecord = {
  books: unknown[];
  files: FileRecord[];
  goneIds?: string[];
  marks: { scores: Record<string, Partial<Record<string, number>>>; spots: Record<string, { x: number; y: number }> };
  profiles?: Record<string, { name: string }>;
  settings?: { logo?: number; lead?: number };
  savedAt: number;
};

export async function idbGetAllFiles(): Promise<FileRecord[]> {
  const db = await openDb();
  const tx = db.transaction("files", "readonly");
  return reqToPromise(tx.objectStore("files").getAll()) as Promise<FileRecord[]>;
}

export async function idbPutStash(data: StashRecord) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction("stash", "readwrite");
    tx.objectStore("stash").put(data, "shelf");
    await txDone(tx);
  });
}

export async function idbGetStash(): Promise<StashRecord | undefined> {
  const db = await openDb();
  if (!db.objectStoreNames.contains("stash")) return undefined;
  const tx = db.transaction("stash", "readonly");
  return reqToPromise(tx.objectStore("stash").get("shelf")) as Promise<StashRecord | undefined>;
}

export async function idbGetGoneIds(): Promise<string[]> {
  const db = await openDb();
  if (!db.objectStoreNames.contains("meta")) return [];
  const tx = db.transaction("meta", "readonly");
  const raw = await reqToPromise(tx.objectStore("meta").get("goneIds"));
  return Array.isArray(raw) ? (raw as string[]) : [];
}

export async function idbPutGoneIds(ids: string[]) {
  return enqueue(async () => {
    const db = await openDb();
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put([...new Set(ids)], "goneIds");
    await txDone(tx);
  });
}

const CATALOG_KEY = "book-club-catalog-v1";

export function readCatalog<T>(): T[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCatalog(books: unknown[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(books));
  } catch {
    /* quota */
  }
}
