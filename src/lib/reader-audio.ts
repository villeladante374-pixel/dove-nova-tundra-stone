import { getSfxVolume, isSfxMuted } from "@/lib/ui-sfx";

const MUTE_KEY = "book-club-reader-muted";
const VOICE_KEY = "book-club-voice";
const PACE_KEY = "book-club-pace";
const VOL_KEY = "book-club-reader-vol";

const PAGE_TURNS = [
  "/sfx/page-1.wav",
  "/sfx/page-2.wav",
  "/sfx/page-3.wav",
  "/sfx/page-4.wav",
] as const;

const VOICES = {
  cori: { id: "en_GB-cori-medium", label: "Cori", files: ["en_GB-cori-medium.onnx", "en_GB-cori-medium.onnx.json"] },
  jenny: { id: "en_GB-jenny_dioco-medium", label: "Jenny", files: ["en_GB-jenny_dioco-medium.onnx", "en_GB-jenny_dioco-medium.onnx.json"] },
  amy: { id: "en_US-hfc_female-medium", label: "Amy", files: ["en_US-hfc_female-medium.onnx", "en_US-hfc_female-medium.onnx.json"] },
} as const;

type VoiceKey = keyof typeof VOICES;
type Pace = "normal" | "x2" | "x4";

const pagePool: HTMLAudioElement[][] = [];
let pageCursor = 0;
let muted = false;
let volume = 1;
let speaking = false;
let paused = false;
let follow = false;
let onEndSpread: (() => void) | null = null;
let current: HTMLAudioElement | null = null;
let utterance: SpeechSynthesisUtterance | null = null;
let queueGen = 0;
let piperReady: Partial<Record<VoiceKey, Promise<void>>> = {};
let piperHot = new Set<VoiceKey>();
let stopTimers: number[] = [];
let voiceKey: VoiceKey = "cori";
let pace: Pace = "normal";

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
    const vol = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(vol)) volume = Math.min(1, Math.max(0, vol));
    const p = localStorage.getItem(PACE_KEY);
    if (p === "x2" || p === "x4" || p === "normal") pace = p;
    else if (p === "fast") pace = "x2";
  } catch {
    muted = false;
  }
}

function ensurePagePool() {
  if (typeof window === "undefined" || pagePool.length) return;
  for (const src of PAGE_TURNS) {
    const el = new Audio(src);
    el.preload = "auto";
    el.volume = 0.72 * volume;
    pagePool.push([el]);
  }
}

const VOICE_REMOTE: Record<string, string> = {
  "en_GB-cori-medium.onnx":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/medium/en_GB-cori-medium.onnx",
  "en_GB-cori-medium.onnx.json":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/medium/en_GB-cori-medium.onnx.json",
  "en_GB-jenny_dioco-medium.onnx":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx",
  "en_GB-jenny_dioco-medium.onnx.json":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx.json",
  "en_US-hfc_female-medium.onnx":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx",
  "en_US-hfc_female-medium.onnx.json":
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json",
};

async function fetchVoiceFile(name: string) {
  const local = await fetch(`/voices/${name}`);
  if (local.ok) return local.arrayBuffer();
  const remote = VOICE_REMOTE[name];
  if (!remote) throw new Error("No está la voz en la app.");
  const res = await fetch(remote);
  if (!res.ok) throw new Error("No está la voz en la app.");
  return res.arrayBuffer();
}

async function seedVoice(locked: VoiceKey) {
  const root = await navigator.storage.getDirectory();
  const piper = await root.getDirectoryHandle("piper", { create: true });
  for (const name of VOICES[locked].files) {
    try {
      const existing = await piper.getFileHandle(name);
      const file = await existing.getFile();
      if (file.size > 1024) continue;
    } catch {
      /* copy */
    }
    const buf = await fetchVoiceFile(name);
    const handle = await piper.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(buf);
    await writable.close();
  }
}

