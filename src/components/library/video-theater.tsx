import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  src: string;
  title: string;
  bookId: string;
  onClose: () => void;
};

export function VideoTheater({ src, title, bookId, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.currentTime = 0;
    const run = el.play();
    if (run) {
      void run.catch(() => {
        el.muted = true;
        void el.play().catch(() => undefined);
      });
    }
  }, [src]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="video-theater" role="dialog" aria-label={title}>
      <button type="button" className="video-theater-dim" aria-label="Cerrar vídeo" onClick={onClose} />
      <div className="video-theater-stage">
        <video
          ref={videoRef}
          className="video-theater-clip"
          src={src}
          controls
          playsInline
          autoPlay
          preload="auto"
        />
        <p className="video-theater-title">{title}</p>
        <div className="video-theater-actions">
          <Button
            onClick={() => {
              onClose();
              void navigate({ to: "/tomo/$id", params: { id: bookId } });
            }}
          >
            <BookOpen className="size-4" />
            Abrir el tomo
          </Button>
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" />
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
