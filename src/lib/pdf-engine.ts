import type { PDFDocumentProxy } from "pdfjs-dist";

let workerReady = false;
let enginePromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function pdfjs() {
  if (!enginePromise) {
    enginePromise = import("pdfjs-dist").then(async (mod) => {
      if (!workerReady) {
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        mod.GlobalWorkerOptions.workerSrc = worker.default || "/pdfjs/pdf.worker.min.mjs";
        workerReady = true;
      }
      return mod;
    });
  }
  return enginePromise;
}

export function warmPdfEngine() {
  void pdfjs();
}

const docs = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadPdfDocument(bookId: string, data: ArrayBuffer) {
  const existing = docs.get(bookId);
  if (existing) return existing;
  const promise = (async () => {
    const { getDocument } = await pdfjs();
    const task = getDocument({
      data: new Uint8Array(data.slice(0)),
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      verbosity: 0,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    });
    return task.promise;
  })();
  docs.set(bookId, promise);
  try {
    return await promise;
  } catch (err) {
    docs.delete(bookId);
    throw err;
  }
}

const textCache = new Map<string, string>();

export function evictPdf(bookId: string) {
  const pending = docs.get(bookId);
  docs.delete(bookId);
  for (const key of [...textCache.keys()]) {
    if (key.startsWith(`${bookId}:`)) textCache.delete(key);
  }
  void pending?.then((doc) => doc.cleanup()).catch(() => undefined);
}

export async function inspectPdf(file: File) {
  const { getDocument } = await pdfjs();
  const buffer = await file.arrayBuffer();
  const task = getDocument({
    data: new Uint8Array(buffer),
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    verbosity: 0,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  const doc = await task.promise;
  let title = "";
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string } | undefined;
    title = info?.Title?.trim() ?? "";
  } catch {
    title = "";
  }
  const pageCount = doc.numPages;
  await doc.cleanup();
  return { pageCount, title };
}

export async function extractPdfPageText(bookId: string, pageNumber: number) {
  const key = `${bookId}:${pageNumber}`;
  const cached = textCache.get(key);
  if (cached != null) return cached;
  const pending = docs.get(bookId);
  if (!pending) return "";
  const doc = await pending;
  if (pageNumber < 1 || pageNumber > doc.numPages) return "";
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  type Bit = { str: string; x: number; y: number; h: number };
  const bits: Bit[] = [];
  for (const item of content.items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const str = String((item as { str: string }).str);
    if (!str.trim()) continue;
    const tr = (item as { transform?: number[] }).transform ?? [1, 0, 0, 1, 0, 0];
    const h = Number((item as { height?: number }).height) || 10;
    bits.push({ str, x: tr[4] ?? 0, y: tr[5] ?? 0, h });
  }
  bits.sort((a, b) => {
    const line = Math.max(a.h, b.h, 8) * 0.55;
    const dy = b.y - a.y;
    if (Math.abs(dy) > line) return dy;
    return a.x - b.x;
  });
  let out = "";
  let lastY: number | null = null;
  let lastX = 0;
  for (const bit of bits) {
    if (lastY == null) {
      out = bit.str;
    } else if (Math.abs(lastY - bit.y) > Math.max(bit.h, 8) * 0.55) {
      out += /[.!?…]$/.test(out.trim()) ? " " : " ";
      out += bit.str;
    } else {
      const gap = bit.x - lastX;
      out += gap > bit.h * 1.2 && !out.endsWith(" ") && !bit.str.startsWith(" ") ? " " : "";
      out += bit.str;
    }
    lastY = bit.y;
    lastX = bit.x + bit.str.length * (bit.h * 0.45);
  }
  const text = out.replace(/\s+/g, " ").trim();
  textCache.set(key, text);
  return text;
}

export async function searchPdfText(bookId: string, query: string, maxPages: number) {
  const q = query.trim().toLowerCase();
  if (!q) return [] as { page: number; snippet: string }[];
  const hits: { page: number; snippet: string }[] = [];
  for (let n = 1; n <= maxPages; n++) {
    const t = await extractPdfPageText(bookId, n);
    const i = t.toLowerCase().indexOf(q);
    if (i >= 0) {
      hits.push({
        page: n,
        snippet: t.slice(Math.max(0, i - 42), i + q.length + 42).trim(),
      });
      if (hits.length >= 30) break;
    }
  }
  return hits;
}

export async function attachPdfTextLayer(
  container: HTMLElement,
  doc: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
  cssHeight: number,
  trap = true,
) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(cssWidth / base.width, cssHeight / base.height);
  const viewport = page.getViewport({ scale });
  let layer = container.querySelector(".pdf-text") as HTMLElement | null;
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "pdf-text";
    container.append(layer);
  } else {
    layer.replaceChildren();
  }
  layer.style.width = `${viewport.width}px`;
  layer.style.height = `${viewport.height}px`;
  const { TextLayer } = await pdfjs();
  const tl = new TextLayer({
    textContentSource: await page.getTextContent(),
    container: layer,
    viewport,
  });
  await tl.render();
  if (!trap) return;
  const halt = (e: Event) => {
    e.stopPropagation();
  };
  layer.addEventListener("pointerdown", halt);
  layer.addEventListener("mousedown", halt);
  layer.addEventListener("touchstart", halt, { passive: true });
}

export function paintHighlights(root: HTMLElement, needles: string[]) {
  const marks = needles.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 2);
  if (!marks.length) return;
  for (const span of root.querySelectorAll(".pdf-text span")) {
    const t = (span.textContent ?? "").trim().toLowerCase();
    if (t.length < 2) continue;
    if (marks.some((n) => n.includes(t) || t.includes(n.slice(0, Math.min(24, n.length))))) {
      span.classList.add("is-hl");
    }
  }
}

export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  pixelRatio?: number,
  cssHeight?: number,
) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = pixelRatio ?? Math.min(2, window.devicePixelRatio || 1);
  const targetW = Math.max(1, Math.round(cssWidth * dpr));
  const targetH = Math.max(1, Math.round((cssHeight ?? (cssWidth * base.height) / base.width) * dpr));
  canvas.width = targetW;
  canvas.height = targetH;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  const scale = Math.max(targetW / base.width, targetH / base.height);
  const viewport = page.getViewport({ scale });
  const dx = Math.round((targetW - viewport.width) / 2);
  const dy = Math.round((targetH - viewport.height) / 2);
  const task = page.render({
    canvasContext: ctx,
    canvas,
    viewport,
    transform: dx || dy ? [1, 0, 0, 1, dx, dy] : undefined,
    background: "rgba(0,0,0,0)",
  });
  await task.promise;
  page.cleanup();
}
