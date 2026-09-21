import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/insertBefore|removeChild|NotFoundError/i.test(raw)) {
    return "El tomo se desajustó al cambiar el tamaño. Vuelve a abrirlo.";
  }
  return raw || "Pasó algo inesperado. Recarga y sigue.";
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center bg-ink text-parchment">
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl">Un momento</h1>
      <p className="max-w-md font-body text-lg text-muted">{errorMessage(error)}</p>
      <button
        type="button"
        className="rounded-full border border-brass/50 bg-plank px-5 py-2 font-display text-sm tracking-wide"
        onClick={() => window.location.assign("/")}
      >
        Volver a la biblioteca
      </button>
    </main>
  );
}
