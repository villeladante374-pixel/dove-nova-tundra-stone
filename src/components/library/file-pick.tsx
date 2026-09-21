import { useState, type DragEvent, type ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  hint: string;
  accept?: string;
  onFile: (file: File) => void;
};

export function FilePick({ icon, label, hint, accept, onFile }: Props) {
  const [over, setOver] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    setChosen(file.name);
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  }

  return (
    <div
      data-file-pick
      className={`flex flex-col justify-center rounded-lg border border-dashed px-4 py-3 ${
        over ? "border-brass bg-ink/60" : "border-brass/40 bg-ink/40"
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <p className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-brass">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-muted">{hint}</p>
      {chosen ? (
        <p className="mt-2 truncate font-display text-sm text-brass" title={chosen}>
          Listo · {chosen}
        </p>
      ) : null}
      <input
        type="file"
        accept={accept || undefined}
        className="mt-3 block min-h-11 w-full cursor-pointer text-sm text-parchment file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brass file:px-3 file:py-2 file:font-display file:text-sm file:text-ink"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.value = "";
        }}
        onInput={(e) => take(e.currentTarget.files?.[0])}
        onChange={(e) => take(e.currentTarget.files?.[0])}
      />
    </div>
  );
}