function ensurePiper(locked: VoiceKey) {
  piperReady[locked] ??= seedVoice(locked).catch((err) => {
    delete piperReady[locked];
    throw err;
  });
  return piperReady[locked]!;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

async function synthPiper(text: string, locked: VoiceKey, gen: number) {
  await ensurePiper(locked);
  if (gen !== queueGen || !speaking) return new ArrayBuffer(0);
  const tts = await import("@diffusionstudio/vits-web");
  if (gen !== queueGen || !speaking) return new ArrayBuffer(0);
  const blob = await tts.predict({
    text,
    voiceId: VOICES[locked].id,
  });
  if (gen !== queueGen || !speaking) return new ArrayBuffer(0);
  return blob.arrayBuffer();
}

function pickBrowserVoice(locked: VoiceKey) {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const female = (v: SpeechSynthesisVoice) => !/male|david|daniel|george|mark|fred|arthur|rishi|aaron|tom|james|ryan/i.test(v.name);
  const gb = voices.filter((v) => /en-GB/i.test(v.lang) && female(v));
  const us = voices.filter((v) => /en-US/i.test(v.lang) && female(v));
  const named = (list: SpeechSynthesisVoice[], re: RegExp) => list.find((v) => re.test(v.name));
  if (locked === "amy") {
    return (
      named(us, /samantha|karen|aria|jenny|google us english/i) ??
      named(voices, /samantha|karen|aria|susan/i) ??
      us.find((v) => !/zira|david|mark|fred/i.test(v.name)) ??
      named(gb, /google uk english female|samantha|serena/i) ??
      gb[0] ??
      null
    );
  }
  if (locked === "jenny") {
    return (
      named(gb, /libby|sonia|hazel|susan/i) ??
      gb.find((v) => !/google uk english female/i.test(v.name)) ??
      gb[1] ??
      gb[0] ??
      null
    );
  }
  return named(gb, /google uk english female/i) ?? named(gb, /moira|martha|serena|fiona/i) ?? gb[0] ?? null;
}

function clearStopTimers() {
  for (const t of stopTimers) window.clearTimeout(t);
  stopTimers = [];
}

function hardStopSpeech() {
  if (utterance) {
    utterance.onend = null;
    utterance.onerror = null;
    utterance.onpause = null;
    utterance = null;
  }
  try {
    const s = window.speechSynthesis;
    if (s) {
      s.pause();
      s.cancel();
      s.cancel();
    }
  } catch {
    /* ignore */
  }
  if (current) {
    try {
      current.pause();
      current.src = "";
    } catch {
      /* ignore */
    }
    current = null;
  }
}

function speakBrowser(text: string, locked: VoiceKey, mood?: { rate: number; pitch: number }) {
  return new Promise<ArrayBuffer | null>((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("No hay voz lista."));
      return;
    }
    const gen = queueGen;
    const start = () => {
      if (gen !== queueGen || !speaking || paused) {
        resolve(null);
        return;
      }
      const voice = pickBrowserVoice(locked);
      const u = new SpeechSynthesisUtterance(text);
      utterance = u;
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = locked === "amy" ? "en-US" : "en-GB";
      const feel = mood ?? { rate: 1, pitch: 1 };
      u.rate = Math.min(1.32, Math.max(0.88, paceRate() * feel.rate));
      const base = locked === "amy" ? 1.05 : locked === "jenny" ? 1.12 : 1.02;
      u.pitch = Math.min(1.35, Math.max(0.85, base * feel.pitch));
      u.volume = volume;
      u.onend = () => {
        if (utterance === u) utterance = null;
        resolve(null);
      };
      u.onerror = (ev) => {
        if (utterance === u) utterance = null;
        const why = (ev as SpeechSynthesisErrorEvent).error;
        if (why === "interrupted" || why === "canceled") {
          resolve(null);
          return;
        }
        reject(new Error("La voz se detuvo."));
      };
      window.speechSynthesis.speak(u);
    };
    const ready = window.speechSynthesis.getVoices();
    if (ready.length) {
      start();
      return;
    }
    const timer = window.setTimeout(start, 120);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        start();
      },
      { once: true },
    );
  });
}

