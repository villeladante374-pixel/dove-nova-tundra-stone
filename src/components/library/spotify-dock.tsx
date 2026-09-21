import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as PE,
  type ReactNode,
} from "react";
import { MoreHorizontal, Music, X } from "lucide-react";

const PATH_KEY = "el-tomo-media";
const SPLIT_KEY = "el-tomo-split-w";
const SESSION_KEY = "el-tomo-island-open";
const MUSIC = { w: 340, h: 196 };
const YT = { w: 420, h: 292 };
const YT_LG = { w: 720, h: 456 };
const PICK = { w: 280, h: 148 };

type Mode = "music";
type Phase = "dot" | "blob" | "wide" | "dock" | "split" | "out";
type Zone = "bottom" | "left" | "right" | null;
type Media = {
  kind: "spotify";
  ref: string;
  title: string;
  artist: string;
  t?: number;
};
type Origin = { x: number; y: number };
type Boot = {
  origin: Origin;
  mode?: Mode;
  media?: Media;
  phase?: Phase;
  side?: "left" | "right";
  splitPx?: number;
  big?: boolean;
};
type Ctx = {
  openFrom: (o: Origin, boot?: { mode?: Mode; media?: Media }) => void;
  close: () => void;
};

const SpotifyCtx = createContext<Ctx | null>(null);
let islandDismiss: (() => void) | null = null;
const DEFAULT_MUSIC: Media = { kind: "spotify", ref: "playlist/37i9dQZF1DX4sWSpwq3LiO", title: "Música", artist: "Lista" };

function parseMedia(input: string): Media | null {
  const raw = input.trim();
  let href = raw;
  if (raw && !/^https?:\/\//i.test(raw) && /spotify/i.test(raw)) href = `https://${raw}`;
  try {
    const u = new URL(href);
    if (u.hostname.includes("open.spotify.com")) {
      const hit = u.pathname.match(/\/(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/);
      if (hit) return { kind: "spotify", ref: `${hit[1]}/${hit[2]}`, title: "Música", artist: "Lista" };
    }
  } catch {
    /* not a url */
  }
  const uri = raw.match(/spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]+)/i);
  if (uri) return { kind: "spotify", ref: `${uri[1]}/${uri[2]}`, title: "Música", artist: "Lista" };
  if (/^(playlist|album|track)\//i.test(raw)) return { kind: "spotify", ref: raw, title: "Música", artist: "Lista" };
  return null;
}

function mediaSrc(media: Media) {
  return `https://open.spotify.com/embed/${media.ref}?utm_source=generator&theme=0`;
}

class IslandGuard extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  componentDidCatch() {
    /* keep the hall alive */
  }
  render() {
    if (this.state.bad) return null;
    return this.props.children;
  }
}

export function SpotifyRoot({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Boot | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Boot & { open?: boolean };
      if (!s?.open || !s.mode) return;
      setSession({
        origin: { x: window.innerWidth / 2, y: 36 },
        mode: s.mode,
        media: s.media,
        phase: s.phase === "split" || s.phase === "dock" || s.phase === "wide" ? s.phase : "wide",
        side: s.side,
        splitPx: s.splitPx,
        big: s.big,
      });
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(
    () => ({
      openFrom: (o: Origin, boot?: { mode?: Mode; media?: Media }) => {
        if (islandDismiss) {
          islandDismiss();
          return;
        }
        setSession({ origin: o, mode: "music", ...boot });
      },
      close: () => {
        if (islandDismiss) islandDismiss();
        else setSession(null);
      },
    }),
    [],
  );
  return (
    <SpotifyCtx.Provider value={value}>
      {children}
      {session ? (
        <IslandGuard>
          <Island origin={session.origin} boot={session} onClose={() => setSession(null)} />
        </IslandGuard>
      ) : null}
    </SpotifyCtx.Provider>
  );
}

export function SpotifyDock() {
  const ctx = useContext(SpotifyCtx);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className="dyn-logo has-tip"
      data-tip="Música"
      aria-label="Música"
      onClick={() => {
        const r = ref.current?.getBoundingClientRect();
        ctx?.openFrom(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 40 });
      }}
    >
      <img src="/brand/island-logo.svg" alt="" width={40} height={24} draggable={false} />
    </button>
  );
}

export function useMediaIsland() {
  return useContext(SpotifyCtx);
}

