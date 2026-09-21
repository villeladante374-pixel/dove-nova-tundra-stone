/// <reference lib="webworker" />

const FILES = [
  "en_GB-jenny_dioco-medium.onnx",
  "en_GB-jenny_dioco-medium.onnx.json",
] as const;

let seeded = false;

async function seedLocalVoice() {
  if (seeded) return;
  const root = await navigator.storage.getDirectory();
  const piper = await root.getDirectoryHandle("piper", { create: true });
  for (const name of FILES) {
    let ok = false;
    try {
      const existing = await piper.getFileHandle(name);
      const file = await existing.getFile();
      if (file.size > 1024) ok = true;
    } catch {
      ok = false;
    }
    if (ok) continue;
    const res = await fetch(`/voices/${name}`);
    if (!res.ok) throw new Error("No está la voz en la app.");
    const buf = await res.arrayBuffer();
    const handle = await piper.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(buf);
    await writable.close();
  }
  seeded = true;
}

self.onmessage = async (ev: MessageEvent<{ id: number; text?: string; warm?: boolean }>) => {
  const { id, text, warm } = ev.data;
  try {
    await seedLocalVoice();
    if (warm || !text) {
      self.postMessage({ id, ok: true, warm: true });
      return;
    }
    const tts = await import("@diffusionstudio/vits-web");
    const blob = await tts.predict({
      text,
      voiceId: "en_GB-jenny_dioco-medium",
    });
    const buf = await blob.arrayBuffer();
    self.postMessage({ id, ok: true, buf }, [buf]);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo narrar.",
    });
  }
};
