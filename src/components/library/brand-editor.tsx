import { useState } from "react";
import { Pencil } from "lucide-react";
import { useUiPrefs } from "@/lib/ui-prefs";

export function BrandEditor() {
  const logo = useUiPrefs((s) => s.logo);
  const lead = useUiPrefs((s) => s.lead);
  const setLogo = useUiPrefs((s) => s.setLogo);
  const setLead = useUiPrefs((s) => s.setLead);
  const [open, setOpen] = useState(false);

  return (
    <div className={`brand-edit${open ? " is-open" : ""}`}>
      <button type="button" className="brand-edit-btn" onClick={() => setOpen((v) => !v)} aria-label="Ajustar logo y texto">
        <Pencil className="size-3.5" />
      </button>
      {open ? (
        <div className="brand-edit-pop">
          <label>
            Logo
            <input
              type="range"
              min={0.7}
              max={1.8}
              step={0.05}
              value={logo}
              onChange={(e) => setLogo(Number(e.target.value))}
            />
          </label>
          <label>
            Interlineado
            <input
              type="range"
              min={1.15}
              max={1.9}
              step={0.05}
              value={lead}
              onChange={(e) => setLead(Number(e.target.value))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
