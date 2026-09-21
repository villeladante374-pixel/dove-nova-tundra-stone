import { useEffect, useState } from "react";

type Props = {
  motion?: boolean;
  washSrc?: string | null;
  blur?: boolean;
};

export function HallBackdrop({ motion = false, washSrc = null, blur = false }: Props) {
  const [live, setLive] = useState(true);
  const [allowMotion, setAllowMotion] = useState(motion);

  useEffect(() => {
    if (!motion) {
      setAllowMotion(false);
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const lean = Boolean(nav.connection?.saveData) || (navigator.hardwareConcurrency || 4) <= 4;
    const apply = () => setAllowMotion(!mq.matches && !lean && !document.hidden);
    apply();
    mq.addEventListener("change", apply);
    document.addEventListener("visibilitychange", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, [motion]);

  return (
    <>
      <div className={`hall-bg ${allowMotion ? "is-live" : "is-still"} ${blur ? "is-blur" : ""}`}>
        {allowMotion && live ? (
          <video
            className="hall-video"
            src="/textures/hearth.mp4?v=3"
            poster="/textures/hearth.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setLive(false)}
          />
        ) : (
          <img className="hall-still" src="/textures/hearth.jpg" alt="" />
        )}
      </div>
      <CoverWash src={washSrc} />
      <div className="candle-wash" />
    </>
  );
}

export function CoverWash({ src }: { src: string | null }) {
  const [stack, setStack] = useState<string[]>([]);

  useEffect(() => {
    if (!src) {
      setStack([]);
      return;
    }
    setStack((prev) => {
      if (prev[prev.length - 1] === src) return prev;
      return [...prev, src].slice(-2);
    });
  }, [src]);

  return (
    <div className={`cover-wash ${src ? "is-on" : ""}`} aria-hidden>
      {stack.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          className={`cover-wash-img ${i === stack.length - 1 ? "is-front" : "is-back"}`}
        />
      ))}
    </div>
  );
}
