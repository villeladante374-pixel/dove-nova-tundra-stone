import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Save, X } from "lucide-react";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEK = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const NOTES_KEY = "book-club-dates";

function stamp() {
  return new Date().toLocaleTimeString("es-HN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function keyOf(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shift(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function lastSunday(year: number, month: number) {
  const d = new Date(year, month + 1, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function hondurasHolidays(year: number) {
  const map = new Map<string, string>();
  const add = (y: number, m: number, d: number, name: string) => map.set(keyOf(y, m, d), name);
  add(year, 1, 1, "Año Nuevo");
  add(year, 1, 6, "Día de Reyes");
  add(year, 2, 3, "Virgen de Suyapa");
  add(year, 4, 14, "Día de las Américas");
  add(year, 5, 1, "Día del Trabajo");
  add(year, 9, 10, "Día del Niño");
  add(year, 9, 15, "Independencia de Honduras");
  add(year, 10, 3, "Día del Soldado");
  add(year, 10, 12, "Día de la Raza");
  add(year, 10, 21, "Día de las Fuerzas Armadas");
  add(year, 12, 25, "Navidad");
  add(year, 12, 31, "Nochevieja");
  const e = easter(year);
  const thu = shift(e, -3);
  const fri = shift(e, -2);
  const sat = shift(e, -1);
  add(thu.getFullYear(), thu.getMonth() + 1, thu.getDate(), "Jueves Santo");
  add(fri.getFullYear(), fri.getMonth() + 1, fri.getDate(), "Viernes Santo");
  add(sat.getFullYear(), sat.getMonth() + 1, sat.getDate(), "Sábado de Gloria");
  const mom = lastSunday(year, 4);
  add(mom.getFullYear(), mom.getMonth() + 1, mom.getDate(), "Día de la Madre");
  return map;
}

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function cells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const list: Array<{ day: number | null; key: string; dow: number }> = [];
  for (let i = 0; i < start; i++) list.push({ day: null, key: `b-${i}`, dow: i });
  for (let d = 1; d <= days; d++) {
    const dow = (start + d - 1) % 7;
    list.push({ day: d, key: keyOf(year, month + 1, d), dow });
  }
  return list;
}

export function LiveClock() {
  const [now, setNow] = useState("");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [picked, setPicked] = useState<{ key: string; day: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const closeTimer = useRef(0);

  useEffect(() => {
    setNow(stamp());
    const id = window.setInterval(() => setNow(stamp()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const holidays = useMemo(() => hondurasHolidays(cursor.y), [cursor.y]);
  const today = new Date();
  const todayKey = keyOf(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const grid = cells(cursor.y, cursor.m);
  let feastI = 0;
  const shown = open || closing;

  function labelOf(key: string) {
    return notes[key] || holidays.get(key) || "";
  }

  function close() {
    if (!open || closing) return;
    setClosing(true);
    setOpen(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setClosing(false), 420);
  }

  function pick(key: string, day: number) {
    setPicked({ key, day });
    setDraft(labelOf(key));
    setSaved(false);
  }

  function saveNote() {
    if (!picked) return;
    const name = draft.trim();
    const next = { ...notes };
    if (name) next[picked.key] = name;
    else delete next[picked.key];
    setNotes(next);
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  if (!now) return null;

  return (
    <>
      {shown ? <button type="button" className="cal-scrim" aria-label="Cerrar calendario" onClick={close} /> : null}
      <div className={`clock-dock${open ? " is-open" : ""}${closing ? " is-closing" : ""}`}>
        <div className="cal-bar">
          <button
            type="button"
            className="live-clock"
            aria-label={shown ? "Cerrar calendario" : "Abrir calendario"}
            onClick={() => {
              if (shown) close();
              else {
                setClosing(false);
                setOpen(true);
              }
            }}
          >
            {now}
          </button>
          {shown ? (
            <button type="button" className="cal-x" aria-label="Cerrar" onClick={close}>
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {shown ? (
          <div
            className="cal-body"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (!t.closest(".cal-day, .cal-note, .cal-nav, .cal-edit, input")) setPicked(null);
            }}
          >
            <div className="cal-nav">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => {
                  setPicked(null);
                  setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
                }}
              >
                <ChevronLeft className="size-4" />
              </button>
              <p>
                {MONTHS[cursor.m]} {cursor.y}
              </p>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => {
                  setPicked(null);
                  setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
                }}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div
              className="cal-grid"
              onClick={(e) => {
                if (e.target === e.currentTarget) setPicked(null);
              }}
            >
              {WEEK.map((d, i) => (
                <span key={d} className={`cal-wd${i >= 5 ? " is-end" : ""}`}>
                  {d}
                </span>
              ))}
              {grid.map((c) => {
                const feast = c.day ? holidays.get(c.key) : undefined;
                const mine = c.day ? notes[c.key] : undefined;
                const isToday = c.key === todayKey;
                const marked = Boolean(feast || mine);
                const delay = marked ? feastI++ : 0;
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!c.day}
                    className={`cal-day${c.day ? "" : " is-empty"}${isToday ? " is-today" : ""}${feast && !mine ? " is-feast" : ""}${mine ? " is-mine" : ""}${c.dow >= 5 ? " is-end" : ""}`}
                    style={marked ? { ["--d" as string]: String(delay) } : undefined}
                    onClick={() => {
                      if (!c.day) return;
                      if (picked?.key === c.key) {
                        setPicked(null);
                        return;
                      }
                      pick(c.key, c.day);
                    }}
                  >
                    {c.day ?? ""}
                  </button>
                );
              })}
            </div>
            <div className={`cal-note${picked ? " is-on" : ""}`} onClick={(e) => e.stopPropagation()}>
              {picked ? (
                <>
                  <div className="cal-note-top">
                    <p className="cal-note-day">
                      {picked.day} de {MONTHS[cursor.m]}
                    </p>
                    <button type="button" className="cal-back" aria-label="Volver" onClick={() => setPicked(null)}>
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="cal-edit">
                    <input
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setSaved(false);
                      }}
                      placeholder="Nombre de esta fecha"
                    />
                    <button type="button" className="cal-save" aria-label="Guardar fecha" onClick={saveNote}>
                      <Save className="size-4" />
                    </button>
                  </div>
                  {saved ? <p className="cal-saved">Guardado</p> : null}
                </>
              ) : (
                <p className="cal-note-hint">Toca un día para verlo o editarlo.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
