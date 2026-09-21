import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/library/brand-mark";
import { HallBackdrop } from "@/components/library/hall-backdrop";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="hall-shell grain relative grid min-h-dvh place-items-center p-6">
      <HallBackdrop />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-brass/30 bg-walnut/90 p-6">
        <BrandMark size="md" className="mb-3" />
        <h1 className="sr-only">Book Club</h1>
        <p className="mt-2 font-body text-base text-muted">
          Entra para guardar tomos en la nube y recuperarlos cuando quieras.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="w-full min-h-11 rounded-md border border-brass/40 bg-plank px-4 py-2 font-display text-sm text-parchment hover:border-brass"
              >
                Continuar con {p.label}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">El acceso está desactivado.</p>
          )}
        </div>
        <Link
          to="/"
          className="mt-5 inline-flex min-h-11 items-center font-body text-base text-muted hover:text-parchment"
        >
          Volver a la sala
        </Link>
      </div>
    </main>
  );
}
