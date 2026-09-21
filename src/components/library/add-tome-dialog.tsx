import { useState, type FormEvent, type ReactNode } from "react";
import { ImageIcon, ScrollText, Video } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilePick } from "@/components/library/file-pick";
import { useLibrary } from "@/lib/library-store";
import { fileNameToTitle, isVideoFile } from "@/lib/utils";

const MAX_PDF = 80 * 1024 * 1024;
const MAX_IMG = 12 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;

type Props = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AddTomeDialog({ trigger, open, onOpenChange }: Props) {
  const addPdfBook = useLibrary((s) => s.addPdfBook);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [hover, setHover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setAuthor("");
    setPdf(null);
    setCover(null);
    setHover(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    if (hoverPreview) URL.revokeObjectURL(hoverPreview);
    setCoverPreview(null);
    setHoverPreview(null);
    setBusy(false);
    setError(null);
  }

  function onPdf(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("El manuscrito debe ser un PDF.");
      return;
    }
    if (file.size > MAX_PDF) {
      setError("Ese tomo pesa demasiado (máximo 80 MB).");
      return;
    }
    setError(null);
    setPdf(file);
    if (!title) setTitle(fileNameToTitle(file.name));
  }

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
    setCover(file);
    setCoverPreview((prev) => {
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
    setHover(file);
    setHoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pdf) {
      setError("Sube un PDF para inscribir el tomo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const book = await addPdfBook({ file: pdf, cover, hover, title, author });
      toast(`«${book.title}» quedó inscrito en el archivo.`);
      reset();
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "El copista no pudo leer ese manuscrito.";
      setError(message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogTitle>Inscribir un tomo</DialogTitle>
        <DialogDescription>
          Sube tu PDF y, si quieres, una fotografía para la pasta y un vídeo corto al pasar el
          ratón.
        </DialogDescription>
        <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
          <FilePick
            icon={<ScrollText className="size-4" />}
            label="Manuscrito (PDF)"
            hint={pdf ? pdf.name : "Elige el archivo aquí abajo"}
            accept="application/pdf,.pdf"
            onFile={onPdf}
          />
          <FilePick
            icon={<ImageIcon className="size-4" />}
            label="Portada (tu foto)"
            hint={cover ? cover.name : "Opcional — si no, se usa cuero estampado"}
            accept="image/*"
            onFile={onCover}
          />
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Vista de la portada"
              className="mx-auto h-40 w-28 rounded-sm object-cover ring-1 ring-brass/40"
            />
          ) : null}
          <FilePick
            icon={<Video className="size-4" />}
            label="Vídeo al pasar el ratón"
            hint={hover ? hover.name : "MP4, WebM o MOV — elige el archivo y espera a ver el nombre"}
            onFile={onHover}
          />
          {hoverPreview ? (
            <video
              src={hoverPreview}
              className="mx-auto h-36 w-auto rounded-sm ring-1 ring-brass/40"
              muted
              loop
              playsInline
              autoPlay
              controls
            />
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="tome-title">Título</Label>
            <Input
              id="tome-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="El nombre del tomo"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tome-author">Autor o copista</Label>
            <Input
              id="tome-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Quién lo escribió"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? "El copista ilumina el manuscrito…" : "Colocar en la estantería"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
