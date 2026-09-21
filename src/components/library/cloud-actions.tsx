import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { ArchiveRestore, Cloud, Download, FolderOpen, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/library-store";
import { useReader } from "@/lib/reader-store";
import { downloadTomoPack } from "@/lib/tomo-pack";

export function CloudActions() {
  const backupAll = useLibrary((s) => s.backupAll);
  const restoreAll = useLibrary((s) => s.restoreAll);
  const restoreFromFile = useLibrary((s) => s.restoreFromFile);
  const exportBackup = useLibrary((s) => s.exportBackup);
  const emptyShelf = useLibrary((s) => s.emptyShelf);
  const books = useLibrary((s) => s.books);
  const readerId = useReader((s) => s.readerId);
  const select = useReader((s) => s.select);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"save" | "restore" | "empty" | null>(null);
  const [ask, setAsk] = useState<null | "save" | "restore">(null);

  function keepSeat() {
    if (readerId) select(readerId);
  }

  async function saveSystem() {
    if (busy) return;
    keepSeat();
    setBusy("save");
    setAsk(null);
    try {
      const result = await backupAll();
      keepSeat();
      if (result.books === 0) toast("Nada que guardar todavía.");
      else toast(`Guardado en el sistema: ${result.books} ${result.books === 1 ? "tomo" : "tomos"} con portadas y animaciones.`);
    } catch (err) {
      keepSeat();
      toast(err instanceof Error ? err.message : "No se pudo guardar en el sistema.");
    } finally {
      keepSeat();
      setBusy(null);
    }
  }

  async function saveDownload() {
    if (busy) return;
    keepSeat();
    setBusy("save");
    setAsk(null);
    try {
      const blob = await exportBackup();
      await downloadTomoPack(blob);
      keepSeat();
      toast("Copia descargada. Trae tomos, portadas y animaciones.");
    } catch (err) {
      keepSeat();
      toast(err instanceof Error ? err.message : "No se pudo descargar la copia.");
    } finally {
      keepSeat();
      setBusy(null);
    }
  }

  async function restoreSystem() {
    if (busy) return;
    keepSeat();
    setBusy("restore");
    setAsk(null);
    try {
      const result = await restoreAll();
      keepSeat();
      if (result.books > 0) toast(`Recuperado del sistema: ${result.books} ${result.books === 1 ? "tomo" : "tomos"}.`);
      else toast("El sistema no tiene tomos. Prueba una copia local.");
    } catch (err) {
      keepSeat();
      toast(err instanceof Error ? err.message : "No se pudo recuperar del sistema.");
    } finally {
      keepSeat();
      setBusy(null);
    }
  }

  function restoreLocal() {
    setAsk(null);
    pickerRef.current?.click();
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    keepSeat();
    setBusy("restore");
    try {
      const result = await restoreFromFile(file);
      keepSeat();
      if (result.books === 0) toast("Ese archivo no trae tomos.");
      else toast(`Recuperado local: ${result.books} ${result.books === 1 ? "tomo" : "tomos"}.`);
    } catch (err) {
      keepSeat();
      toast(err instanceof Error ? err.message : "No se pudo leer ese archivo.");
    } finally {
      keepSeat();
      setBusy(null);
    }
  }

  async function onEmpty(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    keepSeat();
    setBusy("empty");
    try {
      await emptyShelf();
      keepSeat();
      toast("Estante vacío. Recuperar pide el sistema o tu archivo.");
    } finally {
      keepSeat();
      setBusy(null);
    }
  }

  return (
    <>
      <input
        ref={pickerRef}
        type="file"
        accept="*/*,.tomo,.zip,.json,application/zip,application/json"
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="wood"
        size="icon"
        className="has-tip"
        data-tip={busy === "save" ? "Guardando…" : "Guardar"}
        aria-label="Guardar"
        disabled={busy === "save"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAsk("save");
        }}
      >
        <Save className="size-5" />
      </Button>
      <Button
        type="button"
        variant="wood"
        size="icon"
        className="has-tip"
        data-tip={busy === "restore" ? "Recuperando…" : "Recuperar"}
        aria-label="Recuperar"
        disabled={busy === "restore"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAsk("restore");
        }}
      >
        <ArchiveRestore className="size-5" />
      </Button>
      <Button
        type="button"
        variant="wood"
        size="icon"
        className="has-tip"
        data-tip={busy === "empty" ? "Vaciando…" : "Vaciar"}
        aria-label="Vaciar"
        disabled={busy === "empty" || books.length === 0}
        onClick={onEmpty}
      >
        <Trash2 className="size-5" />
      </Button>
      {ask ? (
        <div className="profile-edit-scrim vault-scrim" onClick={() => setAsk(null)}>
          <div className="profile-edit-card vault-card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vault-close" aria-label="Cerrar" onClick={() => setAsk(null)}>
              <X className="size-4" />
            </button>
            {ask === "save" ? (
              <>
                <p className="vault-title">¿Cómo quieres guardar?</p>
                <p className="vault-lead">Se guarda todo: tomos, portadas y animaciones.</p>
                <Button type="button" onClick={() => void saveSystem()}>
                  <Cloud className="size-4" /> En el sistema
                </Button>
                <Button type="button" variant="wood" onClick={() => void saveDownload()}>
                  <Download className="size-4" /> Descargar copia
                </Button>
              </>
            ) : (
              <>
                <p className="vault-title">¿Cómo quieres recuperar?</p>
                <p className="vault-lead">Del sistema, o una copia de tu ordenador si falló.</p>
                <Button type="button" onClick={() => void restoreSystem()}>
                  <Cloud className="size-4" /> Del sistema
                </Button>
                <Button type="button" variant="wood" onClick={restoreLocal}>
                  <FolderOpen className="size-4" /> Archivo local
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}