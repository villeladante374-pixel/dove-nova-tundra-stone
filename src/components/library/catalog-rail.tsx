import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ShelfBook } from "@/components/library/shelf-book";
import { playRailMove } from "@/lib/ui-sfx";
import type { BookRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  books: BookRecord[];
  locked?: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onCloud: (id: string) => void;
  onRemove: (id: string) => void;
  onFocusBook: (book: BookRecord | null) => void;
  onInspect: (id: string) => void;
  onFav?: (id: string) => void;
  isFavorite?: (id: string) => boolean;
};

function pagesLabel(n: number) {
  return n === 1 ? "1 página" : `${n} páginas`;
}

export function CatalogRail({
  books,
  locked = false,
  onAdd,
  onEdit,
  onCloud,
  onRemove,
  onFocusBook,
  onInspect,
  onFav,
  isFavorite,
}: Props) {
  const count = books.length + 1;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const sawBooks = useRef(false);
  indexRef.current = index;

  const addOn = index === 0;
  const focusedBook = index > 0 ? (books[index - 1] ?? null) : null;

  useEffect(() => {
    onFocusBook(focusedBook);
  }, [focusedBook, onFocusBook]);

  useEffect(() => {
    setIndex((i) => {
      const max = books.length;
      if (!sawBooks.current && books.length > 0) {
        sawBooks.current = true;
        return 1;
      }
      if (books.length > 0) sawBooks.current = true;
      return Math.min(Math.max(0, i), max);
    });
  }, [books.length]);

  const moveTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      if (clamped === indexRef.current) return;
      const dir: 1 | -1 = clamped > indexRef.current ? 1 : -1;
      playRailMove(dir);
      setIndex(clamped);
    },
    [count],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (locked) return;
      const el = e.target;
      if (el instanceof HTMLElement) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
          return;
        }
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(indexRef.current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveTo(indexRef.current - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (indexRef.current === 0) onAdd();
        else {
          const book = books[indexRef.current - 1];
          if (book) onInspect(book.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, moveTo, onAdd, onInspect, books]);

  return (
    <section className="catalog" aria-label="Tu biblioteca">
      <div className="catalog-rail" style={{ ["--rail-index" as string]: String(index) }} tabIndex={0}>
        <div className="catalog-track">
          <button
            type="button"
            data-rail-control
            className={cn("poster-add", addOn && "is-on")}
            onClick={onAdd}
          >
            <Plus className="size-8" />
            <span className="mt-2 px-2 text-center font-display text-xs tracking-wide">Nuevo tomo</span>
          </button>
          {books.map((book, i) => (
            <ShelfBook
              key={book.id}
              book={book}
              selected={i + 1 === index}
              onEdit={onEdit}
              onCloud={onCloud}
              onRemove={onRemove}
              onInspect={onInspect}
              onFav={onFav}
              favorite={isFavorite?.(book.id)}
            />
          ))}
        </div>
        <button
          type="button"
          data-rail-control
          className="catalog-skip is-prev"
          aria-label="Tomo anterior"
          disabled={index <= 0}
          onClick={() => moveTo(index - 1)}
        >
          <ChevronLeft className="size-7" />
        </button>
        <button
          type="button"
          data-rail-control
          className="catalog-skip is-next"
          aria-label="Tomo siguiente"
          disabled={index >= count - 1}
          onClick={() => moveTo(index + 1)}
        >
          <ChevronRight className="size-7" />
        </button>
      </div>
      <div className="catalog-caption" aria-live="polite">
        {focusedBook ? (
          <div key={focusedBook.id} className="catalog-caption-inner">
            <h3>{focusedBook.title}</h3>
            <p>
              {focusedBook.author} · {pagesLabel(focusedBook.pageCount)}
              <span className="caption-extra">
                {focusedBook.hasHoverVideo ? " · Pasa el ratón para ver el recorte" : ""}
              </span>
            </p>
          </div>
        ) : (
          <div key="add" className="catalog-caption-inner">
            <h3>Añadir un tomo</h3>
            <p>PDF, portada y recorte al pasar el ratón.</p>
          </div>
        )}
      </div>
    </section>
  );
}
