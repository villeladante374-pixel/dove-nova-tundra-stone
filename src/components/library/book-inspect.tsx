import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TomeStage } from "@/components/library/tome-stage";
import { useLibrary } from "@/lib/library-store";
import { loadPdfDocument, warmPdfEngine } from "@/lib/pdf-engine";
import { LEATHER_SRC, type BookRecord } from "@/lib/types";
import { playOpenSfx, playRailMove } from "@/lib/ui-sfx";
import { cn } from "@/lib/utils";

type Props = {
  book: BookRecord;
  onClose: () => void;
};

const HOME = { x: -12, y: 28 };

export function BookInspect({ book, onClose }: Props) {
  const cover = useLibrary((s) => s.getCoverSrc(book));
  const getPdfBuffer = useLibrary((s) => s.getPdfBuffer);
  const navigate = useNavigate();
  const drag = useRef<{ lx: number; ly: number; armed: boolean; sx: number; sy: number } | null>(null);
  const [view, setView] = useState(HOME);
  const [spinning, setSpinning] = useState(false);
  const [tray, setTray] = useState(false);
  const rot = useRef(view);
  rot.current = view;

  useEffect(() => {
    warmPdfEngine();
    let dead = false;
    void getPdfBuffer(book.id)
      .then((buf) => (dead ? undefined : loadPdfDocument(book.id, buf)))
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [book.id, getPdfBuffer]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      if (!d.armed) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
        d.armed = true;
        setSpinning(true);
      }
      const dx = e.clientX - d.lx;
      const dy = e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      setView((v) => ({
        x: Math.max(-38, Math.min(38, v.x - dy * 0.16)),
        y: v.y + dx * 0.2,
      }));
    }
    function onUp() {
      drag.current = null;
      setSpinning(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onClose]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = { lx: e.clientX, ly: e.clientY, armed: false, sx: e.clientX, sy: e.clientY };
  }

  const leather = LEATHER_SRC[book.leather];

  return (
    <div className="inspect-shell" role="dialog" aria-label={book.title}>
      <button type="button" className="inspect-close" onClick={onClose} aria-label="Volver a la biblioteca">
        <ArrowLeft className="size-5" />
        <span>Biblioteca</span>
      </button>
      <button
        type="button"
        className={cn("edge-tab", tray && "is-on")}
        aria-label={tray ? "Cerrar acciones" : "Más acciones"}
        onClick={() => setTray((v) => !v)}
      />
      <aside className={cn("edge-tray", tray && "is-on")}>
        <Button variant="wood" size="icon" className="has-tip" data-tip="Volver" aria-label="Volver" onClick={onClose}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="wood"
          size="icon"
          className="has-tip"
          data-tip="Restablecer"
          aria-label="Restablecer"
          onClick={() => {
            drag.current = null;
            setSpinning(false);
            setView(HOME);
            playRailMove(-1);
            setTray(false);
          }}
        >
          <RotateCcw className="size-4" />
        </Button>
      </aside>
      <div className={cn("inspect-stage", spinning && "is-spin")} onPointerDown={onPointerDown}>
        <TomeStage cover={cover} leather={leather} title={book.title} pages={book.pageCount} rot={rot} />
      </div>
      <div className="inspect-copy">
        <p className="inspect-kicker">Pasta dura · Arrastra para girar</p>
        <h2>{book.title}</h2>
        <p>
          {book.author} · {book.pageCount} {book.pageCount === 1 ? "página" : "páginas"}
        </p>
        <div className="inspect-actions">
          <Button variant="wood" className="inspect-desk" onClick={onClose}>
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <Button
            variant="wood"
            className="inspect-desk"
            onClick={() => {
              drag.current = null;
              setSpinning(false);
              setView(HOME);
              playRailMove(-1);
            }}
          >
            <RotateCcw className="size-4" />
            Restablecer
          </Button>
          <Button
            className="inspect-open"
            onClick={() => {
              playOpenSfx();
              playRailMove(1);
              void navigate({ to: "/tomo/$id", params: { id: book.id } });
            }}
          >
            <BookOpen className="size-4" />
            Abrir el tomo
          </Button>
        </div>
      </div>
    </div>
  );
}
