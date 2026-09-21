import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Gauge,
  Highlighter,
  Minus,
  MoreHorizontal,
  Moon,
  Newspaper,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScrollText,
  Search,
  Sun,
  Volume2,
} from "lucide-react";
import { PageFlip } from "page-flip/dist/js/page-flip.module.js";
import { toast } from "sonner";
import { BrandBadge } from "@/components/library/brand-mark";
import { SpotifyDock } from "@/components/library/spotify-dock";
import { Button } from "@/components/ui/button";
import { getManuscriptFolios } from "@/lib/demo-books";
import {
  attachPdfTextLayer,
  extractPdfPageText,
  evictPdf,
  loadPdfDocument,
  paintHighlights,
  renderPdfPage,
} from "@/lib/pdf-engine";
import { useLibrary } from "@/lib/library-store";
import {
  cyclePace,
  isNarrating,
  narratorName,
  paceName,
  pauseNarration,
  playPageTurn,
  resumeNarration,
  speakSpread,
  stopNarration,
  unlockAudio,
  getReaderVolume,
  setReaderVolume,
} from "@/lib/reader-audio";
import { useReading } from "@/lib/reading-store";
import type { BookRecord } from "@/lib/types";
import { cn, pageThickness } from "@/lib/utils";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const PAPER_KEY = "book-club-paper";
const FLIP_KEY = "book-club-flip-v2";
type PaperMode = "antique" | "light" | "focus" | "dark";

function loadPaper(): PaperMode {
  try {
    const v = localStorage.getItem(PAPER_KEY);
    if (v === "light" || v === "dark" || v === "antique" || v === "focus") return v;
  } catch {
    /* ignore */
  }
  return "antique";
}

function loadFlip() {
  try {
    return localStorage.getItem(FLIP_KEY) === "1";
  } catch {
    return false;
  }
}

function clampZoom(value: number) {
  const stepped = Math.round(value * 20) / 20;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(stepped.toFixed(2))));
}

function displayRatio() {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(2.8, Math.max(2, dpr * 1.2));
}

function targetRatio(zoom: number) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(5.2, Math.max(displayRatio(), zoom * dpr * 1.25));
}

function measurePage(aspect = 1.5, stage?: HTMLElement | null) {
  const vw = stage && stage.clientWidth > 40 ? stage.clientWidth : window.innerWidth;
  const vh =
    stage && stage.clientHeight > 80 ? stage.clientHeight : Math.max(220, window.innerHeight - 58);
  const w = Math.max(240, Math.min(vw - 28, Math.round((vh - 90) / aspect), 560));
  const h = Math.round(w * aspect);
  return { w, h, narrow: true };
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function blobUrlFromCanvas(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("blob"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      quality,
    );
  });
}

function applyPageBookmark(pages: HTMLElement[], at: number | null, lifting = false) {
  for (const page of pages) {
    page.querySelector(".page-bookmark")?.remove();
  }
  if (at == null || !pages[at]) return;
  const mark = document.createElement("i");
  mark.className = `page-bookmark${lifting ? " is-out" : ""}`;
  mark.innerHTML =
    '<span class="bm-body"></span><span class="bm-edge"></span><span class="bm-fold"></span><span class="bm-crest"></span><span class="bm-shine"></span>';
  pages[at]!.append(mark);
}

