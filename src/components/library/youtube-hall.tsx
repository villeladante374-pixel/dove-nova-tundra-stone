import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { searchYoutube, type YtHit } from "@/lib/youtube-search";
import { playOpenSfx, playRailMove } from "@/lib/ui-sfx";
import { cn } from "@/lib/utils";

const SEED: YtHit[] = [
  { id: "jNQXAC9IVRw", title: "Me at the zoo", channel: "jawed", thumb: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg" },
];
const RECENTS_KEY = "el-tomo-yt-recents";

type Props = {
  onPlay: (hit: YtHit) => void;
  query: string;
};

function loadRecents(): YtHit[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as YtHit[]) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x?.id).slice(0, 18) : [];
  } catch {
    return [];
  }
}

function saveRecent(hit: YtHit) {
  const next = [hit, ...loadRecents().filter((x) => x.id !== hit.id)].slice(0, 18);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function YoutubeHall({ onPlay, query }: Props) {
  const [hits, setHits] = useState<YtHit[]>(() => loadRecents());
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;
  const q = query.trim();

  useEffect(() => {
    let dead = false;
    const term = q || "libros recomendados";
    const timer = window.setTimeout(() => {
      setBusy(true);
      void searchYoutube({ data: { q: term } })
        .then((found) => {
          if (dead) return;
          const recents = loadRecents();
          const merged = q ? found : [...recents, ...found.filter((f) => !recents.some((r) => r.id === f.id))];
          setHits(merged.length ? merged : SEED);
          setIndex(0);
        })
        .catch(() => {
          if (!dead) setHits((prev) => (prev.length ? prev : loadRecents()));
        })
        .finally(() => {
          if (!dead) setBusy(false);
        });
    }, q ? 380 : 40);
    return () => {
      dead = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  const count = Math.max(1, hits.length);
  const focused = hits[index] ?? null;

  function moveTo(next: number) {
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped === indexRef.current) return;
    playRailMove(clamped > indexRef.current ? 1 : -1);
    setIndex(clamped);
  }

  function play(hit: YtHit) {
    saveRecent(hit);
    playOpenSfx();
    onPlay(hit);
  }

  return (
    <section className="catalog" aria-label="YouTube">
      <div className="catalog-rail" style={{ ["--rail-index" as string]: String(index) }} tabIndex={0}>
        <div className="catalog-track">
          {hits.map((hit, i) => (
            <article
              key={hit.id}
              className={cn("poster-card yt-card group relative shrink-0", i === index && "is-on")}
            >
              <button
                type="button"
                className="poster block focus-visible:outline-none"
                aria-label={`Ver ${hit.title}`}
                onClick={() => play(hit)}
                onPointerEnter={() => {
                  if (i !== indexRef.current) moveTo(i);
                }}
              >
                <img src={hit.thumb} alt="" className="poster-art" />
                <span className="yt-play">
                  <Play className="size-8 fill-current" />
                </span>
              </button>
            </article>
          ))}
        </div>
        <button type="button" className="catalog-skip is-prev" aria-label="Anterior" disabled={index <= 0} onClick={() => moveTo(index - 1)}>
          <ChevronLeft className="size-7" />
        </button>
        <button
          type="button"
          className="catalog-skip is-next"
          aria-label="Siguiente"
          disabled={index >= count - 1}
          onClick={() => moveTo(index + 1)}
        >
          <ChevronRight className="size-7" />
        </button>
      </div>
      <div className="catalog-caption" aria-live="polite">
        {focused ? (
          <div key={focused.id} className="catalog-caption-inner">
            <h3>{focused.title}</h3>
            <p>{focused.channel} · YouTube{busy ? " · buscando…" : ""}</p>
          </div>
        ) : (
          <div className="catalog-caption-inner">
            <h3>YouTube</h3>
            <p>Busca un vídeo o pega el enlace.</p>
          </div>
        )}
      </div>
    </section>
  );
}
