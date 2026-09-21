import { useEffect, useRef, type ReactNode } from "react";
import { Cloud, CloudOff, Pencil, Star, Trash2 } from "lucide-react";
import type { BookRecord } from "@/lib/types";
import { useLibrary } from "@/lib/library-store";
import { cn } from "@/lib/utils";

type Props = {
  book: BookRecord;
  selected: boolean;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onCloud: (id: string) => void;
  onInspect: (id: string) => void;
  onFav?: (id: string) => void;
  favorite?: boolean;
};

export function ShelfBook({ book, selected, onRemove, onEdit, onCloud, onInspect, onFav, favorite }: Props) {
  const cover = useLibrary((s) => s.getCoverSrc(book));
  const hoverSrc = useLibrary((s) => s.getHoverSrc(book));
  const videoRef = useRef<HTMLVideoElement>(null);
  const fresh = Date.now() - book.createdAt < 1000 * 60 * 60 * 24;

  function playClip() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore seek until ready */
    }
    const run = el.play();
    if (run) void run.catch(() => undefined);
  }

  function stopClip() {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
  }

  useEffect(() => {
    if (selected && hoverSrc) playClip();
    else stopClip();
  }, [selected, hoverSrc]);

  return (
    <article
      className={cn("poster-card group relative shrink-0", selected && "is-on", hoverSrc && "has-clip")}
      onPointerEnter={() => {
        if (hoverSrc && window.matchMedia("(hover: hover)").matches) playClip();
      }}
      onMouseEnter={() => {
        if (hoverSrc && window.matchMedia("(hover: hover)").matches) playClip();
      }}
      onMouseLeave={() => {
        if (!selected) stopClip();
      }}
    >
      <button
        type="button"
        className="poster block focus-visible:outline-none"
        aria-label={`Ver ${book.title}`}
        aria-current={selected ? "true" : undefined}
        onClick={() => onInspect(book.id)}
      >
        <img
          src={cover}
          alt=""
          className="poster-art"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `/covers/leather-${book.leather}.jpg`;
          }}
        />
        {hoverSrc ? (
          <video
            ref={videoRef}
            className="poster-video"
            src={hoverSrc}
            muted
            loop
            playsInline
            preload={selected ? "auto" : "metadata"}
            onLoadedData={() => {
              if (selected) playClip();
            }}
          />
        ) : null}
        {favorite ? <Star className="fav-dot size-5 fill-current" /> : null}
        {fresh ? <span className="poster-badge">Recién añadido</span> : null}
      </button>
      <div
        className={cn(
          "absolute right-2 top-2 z-20 flex flex-col gap-1",
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <IconBtn label={`Editar ${book.title}`} onClick={() => onEdit(book.id)}>
          <Pencil className="size-4" />
        </IconBtn>
        {onFav ? (
          <IconBtn label={favorite ? "Quitar de favoritos" : "Marcar favorito"} onClick={() => onFav(book.id)}>
            <Star className={cn("size-4", favorite && "fill-current text-brass")} />
          </IconBtn>
        ) : null}
        <IconBtn
          label={
            book.cloudSaved
              ? `Actualizar en la nube ${book.title}`
              : `Guardar en la nube ${book.title}`
          }
          onClick={() => onCloud(book.id)}
        >
          {book.cloudSaved ? <Cloud className="size-4 text-brass" /> : <CloudOff className="size-4" />}
        </IconBtn>
        <IconBtn label={`Borrar ${book.title}`} onClick={() => onRemove(book.id)}>
          <Trash2 className="size-4" />
        </IconBtn>
      </div>
    </article>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-rail-control
      className="inline-flex size-11 items-center justify-center rounded-full border border-brass/30 bg-walnut text-muted hover:text-parchment"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
