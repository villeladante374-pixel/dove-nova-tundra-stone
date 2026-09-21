import { useEffect, useState, type FormEvent } from "react";
import { ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilePick } from "@/components/library/file-pick";
import { useLibrary } from "@/lib/library-store";
import { isVideoFile } from "@/lib/utils";

const MAX_IMG = 12 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;

type Props = {
  bookId: string | null;
  onClose: () => void;
};

export function EditTomeDialog({ bookId, onClose }: Props) {
  const book = useLibrary((s) => s.books.find((b) => b.id === bookId));
  const updateBook = useLibrary((s) => s.updateBook);
  const coverSrc = useLibrary((s) => (book ? s.getCoverSrc(book) : ""));
  const hoverSrc = useLibrary((s) => (book ? s.getHoverSrc(book) : null));
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [hover, setHover] = useState<File | null>(null);
  const [clearCover, setClearCover] = useState(false);
  const [clearHover, setClearHover] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;
    const current = useLibrary.getState().books.find((b) => b.id === bookId);
    if (!current) return;
    setTitle(current.title);
    setAuthor(current.author);
    setCover(null);
    setHover(null);
    setClearCover(false);
    setClearHover(false);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBusy(false);
    setError(null);
  }, [bookId]);

  function onCover(file: File) {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) {
      setError("La portada debe ser una imagen.");
      return;
    }
    if (file.size > MAX_IMG) {
      setError("La portada pesa demasiado (máximo 12 MB).");
      return;
    }
    setError(null);
    setClearCover(false);
    setCover(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function onHover(file: File) {
    if (!isVideoFile(file)) {
      setError("El recorte debe ser un vídeo (mp4, webm o mov).");
      return;
    }
    if (file.size > MAX_VIDEO) {
      setError("El vídeo pesa demasiado (máximo 200 MB).");
      return;
    }
    setError(null);
    setClearHover(false);
    setHover(file);
    setHoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!book) return;
    setBusy(true);
    setError(null);
    try {
      await updateBook({
        id: book.id,
        title,
        author,
        cover,
        clearCover,
        hover,
        clearHover,
      });
      toast(`«${title.trim() || book.title}» se actualizó.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  const shownHover = hoverPreview || (!clearHover ? hoverSrc : null);

  return (
    <Dialog open={Boolean(bookId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>Editar tomo</DialogTitle>
        <DialogDescription>Cambia el nombre, la pasta o el vídeo al pasar el ratón.</DialogDescription>
        <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-author">Autor</Label>
            <Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <FilePick
            key={`${bookId}-cover`}
            icon={<ImageIcon className="size-4" />}
            label="Portada"
            hint={cover ? cover.name : "Nueva foto, o deja la actual"}
            accept="image/*"
            onFile={onCover}
          />
          {preview || coverSrc ? (
            <img
              src={preview || coverSrc}
              alt=""
              className="mx-auto h-44 w-32 rounded-sm object-cover ring-1 ring-brass/40"
            />
          ) : null}
          {book?.hasCover ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setClearCover(true);
                setCover(null);
                setPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              }}
            >
              Quitar foto de portada
            </Button>
          ) : null}
          <FilePick
            key={`${bookId}-video`}
            icon={<Video className="size-4" />}
            label="Vídeo al pasar el ratón"
            hint={hover ? hover.name : "MP4, WebM o MOV — elige el archivo y espera a ver el nombre"}
            onFile={onHover}
          />
          {shownHover ? (
            <video
              src={shownHover}
              className="mx-auto h-36 w-auto rounded-sm ring-1 ring-brass/40"
              muted
              loop
              playsInline
              autoPlay
              controls
            />
          ) : null}
          {hover ? (
            <p className="text-center text-sm text-brass">Se guardará «{hover.name}» al pulsar Guardar cambios.</p>
          ) : null}
          {book?.hasHoverVideo && !clearHover ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setClearHover(true);
                setHover(null);
                setHoverPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              }}
            >
              Quitar vídeo
            </Button>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
