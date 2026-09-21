import { createServerFn } from "@tanstack/react-start";

export type YtHit = {
  id: string;
  title: string;
  channel: string;
  thumb: string;
};

function textOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const o = node as { simpleText?: string; runs?: { text?: string }[] };
  if (o.simpleText) return o.simpleText;
  if (Array.isArray(o.runs)) return o.runs.map((r) => r.text ?? "").join("");
  return "";
}

function walk(node: unknown, out: YtHit[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out);
    return;
  }
  const o = node as Record<string, unknown>;
  const vr = (o.videoRenderer ?? o.compactVideoRenderer) as Record<string, unknown> | undefined;
  if (vr && typeof vr.videoId === "string") {
    const id = vr.videoId;
    if (!out.some((x) => x.id === id)) {
      const thumbs = (vr.thumbnail as { thumbnails?: { url: string }[] } | undefined)?.thumbnails;
      out.push({
        id,
        title: textOf(vr.title) || "Vídeo",
        channel: textOf(vr.ownerText) || textOf(vr.longBylineText) || textOf(vr.shortBylineText) || "YouTube",
        thumb: thumbs?.[thumbs.length - 1]?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
    }
    return;
  }
  for (const v of Object.values(o)) walk(v, out);
}

export const searchYoutube = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => ({ q: String(input?.q ?? "").trim().slice(0, 80) }))
  .handler(async ({ data }) => {
    if (!data.q) return [] as YtHit[];
    const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: { "content-type": "application/json", "x-youtube-client-name": "1" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240613.01.00",
            hl: "es",
            gl: "US",
          },
        },
        query: data.q,
      }),
    });
    if (!res.ok) return [] as YtHit[];
    const json: unknown = await res.json();
    const hits: YtHit[] = [];
    walk(json, hits);
    return hits.slice(0, 24);
  });
