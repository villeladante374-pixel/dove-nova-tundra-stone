const PACK: { keys: string[]; src: string }[] = [
  { keys: ["verity"], src: "/recovery/verity.jpg" },
  { keys: ["only one left", "only-one-left"], src: "/recovery/only-one-left.jpg" },
  { keys: ["midnight library"], src: "/recovery/midnight-library.jpg" },
  { keys: ["hail mary", "project mary hail", "project hail"], src: "/recovery/hail-mary.jpg" },
];

export function recoveryCoverSrc(title: string) {
  const t = title.toLowerCase();
  for (const row of PACK) {
    if (row.keys.some((k) => t.includes(k))) return row.src;
  }
  return null;
}
