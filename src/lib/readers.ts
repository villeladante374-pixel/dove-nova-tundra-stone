export type ReaderId = "elsa" | "alexis" | "dante" | "fernando" | "daniela";

export type Reader = {
  id: ReaderId;
  name: string;
  initial: string;
};

export const READERS: Reader[] = [
  { id: "elsa", name: "Elsa", initial: "E" },
  { id: "alexis", name: "Alexis", initial: "A" },
  { id: "dante", name: "Dante", initial: "D" },
  { id: "fernando", name: "Fernando", initial: "F" },
  { id: "daniela", name: "Daniela", initial: "D" },
];

const KEY = "book-club-reader";

export function isReaderId(value: string | null | undefined): value is ReaderId {
  return READERS.some((r) => r.id === value);
}

export function readStoredReaderId(): ReaderId | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isReaderId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function persistReaderId(id: ReaderId | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore quota */
  }
}

export function readerById(id: ReaderId | null) {
  return READERS.find((r) => r.id === id) ?? null;
}
