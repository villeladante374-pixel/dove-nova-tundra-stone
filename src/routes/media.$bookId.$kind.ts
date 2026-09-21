import { createFileRoute } from "@tanstack/react-router";
import { clubFileAbs, clubMimeAbs } from "@/lib/club-vault";

const KINDS = ["pdf", "cover", "hover"] as const;
type Kind = (typeof KINDS)[number];

function fileResponse(params: { bookId: string; kind: string }, body: boolean) {
  return (async () => {
    const { existsSync, readFileSync, statSync } = await import("node:fs");
    const kind = params.kind as Kind;
    if (!KINDS.includes(kind)) return new Response("no", { status: 404 });
    const file = clubFileAbs(params.bookId, kind);
    if (!existsSync(file)) return new Response("no", { status: 404 });
    const size = statSync(file).size;
    let mime = "application/octet-stream";
    const mp = clubMimeAbs(params.bookId, kind);
    if (existsSync(mp)) mime = readFileSync(mp, "utf8").trim() || mime;
    if (kind === "cover" && !mime.startsWith("image/")) mime = "image/jpeg";
    if (kind === "pdf") mime = "application/pdf";
    if (kind === "hover" && !mime.startsWith("video/")) mime = "video/mp4";
    const headers = {
      "content-type": mime,
      "content-length": String(size),
      "cache-control": "public, max-age=120",
    };
    if (!body) return new Response(null, { status: 200, headers });
    return new Response(readFileSync(file), { headers });
  })();
}

export const Route = createFileRoute("/media/$bookId/$kind")({
  server: {
    handlers: {
      HEAD: async ({ params }) => fileResponse(params, false),
      GET: async ({ params }) => fileResponse(params, true),
      POST: async ({ params, request }) => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        const kind = params.kind as Kind;
        if (!KINDS.includes(kind)) return new Response("no", { status: 400 });
        const dir = `${process.env.VERCEL ? "/tmp/club" : "/workspace/.data/club"}/files/${params.bookId}`;
        mkdirSync(dir, { recursive: true });
        const buf = Buffer.from(await request.arrayBuffer());
        writeFileSync(clubFileAbs(params.bookId, kind), buf);
        const mime = request.headers.get("content-type") || "application/octet-stream";
        writeFileSync(clubMimeAbs(params.bookId, kind), mime);
        return Response.json({ ok: true, bytes: buf.length });
      },
      DELETE: async ({ params }) => {
        const { existsSync, unlinkSync } = await import("node:fs");
        const kind = params.kind as Kind;
        if (!KINDS.includes(kind)) return new Response("no", { status: 400 });
        const file = clubFileAbs(params.bookId, kind);
        const mime = clubMimeAbs(params.bookId, kind);
        if (existsSync(file)) unlinkSync(file);
        if (existsSync(mime)) unlinkSync(mime);
        return Response.json({ ok: true });
      },
    },
  },
});
