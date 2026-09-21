import { Component, type ReactNode, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookReader } from "@/components/reader/book-reader";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/library-store";

export const Route = createFileRoute("/tomo/$id")({
  ssr: false,
  component: TomoPage,
});

class ReaderGuard extends Component<{ children: ReactNode; reset: string }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  componentDidCatch() {
    /* keep hall alive */
  }
  componentDidUpdate(prev: { reset: string }) {
    if (prev.reset !== this.props.reset && this.state.bad) this.setState({ bad: false });
  }
  render() {
    if (this.state.bad) {
      return (
        <div className="reader-shell flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-display text-xl text-parchment">El tomo se desajustó</p>
          <Button type="button" onClick={() => this.setState({ bad: false })}>
            Reabrir
          </Button>
          <Button asChild variant="wood">
            <Link to="/">Volver</Link>
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TomoPage() {
  const { id } = Route.useParams();
  const hydrate = useLibrary((s) => s.hydrate);
  const hydrated = useLibrary((s) => s.hydrated);
  const book = useLibrary((s) => s.books.find((b) => b.id === id));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const bump = () => window.setTimeout(() => setTick((n) => n + 1), 200);
    window.addEventListener("orientationchange", bump);
    return () => window.removeEventListener("orientationchange", bump);
  }, []);

  if (!hydrated) {
    return (
      <div className="reader-shell flex min-h-dvh items-center justify-center">
        <p className="font-display text-lg text-parchment">El copista abre el tomo…</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="reader-shell flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl text-parchment">Ese tomo no está en el archivo</h1>
        <p className="max-w-md font-body text-lg text-muted">
          Puede que se haya retirado o que el vínculo sea antiguo.
        </p>
        <Button asChild>
          <Link to="/">Volver a la estantería</Link>
        </Button>
      </div>
    );
  }

  return (
    <ReaderGuard reset={`${book.id}-${tick}`}>
      <BookReader key={`${book.id}-${tick}`} book={book} />
    </ReaderGuard>
  );
}