export function BookReader({ book }: { book: BookRecord }) {
  const getPdfBuffer = useLibrary((s) => s.getPdfBuffer);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(Math.max(1, book.pageCount));
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"search" | "notes" | "tools" | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ page: number; snippet: string }[]>([]);
  const bookmark = useReading((s) => s.bookmarks[book.id]);
  const highlights = useReading((s) => s.highlights);
  const addHighlight = useReading((s) => s.addHighlight);
  const removeHighlight = useReading((s) => s.removeHighlight);
  const updateHighlight = useReading((s) => s.updateHighlight);
  const clearBookmark = useReading((s) => s.clearBookmark);
  const setBookmark = useReading((s) => s.setBookmark);
  const hydrateReading = useReading((s) => s.hydrate);
  const [paper, setPaper] = useState<PaperMode>(() => loadPaper());
  const [flipOn, setFlipOn] = useState(() => loadFlip());
  const flipOnRef = useRef(false);
  flipOnRef.current = flipOn;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [narrating, setNarrating] = useState(false);
  const [narrPaused, setNarrPaused] = useState(false);
  const [vol, setVol] = useState(() => getReaderVolume());
  const [paceLabel, setPaceLabel] = useState(() => paceName());
  const [voiceLabel] = useState(() => narratorName());
  const [jumpValue, setJumpValue] = useState("1");
  const [draftMark, setDraftMark] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const draftStart = useRef<{ x: number; y: number } | null>(null);
  const draftMarkRef = useRef(draftMark);
  draftMarkRef.current = draftMark;
  const [spread, setSpread] = useState(() =>
    typeof window === "undefined" ? { w: 320, h: 440, narrow: true } : measurePage(),
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const blobUrls = useRef<string[]>([]);
  const paintRef = useRef<((page: number, ratio: number) => void) | undefined>(undefined);
  const pageIndexRef = useRef(0);
  const keepReading = useRef(false);
  const lastFlipAt = useRef(0);
  const pagesRef = useRef<HTMLElement[]>([]);
  const notesLock = useRef(false);
  notesLock.current = panel === "notes";
  const pauseAt = useRef<number | null>(null);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  useEffect(() => {
    hydrateReading();
  }, [hydrateReading]);

  function applyFlip(on: boolean) {
    const s = (
      flipRef.current as unknown as {
        getSettings?: () => {
          flippingTime: number;
          drawShadow: boolean;
          showPageCorners: boolean;
          useMouseEvents: boolean;
          maxShadowOpacity: number;
        };
      } | null
    )?.getSettings?.();
    if (!s) return;
    const live = on && !notesLock.current && !prefersReducedMotion();
    s.flippingTime = live ? 640 : 1;
    s.drawShadow = live;
    s.showPageCorners = false;
    s.useMouseEvents = false;
    s.maxShadowOpacity = live ? 0.65 : 0;
  }

  useEffect(() => {
    applyFlip(flipOn);
  }, [flipOn, panel]);

  function paintAllStains() {
    const hits = useReading.getState().highlights.filter((h) => h.bookId === book.id);
    for (const page of pagesRef.current) {
      const n = Number(page.dataset.pdfPage || 0);
      const layer = page.querySelector(".hl-page") as HTMLElement | null;
      if (!layer) continue;
      layer.querySelectorAll(".hl-stain:not(.is-draft)").forEach((el) => el.remove());
      for (const h of hits) {
        if (h.page !== n || !h.mark) continue;
        const stain = document.createElement("i");
        stain.className = "hl-stain";
        stain.dataset.id = h.id;
        stain.style.left = `${h.mark.x * 100}%`;
        stain.style.top = `${h.mark.y * 100}%`;
        stain.style.width = `${Math.max(h.mark.w, 0.04) * 100}%`;
        stain.style.height = `${Math.max(h.mark.h, 0.02) * 100}%`;
        layer.append(stain);
      }
    }
  }

  function beginNote(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const stain = (event.target as HTMLElement).closest(".hl-stain") as HTMLElement | null;
    if (stain?.dataset.id) {
      removeHighlight(stain.dataset.id);
      paintAllStains();
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    draftStart.current = { x, y };
    setDraftMark({ x, y, w: 0, h: Math.max(18 / box.height, 0.028) });
  }

  function moveNote(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draftStart.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x2 = (event.clientX - box.left) / box.width;
    setDraftMark({
      x: Math.min(draftStart.current.x, x2),
      y: draftStart.current.y,
      w: Math.abs(x2 - draftStart.current.x),
      h: Math.max(18 / box.height, 0.028),
    });
  }

  function endNote() {
    const mark = draftMarkRef.current;
    draftStart.current = null;
    setDraftMark(null);
    if (!mark || mark.w < 0.03) return;
    addHighlight({
      bookId: book.id,
      page: pageIndexRef.current + 1,
      text: `Folio ${pageIndexRef.current + 1}`,
      mark: { x: mark.x, y: mark.y, w: mark.w, h: mark.h, leaf: 0 },
    });
    window.setTimeout(() => paintAllStains(), 0);
  }

  function bindPageGestures(host: HTMLElement) {
    host.addEventListener("click", (event) => {
      if (notesLock.current) return;
      const t = event.target as HTMLElement | null;
      if (t?.closest("button, a, input, textarea, .page-bookmark, .hl-stain, .folio-jump")) return;
      const box = host.getBoundingClientRect();
      const x = event.clientX - box.left;
      if (x > box.width * 0.55) goNext();
      else if (x < box.width * 0.45) goPrev();
    });

    let draft: HTMLElement | null = null;
    let start: { x: number; y: number; w: number; h: number; page: number; layer: HTMLElement } | null = null;

    const onDown = (event: PointerEvent) => {
      if (!notesLock.current || event.button !== 0) return;
      const page = (event.target as HTMLElement | null)?.closest(".folio-page") as HTMLElement | null;
      if (!page || !host.contains(page)) return;
      let layer = page.querySelector(".hl-page") as HTMLElement | null;
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "hl-page";
        page.append(layer);
      }
      const stain = (event.target as HTMLElement | null)?.closest(".hl-stain") as HTMLElement | null;
      if (stain?.dataset.id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        removeHighlight(stain.dataset.id);
        stain.remove();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const box = layer.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      const n = Number(page.dataset.pdfPage || 1);
      start = { x, y, w: box.width, h: box.height, page: n, layer };
      draft = document.createElement("i");
      draft.className = "hl-stain is-draft";
      draft.style.left = `${x * 100}%`;
      draft.style.top = `${y * 100}%`;
      draft.style.height = `${Math.max(18 / box.height, 0.028) * 100}%`;
      draft.style.width = "0%";
      layer.append(draft);
    };
    const onMove = (event: PointerEvent) => {
      if (!draft || !start) return;
      const x2 = (event.clientX - start.layer.getBoundingClientRect().left) / start.w;
      const left = Math.min(start.x, x2);
      const width = Math.abs(x2 - start.x);
      draft.style.left = `${left * 100}%`;
      draft.style.width = `${Math.max(width, 0.02) * 100}%`;
    };
    const onUp = () => {
      if (!draft || !start) {
        draft = null;
        start = null;
        return;
      }
      const left = parseFloat(draft.style.left) / 100;
      const width = parseFloat(draft.style.width) / 100;
      const top = parseFloat(draft.style.top) / 100;
      const height = parseFloat(draft.style.height) / 100;
      draft.remove();
      if (width > 0.03) {
        addHighlight({
          bookId: book.id,
          page: start.page,
          text: `Folio ${start.page}`,
          mark: { x: left, y: top, w: width, h: height, leaf: 0 },
        });
        paintAllStains();
      }
      draft = null;
      start = null;
    };
    host.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function speakHere(idx: number) {
    const page = Math.max(1, idx + 1);
    const text = await extractPdfPageText(book.id, page);
    await speakSpread(text, {
      onDone: () => {
        if (!keepReading.current) {
          setNarrating(false);
          return;
        }
        if (flipOnRef.current) flipRef.current?.flipNext();
        else {
          const n = Math.min(pagesRef.current.length - 1, pageIndexRef.current + 1);
          flipRef.current?.turnToPage(n);
        }
      },
    });
    setNarrating(true);
    setNarrPaused(false);
  }

  function toggleNarrate() {
    if (isNarrating()) {
      pauseNarration();
      keepReading.current = false;
      pauseAt.current = pageIndexRef.current;
      setNarrPaused(true);
      setNarrating(false);
      return;
    }
    const samePage = pauseAt.current != null && pauseAt.current === pageIndexRef.current;
    if (samePage && resumeNarration()) {
      keepReading.current = true;
      setNarrPaused(false);
      setNarrating(true);
      return;
    }
    stopNarration();
    pauseAt.current = null;
    keepReading.current = true;
    unlockAudio();
    const at = pageIndexRef.current;
    setPageIndex(at);
    setNarrating(true);
    void speakHere(at).catch((err) => {
      setNarrating(false);
      toast.error(err instanceof Error ? err.message : "No se pudo narrar.");
    });
  }

  function restartNarrate() {
    keepReading.current = false;
    pauseAt.current = null;
    setNarrPaused(false);
    setNarrating(false);
    stopNarration();
  }

  function toggleFlip() {
    const next = !flipOn;
    setFlipOn(next);
    flipOnRef.current = next;
    applyFlip(next);
    try {
      localStorage.setItem(FLIP_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const goNext = useCallback(() => {
    const pf = flipRef.current;
    if (!pf) return;
    if (!flipOnRef.current) {
      const n = Math.min(pagesRef.current.length - 1, pageIndexRef.current + 1);
      pf.turnToPage(n);
      return;
    }
    pf.flipNext();
  }, []);
  const goPrev = useCallback(() => {
    const pf = flipRef.current;
    if (!pf) return;
    if (!flipOnRef.current) {
      const n = Math.max(0, pageIndexRef.current - 1);
      pf.turnToPage(n);
      return;
    }
    pf.flipPrev();
  }, []);

  useEffect(() => {
    let timer = 0;
    function onResize() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSpread(measurePage(1.5, stageRef.current)), 160);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      if (event.deltaY < 0) zoomIn();
      else if (event.deltaY > 0) zoomOut();
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [zoomIn, zoomOut]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowRight") {
        goNext();
        return;
      }
      if (ev.key === "ArrowLeft") {
        goPrev();
        return;
      }
      const meta = ev.ctrlKey || ev.metaKey;
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        zoomIn();
      }
      if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        zoomOut();
      }
      if (meta && ev.key === "0") {
        ev.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, resetZoom, goNext, goPrev]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const localBlobs: string[] = [];
    setReady(false);
    setError(null);

    const run = async () => {
      const { w, h, narrow } = spread;
      host.replaceChildren();
      host.style.width = `${narrow ? w : w * 2}px`;
      host.style.height = `${h}px`;
      const pages: HTMLElement[] = [];
      let paintQueue: Promise<void> = Promise.resolve();

      const makePlaceholder = (label: string) => {
        const wrap = document.createElement("div");
        wrap.className = "folio-page";
        wrap.innerHTML = `<div class="folio-manuscript"><p>${label}</p></div>`;
        const layer = document.createElement("div");
        layer.className = "hl-page";
        wrap.append(layer);
        return wrap;
      };

      if (book.kind === "manuscript") {
        const folios = getManuscriptFolios(book.manuscriptKey ?? "bestiary");
        folios.forEach((folio, i) => {
          const wrap = document.createElement("div");
          wrap.className = "folio-page";
          wrap.dataset.pdfPage = String(i + 1);
          const paras = folio.body
            .map((p, idx) => {
              if (idx === 0 && folio.drop) return `<p><span class="drop">${folio.drop}</span>${p}</p>`;
              return `<p>${p}</p>`;
            })
            .join("");
          wrap.innerHTML = `<div class="folio-manuscript">${folio.kicker ? `<p class="kicker">${folio.kicker}</p>` : ""}${folio.heading ? `<h2>${folio.heading}</h2>` : ""}${paras}${folio.closing ? `<p class="closing">${folio.closing}</p>` : ""}</div>`;
          const layer = document.createElement("div");
          layer.className = "hl-page";
          wrap.append(layer);
          pages.push(wrap);
        });
      } else {
        const buffer = await getPdfBuffer(book.id);
        if (cancelled) return;
        const doc = await loadPdfDocument(book.id, buffer);
        if (cancelled) return;
        const total = Math.max(1, doc.numPages);
        for (let n = 1; n <= total; n++) {
          const wrap = document.createElement("div");
          wrap.className = "folio-page";
          wrap.dataset.pdfPage = String(n);
          wrap.style.width = `${w}px`;
          wrap.style.height = `${h}px`;
          const layer = document.createElement("div");
          layer.className = "hl-page";
          wrap.append(layer);
          pages.push(wrap);
        }
        const pageOf = (n: number) =>
          (host.querySelector(`[data-pdf-page="${n}"]`) as HTMLElement | null) ?? pages[n - 1] ?? null;
        const paint = (n: number, ratio: number) => {
          paintQueue = paintQueue.then(async () => {
            if (cancelled) return;
            const wrap = pageOf(n);
            if (!wrap) return;
            let img = wrap.querySelector("img") as HTMLImageElement | null;
            if (!img) {
              img = document.createElement("img");
              img.alt = "";
              img.draggable = false;
              img.decoding = "async";
              img.style.width = "100%";
              img.style.height = "100%";
              img.style.objectFit = "contain";
              img.style.mixBlendMode = "multiply";
              wrap.prepend(img);
            }
            if (!wrap.querySelector(".hl-page")) {
              const layer = document.createElement("div");
              layer.className = "hl-page";
              wrap.append(layer);
            }
            const have = Number(img.dataset.ratio || 0);
            if (have >= ratio - 0.05 && img.dataset.ready === "1") return;
            try {
              const canvas = document.createElement("canvas");
              await renderPdfPage(doc, n, canvas, w, ratio);
              let url = "";
              try {
                url = await blobUrlFromCanvas(canvas, ratio > 1.8 ? 0.94 : 0.88);
              } catch {
                url = canvas.toDataURL("image/png");
              }
              if (url.startsWith("blob:")) {
                localBlobs.push(url);
                blobUrls.current.push(url);
              }
              img.src = url;
              img.dataset.ready = "1";
              img.dataset.ratio = String(ratio);
              if (wrap.dataset.text !== "1") {
                wrap.dataset.text = "1";
                try {
                  await attachPdfTextLayer(wrap, doc, n, w, h);
                  void extractPdfPageText(book.id, n);
                  paintHighlights(
                    wrap,
                    useReading
                      .getState()
                      .highlights.filter((x) => x.bookId === book.id && x.page === n)
                      .map((x) => x.text),
                  );
                } catch {
                  /* scanned */
                }
              }
            } catch {
              img.dataset.ready = "err";
            }
          });
          return paintQueue;
        };
        const prefetch = (index: number, ratio = displayRatio()) => {
          for (const p of [index + 1, index + 2, index, index + 3, index - 1]) {
            if (p >= 1 && p <= total) void paint(p, ratio);
          }
        };
        paintRef.current = (n, ratio) => {
          if (n >= 1 && n <= total) void paint(n, ratio);
        };
        const boot = displayRatio();
        (host as HTMLElement & { __prefetch?: (i: number, ratio?: number) => void }).__prefetch = prefetch;
        await paint(1, Math.min(1.4, boot));
        if (cancelled) return;
        void paint(1, boot);
      }

      if (pages.length === 0) pages.push(makePlaceholder("Este tomo no tiene folios."));
      const back = makePlaceholder("Fin del tomo");
      back.dataset.density = "hard";
      pages.push(back);
      const frag = document.createDocumentFragment();
      for (const page of pages) {
        page.style.width = `${w}px`;
        page.style.height = `${h}px`;
        frag.append(page);
      }
      host.append(frag);
      if (cancelled) return;
      pagesRef.current = pages;

      const reading = useReading.getState();
      const marked = reading.bookmarks[book.id];
      const saved = typeof marked === "number" ? marked : reading.progress[book.id];
      const startPage = typeof saved === "number" && saved >= 0 && saved < pages.length ? saved : 0;
      const anim = flipOnRef.current && !prefersReducedMotion();

      const pf = new PageFlip(host, {
        width: w,
        height: h,
        size: "fixed",
        showCover: false,
        maxShadowOpacity: 0,
        flippingTime: anim ? 640 : 1,
        usePortrait: true,
        autoSize: false,
        drawShadow: anim,
        startZIndex: 4,
        mobileScrollSupport: true,
        useMouseEvents: false,
        disableFlipByClick: true,
        showPageCorners: false,
        swipeDistance: 28,
        startPage,
      });
      pf.loadFromHTML(pages);
      const rawNext = pf.flipNext.bind(pf);
      const rawPrev = pf.flipPrev.bind(pf);
      pf.flipNext = ((...args: unknown[]) => {
        if (!flipOnRef.current) {
          pf.turnToPage(Math.min(pages.length - 1, pageIndexRef.current + 1));
          return;
        }
        return rawNext(...(args as []));
      }) as typeof pf.flipNext;
      pf.flipPrev = ((...args: unknown[]) => {
        if (!flipOnRef.current) {
          pf.turnToPage(Math.max(0, pageIndexRef.current - 1));
          return;
        }
        return rawPrev(...(args as []));
      }) as typeof pf.flipPrev;
      (host as HTMLElement & { __prefetch?: (i: number, ratio?: number) => void }).__prefetch?.(startPage);
      pf.on("flip", (e) => {
        if (notesLock.current) {
          window.setTimeout(() => {
            try {
              flipRef.current?.turnToPage(pageIndexRef.current);
            } catch {
              /* ignore */
            }
          }, 0);
          return;
        }
        const idx = Number(e.data) || 0;
        const prev = pageIndexRef.current;
        pageIndexRef.current = idx;
        setPageIndex(idx);
        setJumpValue(String(idx + 1));
        useReading.getState().setProgress(book.id, idx);
        const now = Date.now();
        if (now - lastFlipAt.current > 80 && flipOnRef.current) playPageTurn(idx >= prev ? 1 : -1);
        lastFlipAt.current = now;
        (host as HTMLElement & { __prefetch?: (i: number, ratio?: number) => void }).__prefetch?.(
          idx,
          targetRatio(zoomRef.current),
        );
        const markAt = useReading.getState().bookmarks[book.id];
        if (typeof markAt === "number") applyPageBookmark(pagesRef.current, markAt);
        if (keepReading.current) {
          window.setTimeout(() => {
            if (keepReading.current) void speakHere(idx);
          }, 280);
        }
      });
      flipRef.current = pf;
      pageIndexRef.current = startPage;
      setPageIndex(startPage);
      setJumpValue(String(startPage + 1));
      setPageCount(pages.length);
      applyPageBookmark(pages, typeof marked === "number" ? marked : null);
      applyFlip(flipOnRef.current);
      paintAllStains();
      bindPageGestures(host);
      setReady(true);
    };

    void run().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "No se pudo abrir el tomo.");
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      paintRef.current = undefined;
      stopNarration();
      const pf = flipRef.current;
      flipRef.current = null;
      try {
        pf?.destroy();
      } catch {
        /* ignore */
      }
      try {
        host.replaceChildren();
      } catch {
        host.innerHTML = "";
      }
    };
  }, [book.id, book.kind, book.manuscriptKey, getPdfBuffer, spread.w, spread.h]);

  useEffect(() => {
    return () => evictPdf(book.id);
  }, [book.id]);

  useEffect(() => {
    const ratio = targetRatio(zoom);
    const idx = pageIndexRef.current;
    for (const n of [idx + 1, idx, idx + 2, idx + 3, idx - 1]) paintRef.current?.(n, ratio);
  }, [zoom, pageIndex]);

  useEffect(() => {
    return () => {
      for (const url of blobUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  const thick = pageThickness(book.pageCount);
  const progress = pageCount > 1 ? pageIndex / (pageCount - 1) : 0;
  const leftStack = 4 + progress * thick;
  const rightStack = 4 + (1 - progress) * thick;
  const interiorIndex = Math.max(0, pageIndex);
  const folioLabel =
    interiorIndex >= pageCount - 1
      ? "Contraportada"
      : `Folio ${interiorIndex + 1} de ${Math.max(1, pageCount - 1)}`;
  const frameW = spread.w;
  const boxW = frameW + 20;
  const boxH = spread.h;
  const scaledW = boxW * zoom;
  const scaledH = boxH * zoom;
  const zoomPercent = Math.round(zoom * 100);
  void voiceLabel;

  return (
    <div
      className={cn("reader-shell grain relative flex min-h-dvh flex-col", `is-paper-${paper}`, panel === "notes" && "is-hl-mode", !flipOn && "is-still")}
    >
      <header className="reader-bar relative z-20">
        <Link to="/" className="hall-home" aria-label="Biblioteca">
          <BrandBadge size="sm" />
        </Link>
        <div className="hall-head-music">
          <SpotifyDock />
        </div>
        <div className="reader-bar-tools">
          <label className="reader-vol has-tip" data-tip="Volumen">
            <Volume2 className="size-4" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(vol * 100)}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                setReaderVolume(next);
                setVol(next);
              }}
            />
          </label>
          <Button variant="ghost" type="button" onClick={toggleNarrate}>
            {narrating ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span className="tool-label">{narrating ? "Pausa" : narrPaused ? "Seguir" : "Narrar"}</span>
          </Button>
          <Button variant="ghost" type="button" onClick={() => setPaceLabel(cyclePace())}>
            {paceLabel === "x4" ? <FastForward className="size-4" /> : <Gauge className="size-4" />}
            <span className="tool-label">{paceLabel}</span>
          </Button>
          <Button variant="ghost" size="icon" type="button" onClick={restartNarrate} aria-label="Reiniciar">
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              if (typeof bookmark === "number") {
                applyPageBookmark(pagesRef.current, bookmark, true);
                window.setTimeout(() => {
                  clearBookmark(book.id);
                  applyPageBookmark(pagesRef.current, null);
                }, 360);
                return;
              }
              const at = pageIndexRef.current;
              setBookmark(book.id, at);
              applyPageBookmark(pagesRef.current, at);
            }}
          >
            <Bookmark className={`size-4 ${typeof bookmark === "number" ? "fill-current" : ""}`} />
            <span className="tool-label">Bookmark</span>
          </Button>
          <Button variant={panel === "search" ? "wood" : "ghost"} type="button" onClick={() => setPanel((p) => (p === "search" ? null : "search"))}>
            <Search className="size-4" />
            <span className="tool-label">Buscar</span>
          </Button>
          <Button variant={panel === "notes" ? "wood" : "ghost"} type="button" onClick={() => setPanel((p) => (p === "notes" ? null : "notes"))}>
            <Highlighter className="size-4" />
            <span className="tool-label">Notas</span>
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              const order: PaperMode[] = ["antique", "light", "focus", "dark"];
              const next = order[(order.indexOf(paper) + 1) % order.length] ?? "antique";
              setPaper(next);
              try {
                localStorage.setItem(PAPER_KEY, next);
              } catch {
                /* ignore */
              }
            }}
          >
            {paper === "light" ? <Sun className="size-4" /> : paper === "dark" ? <Moon className="size-4" /> : paper === "focus" ? <Newspaper className="size-4" /> : <ScrollText className="size-4" />}
            <span className="tool-label">{paper === "light" ? "Claro" : paper === "dark" ? "Oscuro" : paper === "focus" ? "Lino" : "Antiguo"}</span>
          </Button>
        </div>
        <Button
          variant={panel === "tools" ? "wood" : "ghost"}
          type="button"
          className="tool-more"
          aria-label="Más opciones"
          onClick={() => setPanel((p) => (p === "tools" ? null : "tools"))}
        >
          <MoreHorizontal className="size-4" />
        </Button>
        <div className="zoom-meter">
          <Button type="button" variant={flipOn ? "wood" : "ghost"} className="flip-toggle" onClick={toggleFlip}>
            {flipOn ? "Apagar animaciones" : "Animar"}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 min-h-8" aria-label="Alejar" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
            <Minus className="size-4" />
          </Button>
          <button type="button" className="zoom-meter-value" onClick={resetZoom} aria-label="Restablecer zoom">
            {zoomPercent}%
          </button>
          <Button variant="ghost" size="icon" className="size-8 min-h-8" aria-label="Acercar" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="reader-bar-meta">
          <p className="truncate font-display text-sm text-parchment">{book.title}</p>
          <p className="font-body text-sm text-muted tabular-nums">{ready ? folioLabel : "Abriendo…"}</p>
        </div>
      </header>
      {panel === "tools" ? (
        <>
          <button type="button" className="tools-scrim" aria-label="Cerrar herramientas" onClick={() => setPanel(null)} />
          <div className="reader-panel is-tools">
            <Button size="icon" variant="ghost" className="has-tip" data-tip={flipOn ? "Apagar animaciones" : "Animar"} onClick={toggleFlip}>
              {flipOn ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="has-tip" data-tip="Alejar" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
              <Minus className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="has-tip" data-tip="Acercar" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
              <Plus className="size-4" />
            </Button>
          </div>
        </>
      ) : null}
      {panel === "search" ? (
        <div className="reader-panel">
          <input
            value={query}
            placeholder="Buscar en el tomo…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const q = query.trim().toLowerCase();
              const found = highlights.filter((h) => h.bookId === book.id && h.text.toLowerCase().includes(q));
              setHits(found.map((h) => ({ page: h.page, snippet: h.text.slice(0, 80) })));
            }}
          />
          {hits.map((hit, i) => (
            <button
              key={`${hit.page}-${i}`}
              type="button"
              onClick={() => {
                flipRef.current?.turnToPage(Math.max(0, hit.page - 1));
                setPanel(null);
              }}
            >
              Folio {hit.page}: {hit.snippet}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {error ? (
          <p className="m-auto max-w-md px-3 text-center font-body text-lg text-parchment">{error}</p>
        ) : (
          <>
            <div className="reader-stage" ref={stageRef}>
              <div className="reader-stage-inner" style={{ minWidth: `${scaledW}px`, minHeight: `${scaledH}px` }}>
                <div className="book-zoom" style={{ width: scaledW, height: scaledH }}>
                  <div className="book-zoom-inner" style={{ width: boxW, height: boxH, transform: `scale(${zoom})` }}>
                    <div
                      className="book-frame"
                      style={{ "--page-w": `${frameW}px`, "--page-h": `${spread.h}px` } as CSSProperties}
                    >
                      <div className="stack-edge left" style={{ width: leftStack }} />
                      <div className="stack-edge right" style={{ width: rightStack }} />
                      {!ready ? <p className="book-loading">El copista ilumina los folios…</p> : null}
                      <div ref={hostRef} className="book-host" />
                      {typeof bookmark === "number" && bookmark === pageIndex ? (
                        <i className="page-bookmark" aria-hidden="true">
                          <span className="bm-body" />
                          <span className="bm-edge" />
                          <span className="bm-fold" />
                          <span className="bm-crest" />
                          <span className="bm-shine" />
                        </i>
                      ) : null}
                      {panel === "notes" ? (
                        <div
                          className="hl-draw"
                          onPointerDown={beginNote}
                          onPointerMove={moveNote}
                          onPointerUp={endNote}
                          onPointerCancel={endNote}
                        >
                          {highlights
                            .filter((h) => h.bookId === book.id && h.page === pageIndex + 1 && h.mark)
                            .map((h) => (
                              <i
                                key={h.id}
                                className="hl-stain"
                                data-id={h.id}
                                style={{
                                  left: `${(h.mark?.x ?? 0) * 100}%`,
                                  top: `${(h.mark?.y ?? 0) * 100}%`,
                                  width: `${Math.max(h.mark?.w ?? 0, 0.04) * 100}%`,
                                  height: `${Math.max(h.mark?.h ?? 0, 0.02) * 100}%`,
                                }}
                              />
                            ))}
                          {draftMark ? (
                            <i
                              className="hl-stain is-draft"
                              style={{
                                left: `${draftMark.x * 100}%`,
                                top: `${draftMark.y * 100}%`,
                                width: `${draftMark.w * 100}%`,
                                height: `${draftMark.h * 100}%`,
                              }}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="reader-skip is-prev" aria-label="Página anterior" onClick={goPrev}>
              <ChevronLeft className="size-6" />
            </Button>
            <Button variant="ghost" size="icon" className="reader-skip is-next" aria-label="Página siguiente" onClick={goNext}>
              <ChevronRight className="size-6" />
            </Button>
            <form
              className="folio-jump"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Math.max(1, Math.min(pageCount, Number(jumpValue) || 1));
                flipRef.current?.turnToPage(n - 1);
              }}
            >
              <span>Ir al folio</span>
              <input value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} inputMode="numeric" />
              <span>de {Math.max(1, pageCount - 1)}</span>
            </form>
            {panel === "notes" ? (
              <aside className="notes-rail">
                <p className="note-folio-label">Notas</p>
                {highlights.filter((h) => h.bookId === book.id).length === 0 ? (
                  <p className="font-body text-sm text-muted">Marca en línea recta sobre el folio.</p>
                ) : null}
                {highlights
                  .filter((h) => h.bookId === book.id)
                  .map((h) => (
                    <article key={h.id} className="note-card">
                      <button
                        type="button"
                        className="note-folio-label"
                        onClick={() => flipRef.current?.turnToPage(Math.max(0, h.page - 1))}
                      >
                        Folio {h.page}
                      </button>
                      <textarea
                        rows={2}
                        placeholder="Comentario…"
                        value={h.note ?? ""}
                        onChange={(e) => updateHighlight(h.id, { note: e.target.value })}
                      />
                      <button type="button" className="note-tool" onClick={() => { removeHighlight(h.id); paintAllStains(); }}>
                        Quitar
                      </button>
                    </article>
                  ))}
              </aside>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
