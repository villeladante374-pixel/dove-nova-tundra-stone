export function prepCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

export function toHiResJpeg(canvas: HTMLCanvasElement, quality = 0.94) {
  try {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch {
    /* jpeg */
  }
  return canvas.toDataURL("image/jpeg", quality);
}

export function toHiResBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 0.94) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo guardar la imagen."))), type, quality);
  });
}
