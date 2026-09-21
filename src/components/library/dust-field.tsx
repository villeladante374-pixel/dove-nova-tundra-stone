import { useEffect, useRef } from "react";

type Mode = "enter" | "hall";

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  hue: number;
  streak: boolean;
  twinkle: number;
  phase: number;
};

function isLean() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const cores = navigator.hardwareConcurrency || 4;
  return Boolean(nav.connection?.saveData) || cores <= 4 || window.innerWidth < 700;
}

export function DustField({ mode }: { mode: Mode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const node = canvas;
    const gfx = ctx;
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lean = isLean();
    const embers: Ember[] = [];
    const max = still ? 0 : lean ? (mode === "enter" ? 36 : 12) : mode === "enter" ? 72 : 22;

    function resize() {
      const dpr = Math.min(lean ? 1 : 1.25, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      node.width = Math.floor(w * dpr);
      node.height = Math.floor(h * dpr);
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      gfx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(fromBottom = false): Ember {
      const streak = Math.random() < (mode === "enter" ? 0.28 : 0.12);
      const rise = !streak && Math.random() < 0.55;
      return {
        x: Math.random() * w,
        y: fromBottom ? h + 8 + Math.random() * 40 : Math.random() * h,
        vx: (Math.random() - 0.5) * (streak ? 0.45 : 0.18),
        vy: streak
          ? 0.3 + Math.random() * 1.1
          : rise
            ? -0.08 - Math.random() * 0.28
            : 0.05 + Math.random() * 0.16,
        r: streak ? 0.5 + Math.random() * 0.9 : 0.4 + Math.random() * (mode === "enter" ? 1.4 : 1),
        a: mode === "enter" ? 0.22 + Math.random() * 0.4 : 0.1 + Math.random() * 0.18,
        hue: 16 + Math.random() * 26,
        streak,
        twinkle: 0.012 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      };
    }

    function draw(p: Ember) {
      const pulse = 0.55 + 0.45 * Math.sin(p.phase);
      const alpha = Math.max(0, p.a * pulse);
      if (mode === "enter") {
        if (p.streak) {
          const len = 7 + p.r * 12;
          const ang = Math.atan2(p.vy, p.vx || 0.001);
          const tx = p.x - Math.cos(ang) * len;
          const ty = p.y - Math.sin(ang) * len;
          const grad = gfx.createLinearGradient(p.x, p.y, tx, ty);
          grad.addColorStop(0, `hsla(${p.hue}, 95%, 80%, ${alpha})`);
          grad.addColorStop(1, `hsla(${p.hue}, 80%, 40%, 0)`);
          gfx.strokeStyle = grad;
          gfx.lineWidth = Math.max(0.55, p.r);
          gfx.lineCap = "round";
          gfx.beginPath();
          gfx.moveTo(p.x, p.y);
          gfx.lineTo(tx, ty);
          gfx.stroke();
        }
        const glow = p.r * (p.streak ? 2.6 : 4.4);
        const rad = gfx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
        rad.addColorStop(0, `hsla(${p.hue + 8}, 100%, 90%, ${alpha})`);
        rad.addColorStop(0.3, `hsla(${p.hue}, 95%, 62%, ${alpha * 0.4})`);
        rad.addColorStop(1, `hsla(${p.hue}, 90%, 40%, 0)`);
        gfx.fillStyle = rad;
        gfx.beginPath();
        gfx.arc(p.x, p.y, glow, 0, Math.PI * 2);
        gfx.fill();
        return;
      }
      gfx.fillStyle = `hsla(${p.hue}, 90%, 72%, ${alpha})`;
      gfx.beginPath();
      gfx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
      gfx.fill();
    }

    function tick() {
      if (!running) return;
      gfx.clearRect(0, 0, w, h);
      gfx.globalCompositeOperation = "lighter";
      while (embers.length < max) embers.push(spawn(false));
      for (const p of embers) {
        if (!still) {
          p.phase += p.twinkle;
          p.x += p.vx + Math.sin(p.phase * 0.35) * 0.06;
          p.y += p.vy;
        }
        if (p.x < -20) p.x = w + 12;
        if (p.x > w + 20) p.x = -12;
        if (p.y > h + 30 || p.y < -30) {
          const next = spawn(p.vy < 0);
          p.x = next.x;
          p.y = p.vy < 0 ? h + 10 : -10;
          p.vx = next.vx;
          p.vy = next.vy;
          p.r = next.r;
          p.a = next.a;
          p.hue = next.hue;
          p.streak = next.streak;
        }
        draw(p);
      }
      gfx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    }

    function onVis() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="dust" aria-hidden="true" />;
}