function Island({ origin, onClose, boot }: { origin: Origin; onClose: () => void; boot?: Boot }) {
  const resumed = Boolean(boot?.phase && boot.phase !== "dot" && boot.phase !== "blob");
  const [phase, setPhase] = useState<Phase>(resumed ? (boot?.phase as Phase) : "dot");
  const [mode] = useState<Mode>("music");
  const [back, setBack] = useState(false);
  const [overZone, setOverZone] = useState<Zone>(null);
  const [side, setSide] = useState<"left" | "right">(boot?.side ?? "right");
  const [splitPx, setSplitPx] = useState(() => {
    if (boot?.splitPx && boot.splitPx > 220) return boot.splitPx;
    try {
      const n = Number(localStorage.getItem(SPLIT_KEY));
      if (Number.isFinite(n) && n > 220) return n;
    } catch {
      /* ignore */
    }
    return typeof window !== "undefined" ? Math.round(window.innerWidth * 0.46) : 560;
  });
  const [big, setBig] = useState(Boolean(boot?.big));
  const [full, setFull] = useState(false);
  const [media, setMedia] = useState<Media>(boot?.media?.kind === "spotify" ? boot.media : DEFAULT_MUSIC);
  const [draft, setDraft] = useState("");
  const ytTime = useRef(boot?.media?.t ?? 0);
  const fillRef = useRef<HTMLDivElement>(null);
  const size = MUSIC;
  const [pos, setPos] = useState(() => ({
    x: Math.min(typeof window !== "undefined" ? window.innerWidth - size.w - 8 : origin.x, Math.max(8, origin.x - size.w / 2)),
    y: origin.y + 22,
  }));
  const boxRef = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const splitDrag = useRef(false);
  const splitRef = useRef(splitPx);
  const sideRef = useRef(side);
  const posRef = useRef(pos);
  const closing = useRef(false);
  const phaseRef = useRef(phase);
  const sizeRef = useRef(size);
  posRef.current = pos;
  phaseRef.current = phase;
  sizeRef.current = size;
  splitRef.current = splitPx;
  sideRef.current = side;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PATH_KEY);
      if (saved) {
        const next = JSON.parse(saved) as Media;
        if (next?.kind === "spotify") {
          setMedia(next);
          ytTime.current = next.t ?? ytTime.current;
        }
      }
    } catch {
      /* ignore */
    }
    if (resumed) {
      return () => clearLayout();
    }
    const a = window.setTimeout(() => setPhase("blob"), 80);
    const b = window.setTimeout(() => setPhase("wide"), 520);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      clearLayout();
    };
  }, []);

  useEffect(() => {
    if (phase === "dock") {
      document.documentElement.style.setProperty("--dyn-dock", "96px");
      document.documentElement.style.setProperty("--dyn-split-left", "0px");
      document.documentElement.style.setProperty("--dyn-split-right", "0px");
    } else if (phase === "split") {
      document.documentElement.style.setProperty("--dyn-dock", "0px");
      writeSplit(splitRef.current);
    } else {
      document.documentElement.style.setProperty("--dyn-dock", "0px");
      document.documentElement.style.setProperty("--dyn-split-left", "0px");
      document.documentElement.style.setProperty("--dyn-split-right", "0px");
    }
  }, [phase, mode, side]);

  useEffect(() => {
    function onResize() {
      if (phaseRef.current === "split") writeSplit(splitRef.current);
    }
    function onFs() {
      setFull(Boolean(document.fullscreenElement));
    }
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    if (!mode || phase === "dot" || phase === "blob" || phase === "out") return;
    persistOpen(true);
  }, [mode, media, phase, side, splitPx, big]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (typeof e.data !== "string" || !e.data.includes("infoDelivery")) return;
      try {
        const data = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } };
        if (data.event === "infoDelivery" && typeof data.info?.currentTime === "number") {
          ytTime.current = data.info.currentTime;
        }
      } catch {
        /* ignore */
      }
    }
    function flush() {
      persistOpen(phase !== "out");
    }
    window.addEventListener("message", onMsg);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("pagehide", flush);
    };
  }, [mode, media, phase, side, splitPx, big]);

  function clampSplit(px: number) {
    const minV = Math.max(240, Math.round(window.innerWidth * 0.18));
    const minA = Math.max(300, Math.round(window.innerWidth * 0.28));
    return Math.round(Math.min(window.innerWidth - minA, Math.max(minV, px)));
  }

  function writeSplit(px: number) {
    const w = clampSplit(px);
    splitRef.current = w;
    setSplitPx(w);
    const val = `${w}px`;
    const s = sideRef.current;
    document.documentElement.style.setProperty("--dyn-split-left", s === "left" ? val : "0px");
    document.documentElement.style.setProperty("--dyn-split-right", s === "right" ? val : "0px");
    try {
      localStorage.setItem(SPLIT_KEY, String(w));
    } catch {
      /* ignore */
    }
  }

  function clearLayout() {
    document.documentElement.style.removeProperty("--dyn-dock");
    document.documentElement.style.removeProperty("--dyn-split-left");
    document.documentElement.style.removeProperty("--dyn-split-right");
  }

  function zoneOf(x: number, y: number, w: number, h: number): Zone {
    if (x < 56) return "left";
    if (x + w > window.innerWidth - 56) return "right";
    if (y + h > window.innerHeight - 92) return "bottom";
    return null;
  }

  function pick(_next: Mode) {
    try {
      const saved = localStorage.getItem(PATH_KEY);
      const parsed = saved ? (JSON.parse(saved) as Media) : null;
      setMedia(parsed?.kind === "spotify" ? parsed : DEFAULT_MUSIC);
      setBack(false);
    } catch {
      setMedia(DEFAULT_MUSIC);
      setBack(false);
    }
  }

  function persistOpen(open: boolean, extra?: Partial<Media>) {
    const next = extra ? { ...media, ...extra } : media;
    try {
      localStorage.setItem(PATH_KEY, JSON.stringify({ ...next, t: ytTime.current }));
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          open,
          mode,
          media: { ...next, t: ytTime.current },
          phase,
          side,
          splitPx,
          big,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  function saveMedia(next: Media) {
    ytTime.current = next.ref === media.ref ? ytTime.current : 0;
    setMedia(next);
    persistOpen(true, next);
  }

  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    islandDismiss = null;
    persistOpen(false);
    setBack(false);
    setOverZone(null);
    clearLayout();
    setPhase("out");
    window.setTimeout(onClose, 720);
  }

  useEffect(() => {
    islandDismiss = dismiss;
    return () => {
      if (islandDismiss === dismiss) islandDismiss = null;
    };
  });

  function onDown(e: PE<HTMLElement>) {
    if (closing.current || full) return;
    if ((e.target as HTMLElement).closest("button, input, iframe, a, .dyn-drop, .dyn-pick, .dyn-split-bar")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - posRef.current.x, dy: e.clientY - posRef.current.y };
    e.currentTarget.style.transition = "none";
  }

  function onMove(e: PE<HTMLElement>) {
    if (!drag.current) return;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    if (phaseRef.current === "dock" || phaseRef.current === "split") {
      if (e.clientY < window.innerHeight - 110 && e.clientX > 64 && e.clientX < window.innerWidth - 64) {
        const next = {
          x: Math.min(window.innerWidth - w, Math.max(8, e.clientX - w / 2)),
          y: Math.max(8, e.clientY - 40),
        };
        posRef.current = next;
        setPos(next);
        setPhase("wide");
        setOverZone(null);
      }
      return;
    }
    const next = {
      x: Math.min(window.innerWidth - 48, Math.max(8, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 48, Math.max(8, e.clientY - drag.current.dy)),
    };
    posRef.current = next;
    const el = boxRef.current;
    if (el) {
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transform = "none";
    }
    setOverZone(zoneOf(next.x, next.y, w, h));
  }

  function onUp(e: PE<HTMLElement>) {
    const moved = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!moved) return;
    setPos({ ...posRef.current });
    e.currentTarget.style.transition = "";
    const zone = overZone ?? zoneOf(posRef.current.x, posRef.current.y, sizeRef.current.w, sizeRef.current.h);
    if (phaseRef.current === "wide" && zone === "bottom") {
      setOverZone(null);
      setPhase("dock");
    } else if (phaseRef.current === "wide" && (zone === "left" || zone === "right")) {
      setSide(zone);
      setOverZone(null);
      setPhase("split");
    } else {
      setOverZone(null);
    }
  }

  function onSplitDown(e: PE<HTMLElement>) {
    e.stopPropagation();
    e.preventDefault();
    splitDrag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onSplitMove(e: PE<HTMLElement>) {
    if (!splitDrag.current) return;
    e.stopPropagation();
    if (sideRef.current === "right") writeSplit(window.innerWidth - e.clientX);
    else writeSplit(e.clientX);
  }

  function onSplitUp(e: PE<HTMLElement>) {
    splitDrag.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  async function toggleFull() {
    const node = fillRef.current;
    if (!node) {
      setBig((v) => !v);
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFull(false);
      } else {
        await node.requestFullscreen();
        setFull(true);
      }
    } catch {
      setBig((v) => !v);
    }
  }

  const src = mediaSrc(media);
  const ease = "640ms cubic-bezier(0.22, 1, 0.36, 1)";
  const splitW = `${splitPx}px`;
  const box: CSSProperties =
    phase === "dot" || phase === "out"
      ? { width: 18, height: 18, borderRadius: 999, left: origin.x - 9, top: origin.y - 9, opacity: phase === "out" ? 0 : 0.7 }
      : phase === "blob"
        ? { width: 52, height: 52, borderRadius: 999, left: origin.x - 26, top: origin.y - 26, opacity: 1 }
        : phase === "dock"
          ? {
              width: "min(100%, 420px)",
              height: 88,
              borderRadius: 18,
              left: "50%",
              top: "auto",
              right: "auto",
              bottom: 8,
              transform: "translateX(-50%)",
              opacity: 1,
            }
          : phase === "split"
            ? {
                width: splitW,
                height: "100dvh",
                borderRadius: 0,
                top: 0,
                bottom: 0,
                left: side === "left" ? 0 : "auto",
                right: side === "right" ? 0 : "auto",
                transform: "none",
                opacity: 1,
                display: "flex",
                flexDirection: "column",
              }
            : { width: size.w, height: size.h, borderRadius: 26, left: pos.x, top: pos.y, right: "auto", bottom: "auto", opacity: 1 };

  const live = phase === "wide" || phase === "dock" || phase === "split";
  const frameH = phase === "split" ? "calc(100% - 36px)" : phase === "dock" ? 160 : 160;

  return (
    <>
      {live ? <button type="button" className="dyn-scrim" aria-label="Cerrar música" onClick={dismiss} /> : null}
      {phase === "dot" || phase === "blob" ? (
        <span className="dyn-trail" style={{ left: origin.x, top: origin.y }} aria-hidden />
      ) : null}
      {overZone && phase === "wide" ? (
        <div className={`dyn-drop is-${overZone}`} aria-hidden>
          <b />
          <span>{overZone === "bottom" ? "Soltar para fijar" : "Soltar para partir"}</span>
        </div>
      ) : null}
      <aside
        ref={boxRef}
        style={{
          position: "fixed",
          zIndex: 4000,
          overflow: "hidden",
          background: "#050505",
          color: "#fff",
          border: "1px solid #2a2a2a",
          boxShadow: "0 16px 40px #000a",
          boxSizing: "border-box",
          cursor: "grab",
          touchAction: "none",
          transition: drag.current || splitDrag.current
            ? "none"
            : `width ${ease}, height ${ease}, border-radius ${ease}, left ${ease}, right ${ease}, top ${ease}, bottom ${ease}, opacity 480ms ease, transform ${ease}`,
          ...box,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {phase === "split" ? (
          <div
            className={`dyn-split-bar is-${side}${splitDrag.current ? " is-on" : ""}`}
            onPointerDown={onSplitDown}
            onPointerMove={onSplitMove}
            onPointerUp={onSplitUp}
            onPointerCancel={onSplitUp}
            aria-label="Mover división"
            role="separator"
            aria-orientation="vertical"
          />
        ) : null}
        {(phase === "wide" || phase === "split") && mode ? (
          <div className="dyn-head">
            <Music className="size-3.5" />
            <p>{media.title}</p>
            <button type="button" onClick={() => setBack((v) => !v)} aria-label="Pegar enlace">
              <MoreHorizontal className="size-3.5" />
            </button>
            <span />
            <button type="button" onClick={dismiss} aria-label="Cerrar">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {back && mode ? (
          <form
            className="dyn-paste"
            onSubmit={(e) => {
              e.preventDefault();
              const raw = draft.trim();
              if (!raw) return;
              const next = parseMedia(raw);
              if (!next) return;
              saveMedia(next);
              setDraft("");
              setBack(false);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Pega el enlace de Spotify"
              autoFocus
            />
            <button type="submit">OK</button>
          </form>
        ) : null}

        {mode && src ? (
          <div ref={fillRef} className="dyn-fill">
            <iframe
              key={`${media.kind}-${media.ref}`}
              title="media"
              src={src}
              onLoad={(e) => {
                const w = (e.currentTarget as HTMLIFrameElement).contentWindow;
                w?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
              }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="eager"
              style={{
                display: phase === "dot" || phase === "out" ? "none" : "block",
                ...(phase === "split"
                  ? {}
                  : {
                      position: "relative",
                      inset: "auto",
                      width: "100%",
                      height: frameH,
                      transform: "none",
                      minWidth: 0,
                      aspectRatio: "auto",
                    }),
                opacity: phase === "blob" ? 0 : 1,
                pointerEvents: live ? "auto" : "none",
              }}
            />
          </div>
        ) : null}

        {live && (phase === "dock" || phase === "split") ? (
          <button type="button" className="dyn-x" onClick={dismiss} aria-label="Cerrar">
            <X className="size-3.5" />
          </button>
        ) : null}
      </aside>
    </>
  );
}
