import { useCallback, useEffect, useState } from "react";
import { Award, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { AddTomeDialog } from "@/components/library/add-tome-dialog";
import { CatalogRail } from "@/components/library/catalog-rail";
import { EditTomeDialog } from "@/components/library/edit-tome-dialog";
import { BrandBadge } from "@/components/library/brand-mark";
import { CoverWash } from "@/components/library/hall-backdrop";
import { CloudActions } from "@/components/library/cloud-actions";
import { BookInspect } from "@/components/library/book-inspect";
import { RatingBoard } from "@/components/library/rating-board";
import { SpotifyDock } from "@/components/library/spotify-dock";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/library-store";
import { useMarks } from "@/lib/marks-store";
import { initialOf, portraitOf, useProfiles } from "@/lib/profiles-store";
import { useReader } from "@/lib/reader-store";
import { useReading } from "@/lib/reading-store";
import { useUiPrefs } from "@/lib/ui-prefs";
import { readerById } from "@/lib/readers";
import type { BookRecord } from "@/lib/types";
import { playOpenSfx, unlockUiSfx } from "@/lib/ui-sfx";
import { loadPdfDocument, warmPdfEngine } from "@/lib/pdf-engine";
import { stopNarration } from "@/lib/reader-audio";

export function LibraryHall() {
  const books = useLibrary((s) => s.books);
  const getCoverSrc = useLibrary((s) => s.getCoverSrc);
  const getPdfBuffer = useLibrary((s) => s.getPdfBuffer);
  const hydrated = useLibrary((s) => s.hydrated);
  const hydrate = useLibrary((s) => s.hydrate);
  const removeBook = useLibrary((s) => s.removeBook);
  const logo = useUiPrefs((s) => s.logo);
  const lead = useUiPrefs((s) => s.lead);
  const pushToCloud = useLibrary((s) => s.pushToCloud);
  const readerId = useReader((s) => s.readerId);
  const clearReader = useReader((s) => s.clear);
  const reader = readerById(readerId);
  const profile = useProfiles((s) => (readerId ? s.byId[readerId] : null));
  const helloName = profile?.name ?? reader?.name;
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<BookRecord | null>(null);
  const [focusBook, setFocusBook] = useState<BookRecord | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const toggleFavorite = useReading((s) => s.toggleFavorite);
  const favorites = useReading((s) => s.favorites);
  const hydrateReading = useReading((s) => s.hydrate);
  const washSrc = focusBook ? getCoverSrc(focusBook) : null;
  const inspectBook = inspectId ? books.find((b) => b.id === inspectId) ?? null : null;
  const q = query.trim().toLowerCase();
  const visible = books.filter((b) => {
    if (onlyFavs && !favorites.includes(b.id)) return false;
    if (!q) return true;
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  });
  const locked = addOpen || Boolean(editId) || Boolean(pendingRemove) || boardOpen || Boolean(inspectId);

  const onFocusBook = useCallback((book: BookRecord | null) => {
    setFocusBook(book);
  }, []);

  useEffect(() => {
    stopNarration();
    if (!useLibrary.getState().hydrated) void hydrate();
    hydrateReading();
  }, [hydrate, hydrateReading]);

  useEffect(() => {
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback.bind(window) : (fn: () => void) => window.setTimeout(fn, 900);
    const id = idle(() => warmPdfEngine());
    return () => {
      window.clearTimeout(id);
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(id);
    };
  }, []);

  useEffect(() => {
    if (!focusBook || focusBook.kind === "manuscript") return;
    const id = focusBook.id;
    let dead = false;
    void getPdfBuffer(id)
      .then((buf) => (dead ? undefined : loadPdfDocument(id, buf)))
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [focusBook, getPdfBuffer]);

  useEffect(() => {
    function unlock() {
      unlockUiSfx();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function cloudSave(id: string) {
    try {
      await pushToCloud(id);
      toast("NUBE");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }




  return (
    <div
      className="hall-shell is-bare grain relative"
      style={{ ["--lead" as string]: String(lead), ["--logo" as string]: String(logo) }}
    >
      <CoverWash src={inspectId ? null : washSrc} />
      <header className={boardOpen || inspectId ? "hall-head is-away" : "hall-head"}>
        <div className="hall-head-left">
          <button
            type="button"
            className="hall-home"
            onClick={() => {
              playOpenSfx();
              if (inspectId) {
                setInspectId(null);
                return;
              }
              if (boardOpen) {
                setBoardOpen(false);
              }
            }}
            aria-label="Volver a la biblioteca"
          >
            <BrandBadge size="md" />
          </button>
          <div className="hall-head-copy">
            <p className="catalog-kicker">Tu biblioteca</p>
            <p className="catalog-hello">{helloName ? `Hola, ${helloName}.` : "Hola."}</p>
          </div>
        </div>
        <div className="hall-head-music">
          <SpotifyDock />
        </div>
        <div className="hall-head-actions">
          {searchOpen ? (
            <input
              className="hall-search is-open"
              placeholder="Buscar por nombre…"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => {
                if (!query.trim()) setSearchOpen(false);
              }}
            />
          ) : (
            <Button
              variant="wood"
              size="icon"
              className="search-fab has-tip"
              data-tip="Buscar"
              aria-label="Buscar"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" />
            </Button>
          )}
          <Button
            variant={onlyFavs ? "brass" : "wood"}
            size="icon"
            className="has-tip"
            data-tip="Favoritos"
            aria-label="Favoritos"
            onClick={() => setOnlyFavs((v) => !v)}
          >
            <Star className={onlyFavs ? "size-5 fill-current" : "size-5"} />
          </Button>
          <Button size="icon" className="has-tip" data-tip="Añadir tomo" aria-label="Añadir tomo" onClick={() => setAddOpen(true)}>
            <Plus className="size-5" />
          </Button>
          <CloudActions />
          <Button
            variant="wood"
            size="icon"
            className="has-tip"
            data-tip="Calificación"
            aria-label="Calificación"
            onClick={() => {
              playOpenSfx();
              setBoardOpen(true);
            }}
          >
            <Award className="size-5" />
          </Button>
          {reader ? (
            <button
              type="button"
              className="avatar-orbit is-tiny has-tip"
              data-tip="Cambiar de perfil"
              onClick={() => {
                playOpenSfx();
                clearReader();
              }}
              aria-label={`Cambiar de lector, ahora ${helloName ?? reader.name}`}
            >
              <span className={`reader-avatar is-tiny tone-${reader.id}`}>
                {portraitOf(reader.id, profile) ? (
                  <img src={portraitOf(reader.id, profile)} alt="" className="reader-photo" />
                ) : (
                  <span className="reader-initial">{initialOf(helloName ?? reader.name, reader.initial)}</span>
                )}
              </span>
            </button>
          ) : null}
        </div>
      </header>

      <main className={`hall-stage relative z-10 ${inspectId ? "is-hidden" : ""}`}>
        <CatalogRail
            books={visible}
            locked={locked}
            onAdd={() => setAddOpen(true)}
            onEdit={setEditId}
            onCloud={(id) => void cloudSave(id)}
            onRemove={(id) => {
              const found = books.find((b) => b.id === id);
              if (found) setPendingRemove(found);
            }}
            onFocusBook={onFocusBook}
            onInspect={(id) => {
              playOpenSfx();
              setInspectId(id);
            }}
            onFav={toggleFavorite}
            isFavorite={(id) => favorites.includes(id)}
          />
        {hydrated && visible.length === 0 ? (
          <p className="catalog-empty">
            {onlyFavs ? "Aún no hay favoritos. Márcalos con la estrella." : q ? "Ningún tomo coincide." : "Aún no hay nada. Sube un PDF, ponle portada y, si quieres, un vídeo que se vea al pasar el ratón."}
          </p>
        ) : null}
      </main>

      {inspectBook ? (
        <BookInspect
          book={inspectBook}
          onClose={() => {
            playOpenSfx();
            setInspectId(null);
          }}
        />
      ) : null}
      <RatingBoard
        open={boardOpen}
        onClose={() => {
          playOpenSfx();
          setBoardOpen(false);
        }}
      />
      <AddTomeDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditTomeDialog bookId={editId} onClose={() => setEditId(null)} />

      {pendingRemove ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-brass/30 bg-walnut p-6">
            <h2 className="font-display text-lg text-parchment">Borrar para siempre</h2>
            <p className="mt-2 font-body text-base text-muted">
              «{pendingRemove.title}» se borra para siempre. No volverá al pulsar Recuperar.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingRemove(null)}>
                Conservar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  useMarks.getState().forgetBook(pendingRemove.id);
                  void removeBook(pendingRemove.id);
                  setPendingRemove(null);
                }}
              >
                Borrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
