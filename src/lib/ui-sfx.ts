const TICKS = [
  "/sfx/rail-1.wav",
  "/sfx/rail-2.wav",
  "/sfx/rail-3.wav",
  "/sfx/rail-4.wav",
  "/sfx/rail-5.wav",
] as const;

const MUTE_KEY = "el-tomo-sfx-mute";
const VOL_KEY = "el-tomo-sfx-vol";

const pool: HTMLAudioElement[][] = [];
let cursor = 0;
let armed = false;
let whoosh: HTMLAudioElement | null = null;
let sfxMuted = false;
let sfxVol = 0.85;

if (typeof window !== "undefined") {
  try {
    sfxMuted = localStorage.getItem(MUTE_KEY) === "1";
    const v = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v)) sfxVol = Math.min(1, Math.max(0, v));
  } catch {
    /* ignore */
  }
}

function ensurePool() {
  if (typeof window === "undefined" || pool.length) return;
  for (const src of TICKS) {
    const el = new Audio(src);
    el.preload = "auto";
    el.volume = 0.8 * sfxVol;
    pool.push([el]);
  }
}

function ensureWhoosh() {
  if (typeof window === "undefined" || whoosh) return;
  whoosh = new Audio("/sfx/open.mp3");
  whoosh.preload = "auto";
  whoosh.volume = 0.9 * sfxVol;
}

function gain() {
  return sfxMuted ? 0 : sfxVol;
}

export function isSfxMuted() {
  return sfxMuted;
}

export function getSfxVolume() {
  return sfxVol;
}

export function setSfxMuted(value: boolean) {
  sfxMuted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function setSfxVolume(value: number) {
  sfxVol = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(VOL_KEY, String(sfxVol));
  } catch {
    /* ignore */
  }
  for (const lane of pool) {
    for (const el of lane) el.volume = 0.8 * gain();
  }
  if (whoosh) whoosh.volume = 0.9 * gain();
}

function playFromPool(dir: 1 | -1) {
  if (sfxMuted) return;
  ensurePool();
  if (!pool.length) return;
  const lane = pool[cursor % pool.length]!;
  cursor += 1;
  let el = lane.find((a) => a.paused || a.ended);
  if (!el) {
    el = lane[0]!.cloneNode(true) as HTMLAudioElement;
    lane.push(el);
  }
  el.volume = 0.8 * sfxVol;
  el.playbackRate = dir > 0 ? 1 : 0.96;
  try {
    el.currentTime = 0;
  } catch {
    /* not ready */
  }
  const run = el.play();
  if (run) void run.catch(() => undefined);
}

export function unlockUiSfx() {
  if (armed) return;
  armed = true;
  ensurePool();
  ensureWhoosh();
  const el = pool[0]?.[0];
  if (!el) return;
  const prev = el.volume;
  el.volume = 0.001;
  const run = el.play();
  if (run) {
    void run
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = prev;
      })
      .catch(() => {
        el.volume = prev;
        armed = false;
      });
  }
}

export function playRailMove(dir: 1 | -1 = 1) {
  playFromPool(dir);
}

export function playOpenSfx() {
  if (sfxMuted) return;
  ensureWhoosh();
  if (!whoosh) return;
  whoosh.volume = 0.9 * sfxVol;
  try {
    whoosh.pause();
    whoosh.currentTime = 0;
  } catch {
    /* ignore */
  }
  const run = whoosh.play();
  if (run) void run.catch(() => undefined);
}

export function isUiSfxArmed() {
  return armed;
}

if (typeof window !== "undefined") {
  ensurePool();
  ensureWhoosh();
  const arm = () => unlockUiSfx();
  window.addEventListener("pointerdown", arm, true);
  window.addEventListener("keydown", arm, true);
}
