import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Volume2, VolumeX } from "lucide-react";
import { BrandBadge } from "@/components/library/brand-mark";
import { ProfileEdit } from "@/components/library/profile-edit";
import { READERS, type ReaderId } from "@/lib/readers";
import { initialOf, portraitOf, useProfiles, type Profile } from "@/lib/profiles-store";
import { useReader } from "@/lib/reader-store";
import { getSfxVolume, isSfxMuted, playOpenSfx, playRailMove, setSfxMuted, setSfxVolume, unlockUiSfx } from "@/lib/ui-sfx";

type Props = {
  backdrop?: boolean;
};

export function WhoIsReading({ backdrop = true }: Props) {
  const select = useReader((s) => s.select);
  const hydrateProfiles = useProfiles((s) => s.hydrate);
  const byId = useProfiles((s) => s.byId);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editId, setEditId] = useState<ReaderId | null>(null);
  const [sfxOff, setSfxOff] = useState(() => isSfxMuted());
  const [sfxVol, setSfxVol] = useState(() => getSfxVolume());
  const hoverRef = useRef<string | null>(null);

  useEffect(() => {
    hydrateProfiles();
  }, [hydrateProfiles]);

  function onHover(id: string) {
    if (id === hoverRef.current) return;
    const from = hoverRef.current ? READERS.findIndex((r) => r.id === hoverRef.current) : -1;
    const to = READERS.findIndex((r) => r.id === id);
    hoverRef.current = id;
    setHoverId(id);
    playRailMove(to >= from ? 1 : -1);
  }

  return (
    <div
      className={`picker-shell grain relative ${backdrop ? "" : "is-bare"}`}
      onPointerDownCapture={() => unlockUiSfx()}
    >
      <div className="picker-sound">
        <button
          type="button"
          className="picker-sound-btn has-tip"
          data-tip={sfxOff ? "Activar sonidos" : "Silenciar sonidos"}
          aria-label={sfxOff ? "Activar sonidos" : "Silenciar sonidos"}
          onClick={() => {
            const next = !sfxOff;
            setSfxMuted(next);
            setSfxOff(next);
          }}
        >
          {sfxOff ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(sfxVol * 100)}
          aria-label="Volumen de la app"
          onChange={(e) => {
            const next = Number(e.target.value) / 100;
            setSfxVolume(next);
            setSfxVol(next);
            if (next > 0 && sfxOff) {
              setSfxMuted(false);
              setSfxOff(false);
            }
          }}
        />
      </div>
      <main className="picker-main">
        <div className="picker-stage">
        <div className="picker-brand">
          <BrandBadge size="md" upload className="is-hero" />
        </div>
        <h1 className="picker-title">¿Quién está leyendo?</h1>
        <ul className="picker-row">
          {READERS.map((reader) => (
            <li key={reader.id}>
              <ReaderChip
                id={reader.id}
                profile={byId[reader.id] ?? { name: reader.name }}
                fallbackInitial={reader.initial}
                active={hoverId === reader.id}
                onHover={onHover}
                onEdit={() => setEditId(reader.id)}
                onPick={() => {
                  unlockUiSfx();
                  playOpenSfx();
                  select(reader.id);
                }}
              />
            </li>
          ))}
        </ul>
        </div>
      </main>
      {editId ? <ProfileEdit id={editId} onClose={() => setEditId(null)} /> : null}
    </div>
  );
}

function ReaderChip({
  id,
  profile,
  fallbackInitial,
  active,
  onHover,
  onEdit,
  onPick,
}: {
  id: ReaderId;
  profile: Profile;
  fallbackInitial: string;
  active: boolean;
  onHover: (id: string) => void;
  onEdit: () => void;
  onPick: () => void;
}) {
  const setPhoto = useProfiles((s) => s.setPhoto);
  const initial = initialOf(profile.name, fallbackInitial);
  const face = portraitOf(id, profile);

  return (
    <div className="reader-chip-wrap">
      <button
        type="button"
        className="reader-chip group"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick();
        }}
        onPointerEnter={() => onHover(id)}
        onPointerMove={(e) => {
          const orbit = e.currentTarget.querySelector(".avatar-orbit") as HTMLElement | null;
          if (!orbit) return;
          const r = orbit.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          orbit.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 16}deg) scale(1.07)`;
        }}
        onPointerLeave={(e) => {
          const orbit = e.currentTarget.querySelector(".avatar-orbit") as HTMLElement | null;
          if (orbit) orbit.style.transform = "";
        }}
        onFocus={() => onHover(id)}
      >
        <span className={`avatar-orbit ${active ? "is-on" : ""}`}>
          <i className="ring-spin" aria-hidden />
          <span className={`reader-avatar tone-${id} ${active ? "is-on" : ""}`}>
            {face ? <img src={face} alt="" className="reader-photo" /> : <span className="reader-initial">{initial}</span>}
            <i className="reader-shine" aria-hidden />
          </span>
        </span>
        <span className="reader-chip-name">{profile.name}</span>
      </button>
      {face ? (
        <button
          type="button"
          className="reader-edit is-trash"
          aria-label={`Quitar foto de ${profile.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setPhoto(id, undefined);
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className="reader-edit"
        aria-label={`Editar ${profile.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}