async function synth(text: string, locked: VoiceKey, gen: number, mood?: { rate: number; pitch: number }) {
  if (gen !== queueGen || !speaking) return null;
  await speakBrowser(text, locked, mood);
  return null;
}

export function narratorName() {
  return VOICES[voiceKey].label;
}

export function cycleNarrator() {
  stopNarration();
  voiceKey = "cori";
  return VOICES.cori.label;
}

export function setNarrator(_id: string) {
  stopNarration();
  voiceKey = "cori";
  try {
    localStorage.setItem(VOICE_KEY, "cori");
  } catch {
    /* ignore */
  }
  return VOICES.cori.label;
}

export function getNarrator() {
  return voiceKey;
}

export function paceName() {
  return pace === "x2" ? "x2" : pace === "x4" ? "x4" : "Normal";
}

export function cyclePace() {
  pace = pace === "normal" ? "x2" : pace === "x2" ? "x4" : "normal";
  try {
    localStorage.setItem(PACE_KEY, pace);
  } catch {
    /* ignore */
  }
  applyPace();
  return paceName();
}

export function getPace() {
  return pace;
}

function paceRate() {
  if (pace === "x4") return 1.55;
  if (pace === "x2") return 1.22;
  return 1.08;
}

function moodOf(text: string) {
  const t = text.trim();
  const q = /\?\s*["'”’]?$/.test(t) || (t.includes("?") && t.length < 140);
  const bang = /!\s*["'”’]?$/.test(t);
  const quote = /^["'“‘]/.test(t);
  const dark = /\b(dead|death|die|died|sorry|grief|cry|crying|blood|afraid|lonely|dark|kill|hurt|pain|loss)\b/i.test(t);
  const bright = /\b(love|smile|laugh|happy|good|beautiful|yes|together|hope|light)\b/i.test(t);
  let rate = 1;
  let pitch = 1;
  let pause = 28;
  if (q) {
    pitch = 1.12;
    rate = 0.98;
    pause = 40;
  } else if (bang) {
    pitch = 1.08;
    rate = 1.08;
    pause = 32;
  } else if (dark) {
    pitch = 0.94;
    rate = 0.96;
    pause = 36;
  } else if (bright) {
    pitch = 1.06;
    rate = 1.05;
    pause = 24;
  }
  if (quote) {
    pitch *= 1.05;
    rate *= 1.02;
  }
  return { rate, pitch, pause };
}

function chunksOf(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/g) ?? [clean];
  const chunks: { t: string; pause: number; rate: number; pitch: number }[] = [];
  let buf = "";
  const flush = () => {
    const piece = buf.trim();
    if (!piece) return;
    chunks.push({ t: piece, ...moodOf(piece) });
    buf = "";
  };
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    const next = buf ? `${buf} ${piece}` : piece;
    if (piece.length < 40 && next.length < 280) {
      buf = next;
      continue;
    }
    if (buf && (next.length > 360 || /[?!]$/.test(buf.trim()))) flush();
    buf = buf ? `${buf} ${piece}` : piece;
    if (buf.length > 320 || /[?!]$/.test(buf.trim())) flush();
  }
  flush();
  return chunks;
}

function applyPace() {
  if (current) current.playbackRate = paceRate();
}

export function getReaderVolume() {
  return volume;
}

export function setReaderVolume(value: number) {
  volume = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(VOL_KEY, String(volume));
  } catch {
    /* ignore */
  }
  if (current) current.volume = volume;
}

export function isReaderMuted() {
  return muted;
}

export function setReaderMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (value) stopNarration();
}

export function playPageTurn(dir: 1 | -1 = 1) {
  if (muted || isSfxMuted()) return;
  ensurePagePool();
  if (!pagePool.length) return;
  pageCursor = (pageCursor + 1) % pagePool.length;
  const lane = pagePool[pageCursor]!;
  let el = lane.find((a) => a.paused || a.ended);
  if (!el) {
    el = lane[0]!.cloneNode(true) as HTMLAudioElement;
    lane.push(el);
  }
  el.playbackRate = dir > 0 ? 1 : 0.94;
  el.volume = 0.72 * volume * getSfxVolume();
  try {
    el.currentTime = 0;
  } catch {
    /* not ready */
  }
  const run = el.play();
  if (run) void run.catch(() => undefined);
}

