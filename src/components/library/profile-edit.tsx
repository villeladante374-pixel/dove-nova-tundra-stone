import { useRef, useState, type PointerEvent } from "react";
import { Check, Maximize2, Scan, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bakeAvatar, initialOf, portraitOf, useProfiles } from "@/lib/profiles-store";
import { type ReaderId } from "@/lib/readers";

type Props = {
  id: ReaderId;
  onClose: () => void;
};

type Draft = { url: string; mode: "fit" | "crop"; zoom: number; x: number; y: number };

export function ProfileEdit({ id, onClose }: Props) {
  const profile = useProfiles((s) => s.byId[id]);
  const setName = useProfiles((s) => s.setName);
  const setPhoto = useProfiles((s) => s.setPhoto);
  const [name, setLocalName] = useState(profile.name);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  function save() {
    setName(id, name);
    onClose();
  }

  function clearPhoto() {
    setPhoto(id, undefined);
    toast(id === "dante" ? "Foto quitada. Queda la inicial." : "Foto quitada.");
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Elige una imagen.");
      return;
    }
    const url = URL.createObjectURL(file);
    setDraft({ url, mode: "crop", zoom: 1, x: 0, y: 0 });
  }

  async function applyDraft() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const photo = await bakeAvatar(draft.url, draft);
      setPhoto(id, photo);
      URL.revokeObjectURL(draft.url);
      setDraft(null);
    } catch {
      toast("No se pudo usar esa foto.");
    } finally {
      setBusy(false);
    }
  }

  function cancelDraft() {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  }

  function onDragStart(e: PointerEvent<HTMLDivElement>) {
    if (!draft || draft.mode !== "crop") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: draft.x, y: draft.y, px: e.clientX, py: e.clientY };
  }

  function onDragMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !draft) return;
    const dx = (e.clientX - drag.current.px) / 90;
    const dy = (e.clientY - drag.current.py) / 90;
    setDraft({
      ...draft,
      x: Math.min(1, Math.max(-1, drag.current.x + dx)),
      y: Math.min(1, Math.max(-1, drag.current.y + dy)),
    });
  }

  return (
    <div className="profile-edit-scrim" onClick={draft ? undefined : onClose}>
      <div
        className="profile-edit-card"
        role="dialog"
        aria-label="Editar perfil"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-parchment">{draft ? "Ajustar foto" : "Editar perfil"}</h2>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={draft ? cancelDraft : onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {draft ? (
          <>
            <div
              className="crop-stage"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              <img
                src={draft.url}
                alt=""
                draggable={false}
                className={draft.mode === "fit" ? "is-fit" : "is-crop"}
                style={
                  draft.mode === "crop"
                    ? { transform: `translate(${draft.x * 18}%, ${draft.y * 18}%) scale(${draft.zoom})` }
                    : undefined
                }
              />
            </div>
            <div className="crop-modes">
              <button
                type="button"
                className={draft.mode === "crop" ? "is-on" : ""}
                onClick={() => setDraft({ ...draft, mode: "crop" })}
              >
                <Scan className="size-4" /> Recortar
              </button>
              <button
                type="button"
                className={draft.mode === "fit" ? "is-on" : ""}
                onClick={() => setDraft({ ...draft, mode: "fit", zoom: 1, x: 0, y: 0 })}
              >
                <Maximize2 className="size-4" /> Completa
              </button>
            </div>
            {draft.mode === "crop" ? (
              <label className="crop-zoom">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.02"
                  value={draft.zoom}
                  onChange={(e) => setDraft({ ...draft, zoom: Number(e.target.value) })}
                />
              </label>
            ) : (
              <p className="mt-2 text-center font-body text-sm text-muted">La foto entra entera en el círculo.</p>
            )}
            <p className="mt-1 text-center font-body text-sm text-muted">
              {draft.mode === "crop" ? "Arrastra para mover el recorte." : null}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="wood" onClick={cancelDraft}>
                Cancelar
              </Button>
              <Button onClick={() => void applyDraft()} disabled={busy}>
                <Check className="size-4" /> Usar foto
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-3">
              <input
                ref={pickerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  onPick(file);
                }}
              />
              <div className="profile-face">
                <button
                  type="button"
                  className={`reader-avatar is-preview is-edit tone-${id}`}
                  aria-label="Cambiar foto de perfil"
                  onClick={() => pickerRef.current?.click()}
                >
                  {portraitOf(id, profile) ? (
                    <img src={portraitOf(id, profile)} alt="" className="reader-photo" />
                  ) : (
                    <span className="reader-initial">{initialOf(name, profile.name)}</span>
                  )}
                </button>
                {portraitOf(id, profile) ? (
                  <button type="button" className="profile-trash" aria-label="Quitar foto" onClick={clearPhoto}>
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <input
                className="profile-edit-name"
                value={name}
                maxLength={18}
                autoFocus
                placeholder="Nombre"
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
            </div>
            <p className="mt-3 text-center font-body text-sm text-muted">
              Cambia el nombre aquí. Toca el círculo para elegir una foto y recortarla.
            </p>
            <div className="mt-5 flex justify-center">
              <Button onClick={save}>Guardar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}