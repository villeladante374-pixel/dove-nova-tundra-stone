import { Cloud, Download, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/library-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onDrop: (id: string) => void;
};

export function CloudVaultDialog({ open, onOpenChange, onRestore, onDrop }: Props) {
  const cloudList = useLibrary((s) => s.cloudList);
  const books = useLibrary((s) => s.books);
  const shelfIds = new Set(books.map((b) => b.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Nube</DialogTitle>
        <DialogDescription>
          Tomos guardados para siempre. Recupéralos en esta estantería cuando quieras.
        </DialogDescription>
        <div className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {cloudList.length === 0 ? (
            <p className="py-8 text-center font-body text-base text-muted">
              Aún no hay nada en la nube. En cada tomo, pulsa la nube.
            </p>
          ) : (
            cloudList.map((book) => {
              const onShelf = shelfIds.has(book.id);
              return (
                <div
                  key={book.id}
                  className="flex items-center gap-3 rounded-lg border border-brass/25 bg-ink/40 p-3"
                >
                  <Cloud className="size-4 shrink-0 text-brass" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm text-parchment">{book.title}</p>
                    <p className="truncate font-body text-sm text-muted">{book.author}</p>
                  </div>
                  <Button
                    variant="wood"
                    size="sm"
                    disabled={onShelf}
                    onClick={() => onRestore(book.id)}
                  >
                    <Download className="size-3.5" />
                    {onShelf ? "En estante" : "Recuperar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${book.title} de la nube`}
                    onClick={() => onDrop(book.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
