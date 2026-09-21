import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDownWideNarrow, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/library/brand-mark";
import { CloudActions } from "@/components/library/cloud-actions";
import { SpotifyDock } from "@/components/library/spotify-dock";
import { useLibrary } from "@/lib/library-store";
import { READERS, type ReaderId } from "@/lib/readers";
import { defaultSpot, formatScore, gradeLabel, tally, useMarks } from "@/lib/marks-store";
import { playRailMove } from "@/lib/ui-sfx";
import type { BookRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RatingBoard({ open, onClose }: Props) {
  const books = useLibrary((s) => s.books);
  const hydrate = useMarks((s) => s.hydrate);
  const spots = useMarks((s) => s.spots);
  const setSpots = useMarks((s) => s.setSpots);
  const resetScores = useMarks((s) => s.resetScores);

  useEffect(() => {
    if (open) hydrate();
  }, [open, hydrate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const scores = useMarks((s) => s.scores);
  const ranked = useMemo(() => {
    return [...books].sort((a, b) => {
      const ta = tally(scores[a.id]);
      const tb = tally(scores[b.id]);
      const ca = ta.votes === 5 ? 1 : 0;
      const cb = tb.votes === 5 ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return (tb.percent ?? -1) - (ta.percent ?? -1);
    });
  }, [books, scores]);
  const doneRef = useRef<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const complete = books.filter((b) => tally(scores[b.id]).votes === 5).map((b) => b.id);
    const fresh = complete.filter((id) => !doneRef.current.has(id));
    doneRef.current = new Set(complete);
    if (!fresh.length) return;
    const cols = window.innerWidth < 720 ? 2 : 4;
    const next: Record<string, { x: number; y: number }> = {};
    ranked.forEach((book, i) => {
      next[book.id] = defaultSpot(i, cols);
    });
    setSpots({ ...useMarks.getState().spots, ...next });
    setFlashId(fresh[fresh.length - 1] ?? null);
    playRailMove(1);
    const t = window.setTimeout(() => setFlashId(null), 2400);
    return () => window.clearTimeout(t);
  }, [open, books, scores, ranked, setSpots]);

  function sortByGrade() {
    const next: Record<string, { x: number; y: number }> = {};
    ranked.forEach((book, i) => {
      next[book.id] = defaultSpot(i, window.innerWidth < 720 ? 2 : 4);
    });
    setSpots({ ...spots, ...next });
    playRailMove(1);
  }

  if (!open) return null;

  return (
    <div className="mark-board grain" role="dialog" aria-label="Calificación">
      <header className="mark-board-head">
        <div className="mark-brand">
          <button type="button" className="mark-home" onClick={onClose} aria-label="Volver a la biblioteca">
            <BrandBadge size="md" />
          </button>
          <h2 className="mark-title">Calificación</h2>
        </div>
        <div className="hall-head-music">
          <SpotifyDock />
        </div>
        <div className="mark-board-actions">
          <Button variant="wood" className="has-tip" data-tip="Ordenar por nota" onClick={sortByGrade} disabled={books.length === 0}>
            <ArrowDownWideNarrow className="size-4" />
            <span>Ordenar por nota</span>
          </Button>
          <Button
            variant="wood"
            className="has-tip"
            data-tip="Restablecer notas"
            onClick={() => {
              resetScores();
              doneRef.current = new Set();
              setFlashId(null);
              playRailMove(-1);
            }}
          >
            <RotateCcw className="size-4" />
            <span>Restablecer notas</span>
          </Button>
          <CloudActions />
          <Button variant="ghost" className="has-tip" data-tip="Cerrar" onClick={onClose}>
            <X className="size-4" />
            <span>Cerrar</span>
          </Button>
        </div>
        <p className="mark-lead">
          Arrastra los tomos. Cada lector pone de 0 a 10; la nota final es la media de quien ya votó.
        </p>
      </header>

      {books.length === 0 ? (
        <p className="mark-empty">Aún no hay tomos que calificar. Añade uno en la sala.</p>
      ) : (
        <div className="mark-stage">
          <div
            className="mark-stage-inner"
            style={{
              minHeight: `${Math.max(
                100,
                books.reduce((m, b, i) => Math.max(m, (spots[b.id] ?? defaultSpot(i, 4)).y), 0) + 52,
              )}%`,
            }}
          >
          {books.map((book, i) => (
            <MarkCard
              key={book.id}
              book={book}
              index={i}
              rank={ranked.findIndex((b) => b.id === book.id) + 1}
              spot={spots[book.id] ?? defaultSpot(i, 4)}
              flash={flashId === book.id}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MarkCard({
  book,
  index,
  rank,
  spot,
  flash,
}: {
  book: BookRecord;
  index: number;
  rank: number;
  spot: { x: number; y: number };
  flash: boolean;
}) {
  const cover = useLibrary((s) => s.getCoverSrc(book));
  const scores = useMarks((s) => s.scores[book.id]);
  const setScore = useMarks((s) => s.setScore);
  const setSpot = useMarks((s) => s.setSpot);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const stats = tally(scores);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-mark-control]")) return;
    if (window.matchMedia("(max-width: 720px)").matches) return;
    const stage = e.currentTarget.offsetParent as HTMLElement | null;
    if (!stage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: spot.x, y: spot.y, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    const el = cardRef.current;
    const stage = el?.offsetParent as HTMLElement | null;
    if (!d || !el || !stage) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    setDragging(true);
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    const el = cardRef.current;
    const stage = el?.offsetParent as HTMLElement | null;
    drag.current = null;
    setDragging(false);
    if (!d || !el || !stage) return;
    el.style.transform = "";
    if (!d.moved) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - d.px) / rect.width) * 100;
    const dy = ((e.clientY - d.py) / rect.height) * 100;
    setSpot(book.id, { x: d.x + dx, y: d.y + dy });
    playRailMove(1);
  }

  return (
    <article
      ref={cardRef}
      className={cn("mark-card", dragging && "is-drag", stats.avg != null && "has-mark", flash && "is-rank")}
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        ["--i" as string]: String(index),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {stats.votes === 5 ? (
        <span className={`mark-seal is-${rank <= 3 ? rank : "more"}`}>{rank}</span>
      ) : null}
      <div className="mark-cover">
        <img src={cover} alt="" />
      </div>
      <h3 className="mark-card-title">{book.title}</h3>
      <BoomPercent percent={stats.percent} avg={stats.avg} votes={stats.votes} />
      <ul className="mark-list">
        {READERS.map((reader) => (
          <li key={reader.id}>
            <ScoreRow
              readerId={reader.id}
              name={reader.name}
              initial={reader.initial}
              value={scores?.[reader.id]}
              onChange={(n) => {
                setScore(book.id, reader.id, n);
                playRailMove(1);
              }}
            />
          </li>
        ))}
      </ul>
    </article>
  );
}



function ScoreRow({
  readerId,
  name,
  initial,
  value,
  onChange,
}: {
  readerId: ReaderId;
  name: string;
  initial: string;
  value: number | undefined;
  onChange: (n: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : formatScore(value));

  useEffect(() => {
    setText(value == null ? "" : formatScore(value));
  }, [value]);

  function commit() {
    const raw = text.trim().replace(",", ".");
    if (!raw) {
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(value == null ? "" : formatScore(value));
      return;
    }
    onChange(n);
  }

  return (
    <div className={cn("mark-row", value != null && "is-on")} data-mark-control>
      <span className={cn("mark-dot", `tone-${readerId}`)}>{initial}</span>
      <span className="mark-row-name">{name}</span>
      <input
        inputMode="decimal"
        maxLength={4}
        value={text}
        placeholder="—"
        aria-label={`Nota de ${name}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
      />
      <em>{value == null ? "" : `${Math.round(value * 10)}%`}</em>
    </div>
  );
}

function BoomPercent({
  percent,
  avg,
  votes,
}: {
  percent: number | null;
  avg: number | null;
  votes: number;
}) {
  const [shown, setShown] = useState(percent ?? 0);
  const [burst, setBurst] = useState(0);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (percent == null) {
      setShown(0);
      prev.current = null;
      return;
    }
    const target = percent;
    if (prev.current !== target) {
      setBurst((n) => n + 1);
      prev.current = target;
    }
    const from = shown;
    const t0 = performance.now();
    let raf = 0;
    function tick(now: number) {
      const p = Math.min(1, (now - t0) / 720);
      const eased = 1 - (1 - p) ** 3;
      setShown(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div
      key={burst}
      className={cn("mark-boom", percent != null && "has-value", votes === 5 && "is-full")}
    >
      <p className="mark-boom-num">{percent == null ? "—" : `${Math.round(shown)}%`}</p>
      <p className="mark-boom-avg">{avg == null ? "Sin nota" : `${avg.toFixed(1)} / 10`}</p>
      <p className="mark-boom-sub">
        {gradeLabel(avg)}
        {votes ? ` · ${votes} de 5` : ""}
      </p>
    </div>
  );
}
