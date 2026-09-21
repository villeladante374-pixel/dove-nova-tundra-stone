import { createFileRoute } from "@tanstack/react-router";
import { diskMergePack, diskPublicPack } from "@/lib/club-vault";

export const Route = createFileRoute("/api/club")({
  server: {
    handlers: {
      GET: async () => {
        const pack = await diskPublicPack();
        return Response.json(pack);
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as Parameters<typeof diskMergePack>[0];
        const next = await diskMergePack(body);
        return Response.json({ books: next.books.length, gone: next.goneIds.length, savedAt: next.savedAt });
      },
    },
  },
});
