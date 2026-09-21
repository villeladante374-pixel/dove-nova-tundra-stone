const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const textEnc = new TextEncoder();
const textDec = new TextDecoder();

export type ZipEntry = { name: string; data: Uint8Array };

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function asPart(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}

export function buildZip(entries: ZipEntry[]): Blob {
  const chunks: ArrayBuffer[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = textEnc.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);
    u16(lv, 26, name.length);
    u32(lv, 14, crc);
    u32(lv, 18, data.length);
    u32(lv, 22, data.length);
    local.set(name, 30);
    chunks.push(asPart(local), asPart(data));
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);
    u16(cv, 6, 20);
    u32(cv, 16, crc);
    u32(cv, 20, data.length);
    u32(cv, 24, data.length);
    u16(cv, 28, name.length);
    u32(cv, 42, offset);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  let centralSize = 0;
  for (const c of centrals) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 8, entries.length);
  u16(ev, 10, entries.length);
  u32(ev, 12, centralSize);
  u32(ev, 16, offset);
  for (const c of centrals) chunks.push(asPart(c));
  chunks.push(asPart(end));
  return new Blob(chunks, { type: "application/zip" });
}

async function inflate(data: Uint8Array, method: number) {
  if (method === 0) return data;
  if (method !== 8) throw new Error("Este guardado usa compresión no soportada.");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este teléfono no puede leer zips comprimidos. Pasa el archivo .tomo.zip original.");
  }
  const raw = new Blob([asPart(data)]);
  try {
    const out = await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    const out = await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
    return new Uint8Array(out);
  }
}

function findEocd(view: DataView, length: number) {
  const min = Math.max(0, length - 22 - 65535);
  for (let i = length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function readLocalEntries(buf: Uint8Array, view: DataView) {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart > buf.length) break;
    const name = textDec.decode(buf.subarray(nameStart, nameStart + nameLen));
    const end = size > 0 ? dataStart + size : buf.length;
    if (end > buf.length && size > 0) break;
    const packed = buf.subarray(dataStart, Math.min(end, buf.length));
    if (packed.byteLength === 0 && size > 0) break;
    try {
      entries.push({ name, data: await inflate(packed, method) });
    } catch {
      break;
    }
    offset = dataStart + (size || packed.byteLength);
  }
  return entries;
}

export async function readZip(blob: Blob | Uint8Array): Promise<ZipEntry[]> {
  const buf = blob instanceof Uint8Array ? blob : new Uint8Array(await blob.arrayBuffer());
  if (buf.byteLength < 30) throw new Error("El archivo está vacío o incompleto.");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = buf.length >= 22 ? findEocd(view, buf.length) : -1;
  if (eocd >= 0) {
    try {
      const count = view.getUint16(eocd + 10, true);
      let offset = view.getUint32(eocd + 16, true);
      if (offset < buf.length) {
        const entries: ZipEntry[] = [];
        for (let i = 0; i < count; i++) {
          if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("El archivo está dañado.");
          const method = view.getUint16(offset + 10, true);
          const size = view.getUint32(offset + 20, true);
          const nameLen = view.getUint16(offset + 28, true);
          const extraLen = view.getUint16(offset + 30, true);
          const commentLen = view.getUint16(offset + 32, true);
          const localOff = view.getUint32(offset + 42, true);
          const name = textDec.decode(buf.subarray(offset + 46, offset + 46 + nameLen));
          if (localOff + 30 > buf.length) throw new Error("El archivo está incompleto.");
          const localName = view.getUint16(localOff + 26, true);
          const localExtra = view.getUint16(localOff + 28, true);
          const dataStart = localOff + 30 + localName + localExtra;
          const packed = buf.subarray(dataStart, dataStart + size);
          entries.push({ name, data: await inflate(packed, method) });
          offset += 46 + nameLen + extraLen + commentLen;
        }
        if (entries.length) return entries;
      }
    } catch {
      /* fall through to local scan */
    }
  }
  const scanned = await readLocalEntries(buf, view);
  if (scanned.length) return scanned;
  throw new Error("ZIP_EOCD");
}