export function isNarrating() {
  return speaking && !paused;
}

export function isNarrationPaused() {
  return speaking && paused;
}

export function stopNarration() {
  speaking = false;
  paused = false;
  follow = false;
  onEndSpread = null;
  queueGen += 1;
  const gen = queueGen;
  hardStopSpeech();
  clearStopTimers();
  if (typeof window !== "undefined") {
    for (const ms of [40, 180, 450]) {
      stopTimers.push(
        window.setTimeout(() => {
          if (queueGen === gen && !speaking) hardStopSpeech();
        }, ms),
      );
    }
  }
}

export function pauseNarration() {
  if (!speaking) return;
  paused = true;
  if (current) {
    try {
      current.pause();
    } catch {
      /* ignore */
    }
  }
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.pause();
    s.cancel();
  } catch {
    /* ignore */
  }
}

export function resumeNarration() {
  return false;
}

export function unlockAudio() {
  ensurePagePool();
  try {
    const s = window.speechSynthesis;
    if (s) {
      s.getVoices();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 2;
      s.speak(u);
      s.cancel();
    }
  } catch {
    /* ignore */
  }
  const lane = pagePool[0];
  const el = lane?.[0];
  if (el) {
    const prev = el.volume;
    el.volume = 0;
    void el.play().then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = prev;
    }).catch(() => {
      el.volume = prev;
    });
  }
}

export function warmVoices() {
  ensurePagePool();
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    /* ignore */
  }
}

function waitWhilePaused(gen: number) {
  return new Promise<void>((resolve) => {
    const tick = () => {
      if (gen !== queueGen || !speaking) return resolve();
      if (!paused) return resolve();
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

function playBuffer(buf: ArrayBuffer, gen: number, feel = 1) {
  if (gen !== queueGen || !speaking || buf.byteLength < 64) return Promise.resolve();
  const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = volume;
  audio.playbackRate = Math.min(1.4, Math.max(0.88, paceRate() * feel));
  current = audio;
  return new Promise<void>((resolve) => {
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      URL.revokeObjectURL(url);
      if (current === audio) current = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    const tick = () => {
      if (closed) return;
      if (gen !== queueGen || !speaking) {
        try {
          audio.pause();
          audio.src = "";
        } catch {
          /* ignore */
        }
        done();
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
    void audio.play().catch(done);
  });
}

export async function speakSpread(text: string, opts?: { onDone?: () => void }) {
  const parts = chunksOf(text);
  if (!parts.length) throw new Error("Esta página no tiene texto para narrar.");
  clearStopTimers();
  stopNarration();
  speaking = true;
  paused = false;
  follow = true;
  onEndSpread = opts?.onDone ?? null;
  const gen = queueGen;
  const locked = voiceKey;
  const name = VOICES[locked].label;
  try {
    for (let i = 0; i < parts.length; i++) {
      if (gen !== queueGen || !speaking) return name;
      await waitWhilePaused(gen);
      if (gen !== queueGen || !speaking) return name;
      const buf = await synth(parts[i]?.t ?? "", locked, gen, parts[i]);
      if (gen !== queueGen || !speaking) return name;
      await waitWhilePaused(gen);
      if (buf) await playBuffer(buf, gen, parts[i]?.rate ?? 1);
      const gap = Math.min(40, parts[i]?.pause ?? 24);
      if (gap && gen === queueGen && speaking) await sleep(gap);
    }
    if (gen === queueGen && speaking && !paused) {
      speaking = false;
      const done = onEndSpread;
      onEndSpread = null;
      done?.();
    }
  } catch (err) {
    speaking = false;
    throw err;
  }
  return name;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function wantsFollowPages() {
  return follow && speaking;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => stopNarration());
  window.addEventListener("beforeunload", () => stopNarration());
}
