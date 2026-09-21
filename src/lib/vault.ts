import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { BookKind, LeatherId } from "@/lib/types";

export type CloudBookMeta = {
  id: string;
  title: string;
  author: string;
  pageCount: number;
  leather: LeatherId;
  kind: BookKind;
  manuscriptKey?: string;
  hasCover: boolean;
  hasHoverVideo: boolean;
  fileSize?: number;
  createdAt: number;
};

export type CloudBookPayload = CloudBookMeta & {
  pdfB64?: string | null;
  coverB64?: string | null;
  coverMime?: string | null;
  videoB64?: string | null;
  videoMime?: string | null;
};

const CLOUD_MAX = 8 * 1024 * 1024;

function assertSize(b64: string | null | undefined, label: string) {
  if (!b64) return;
  const bytes = Math.ceil((b64.length * 3) / 4);
  if (bytes > CLOUD_MAX) {
    throw new Error(`${label} pesa demasiado para la nube (máximo 8 MB).`);
  }
}

export const listCloudBooks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      author: string;
      page_count: number;
      leather: string;
      kind: string;
      manuscript_key: string | null;
      has_cover: boolean;
      has_hover_video: boolean;
      file_size: number | null;
      created_at: number;
    }>`
      select id, title, author, page_count, leather, kind, manuscript_key,
             has_cover, has_hover_video, file_size, created_at
      from vault_books
      where user_id = ${context.userId}
      order by created_at desc
    `;
    return rows.map(
      (row): CloudBookMeta => ({
        id: row.id,
        title: row.title,
        author: row.author,
        pageCount: Number(row.page_count),
        leather: row.leather as LeatherId,
        kind: row.kind as BookKind,
        manuscriptKey: row.manuscript_key ?? undefined,
        hasCover: Boolean(row.has_cover),
        hasHoverVideo: Boolean(row.has_hover_video),
        fileSize: row.file_size ?? undefined,
        createdAt: Number(row.created_at),
      }),
    );
  });

export const saveCloudBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CloudBookPayload) => input)
  .handler(async ({ context, data }) => {
    assertSize(data.pdfB64, "El PDF");
    assertSize(data.coverB64, "La portada");
    assertSize(data.videoB64, "El vídeo");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into vault_books (
        id, user_id, title, author, page_count, leather, kind, manuscript_key,
        has_cover, has_hover_video, file_size, created_at,
        pdf_b64, cover_b64, cover_mime, video_b64, video_mime
      ) values (
        ${data.id}, ${context.userId}, ${data.title}, ${data.author}, ${data.pageCount},
        ${data.leather}, ${data.kind}, ${data.manuscriptKey ?? null},
        ${data.hasCover}, ${data.hasHoverVideo}, ${data.fileSize ?? null}, ${data.createdAt},
        ${data.pdfB64 ?? null}, ${data.coverB64 ?? null}, ${data.coverMime ?? null},
        ${data.videoB64 ?? null}, ${data.videoMime ?? null}
      )
      on conflict (user_id, id) do update set
        title = excluded.title,
        author = excluded.author,
        page_count = excluded.page_count,
        leather = excluded.leather,
        kind = excluded.kind,
        manuscript_key = excluded.manuscript_key,
        has_cover = excluded.has_cover,
        has_hover_video = excluded.has_hover_video,
        file_size = excluded.file_size,
        pdf_b64 = excluded.pdf_b64,
        cover_b64 = excluded.cover_b64,
        cover_mime = excluded.cover_mime,
        video_b64 = excluded.video_b64,
        video_mime = excluded.video_mime
    `;
    return { ok: true as const };
  });

export const loadCloudBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      author: string;
      page_count: number;
      leather: string;
      kind: string;
      manuscript_key: string | null;
      has_cover: boolean;
      has_hover_video: boolean;
      file_size: number | null;
      created_at: number;
      pdf_b64: string | null;
      cover_b64: string | null;
      cover_mime: string | null;
      video_b64: string | null;
      video_mime: string | null;
    }>`
      select * from vault_books
      where id = ${id} and user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Ese tomo no está en la nube.");
    const payload: CloudBookPayload = {
      id: row.id,
      title: row.title,
      author: row.author,
      pageCount: Number(row.page_count),
      leather: row.leather as LeatherId,
      kind: row.kind as BookKind,
      manuscriptKey: row.manuscript_key ?? undefined,
      hasCover: Boolean(row.has_cover),
      hasHoverVideo: Boolean(row.has_hover_video),
      fileSize: row.file_size ?? undefined,
      createdAt: Number(row.created_at),
      pdfB64: row.pdf_b64,
      coverB64: row.cover_b64,
      coverMime: row.cover_mime,
      videoB64: row.video_b64,
      videoMime: row.video_mime,
    };
    return payload;
  });

export const deleteCloudBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from vault_books where id = ${id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });


async function ensureMarksTable(sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>) {
  await sql.query(`
    create table if not exists vault_marks (
      user_id text primary key,
      scores_json text not null default '{}',
      spots_json text not null default '{}',
      updated_at bigint not null
    )
  `);
}

export type CloudMarksPayload = {
  scores: Record<string, Partial<Record<string, number>>>;
  spots: Record<string, { x: number; y: number }>;
};

export const saveCloudMarks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CloudMarksPayload) => input)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureMarksTable(sql);
    const scoresJson = JSON.stringify(data.scores ?? {});
    const spotsJson = JSON.stringify(data.spots ?? {});
    const now = Date.now();
    await sql`
      insert into vault_marks (user_id, scores_json, spots_json, updated_at)
      values (${context.userId}, ${scoresJson}, ${spotsJson}, ${now})
      on conflict (user_id) do update set
        scores_json = excluded.scores_json,
        spots_json = excluded.spots_json,
        updated_at = excluded.updated_at
    `;
    return { ok: true as const };
  });

export const loadCloudMarks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureMarksTable(sql);
    const rows = await sql<{ scores_json: string; spots_json: string }>`
      select scores_json, spots_json from vault_marks
      where user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    try {
      const scores = JSON.parse(row.scores_json) as CloudMarksPayload["scores"];
      const spots = JSON.parse(row.spots_json) as CloudMarksPayload["spots"];
      return { scores: scores ?? {}, spots: spots ?? {} } satisfies CloudMarksPayload;
    } catch {
      return { scores: {}, spots: {} } satisfies CloudMarksPayload;
    }
  });
