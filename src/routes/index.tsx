import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DustField } from "@/components/library/dust-field";
import { HallBackdrop } from "@/components/library/hall-backdrop";
import { LibraryHall } from "@/components/library/library-hall";
import { WhoIsReading } from "@/components/library/who-is-reading";
import { useLibrary } from "@/lib/library-store";
import { useMarks } from "@/lib/marks-store";
import { useProfiles } from "@/lib/profiles-store";
import { useReader } from "@/lib/reader-store";
import { useReading } from "@/lib/reading-store";
import { useUiPrefs } from "@/lib/ui-prefs";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const readerId = useReader((s) => s.readerId);
  const hydrateLibrary = useLibrary((s) => s.hydrate);
  const logo = useUiPrefs((s) => s.logo);
  const lead = useUiPrefs((s) => s.lead);

  useEffect(() => {
    useProfiles.getState().hydrate();
    useMarks.getState().hydrate();
    useUiPrefs.getState().hydrate();
    useReading.getState().hydrate();
    void hydrateLibrary().catch(() => undefined);
  }, [hydrateLibrary]);

  return (
    <div
      className="relative min-h-dvh h-full"
      style={{ ["--logo" as string]: String(logo), ["--lead" as string]: String(lead) }}
    >
      <div className="scene-back">
        <HallBackdrop motion blur={!readerId} />
        {readerId ? <DustField mode="hall" /> : <DustField mode="enter" />}
      </div>
      <div className="scene-ui">
        {readerId ? <LibraryHall /> : <WhoIsReading backdrop={false} />}
      </div>
    </div>
  );
}
