import { useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { cn } from "@/lib/utils";

type Props = {
  done?: boolean;
  /** Brush radius in px */
  radius?: number;
};

function getClientXY(e: PointerEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return null;
    return { x: t.clientX, y: t.clientY };
  }
  return { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY };
}

export default function ScratchRevealLoader({ done, radius = 30 }: Props) {
  const { progress, active } = useProgress();
  const isVisible = active && !done;
  const pct = Math.round(progress);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // subtle animated hue shift (no pointer required)
  const [t, setT] = useState(0);
  useEffect(() => {
    if (done) return;
    let raf = 0;
    const loop = () => {
      setT((x) => (x + 0.002) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  const hue = useMemo(() => Math.round(210 + 70 * Math.sin(t * Math.PI * 2)), [t]);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.restore();
    // fill black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  };

  const scratchAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = canvas.width / Math.max(1, window.innerWidth);
    const px = x * dpr;
    const py = y * dpr;

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(px, py, radius * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const scratchLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    // stamp circles along the path so fast drags don't leave gaps
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(12, radius * 0.35);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= n; i++) {
      const a = i / n;
      scratchAt(from.x + dx * a, from.y + dy * a);
    }
  };

  const tick = () => {
    rafRef.current = null;
    const pending = pendingPointRef.current;
    if (!pending) return;

    const last = lastPointRef.current;
    if (last) scratchLine(last, pending);
    else scratchAt(pending.x, pending.y);

    lastPointRef.current = pending;
    pendingPointRef.current = null;
  };

  const scheduleScratch = (p: { x: number; y: number }) => {
    pendingPointRef.current = p;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // Reset canvas fill whenever it becomes visible again
    if (!isVisible) return;
    resizeCanvas();
    lastPointRef.current = null;
    pendingPointRef.current = null;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make sure touch doesn't scroll/pinch-zoom during scratch.
    canvas.style.touchAction = "none";

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      draggingRef.current = true;
      lastPointRef.current = null;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      scheduleScratch({ x: e.clientX, y: e.clientY });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      // In some browsers, draggingRef can get stuck true; ensure primary button still held.
      if ((e.buttons & 1) === 0) return;
      scheduleScratch({ x: e.clientX, y: e.clientY });
    };

    const onPointerUp = (e?: PointerEvent) => {
      draggingRef.current = false;
      lastPointRef.current = null;
      if (e) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerup", onPointerUp, { passive: true });
    canvas.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isVisible]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] select-none transition-opacity duration-700",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* gradient behind the scratch-off mask */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1200px circle at 30% 20%, hsla(${hue}, 90%, 65%, 0.35), transparent 55%),
                       radial-gradient(900px circle at 70% 60%, hsla(${(hue + 80) % 360}, 90%, 60%, 0.25), transparent 60%),
                       linear-gradient(120deg, hsla(${(hue + 30) % 360}, 70%, 18%, 0.95), hsla(${(hue + 190) % 360}, 70%, 12%, 0.95))`,
        }}
      />

      {/* black overlay you "erase" */}
      <canvas ref={canvasRef} className="absolute inset-0 cursor-none" />

      {/* copy + progress (doesn't intercept pointer events) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 px-6 pointer-events-none">
        <div className="text-center max-w-md">
          <div className="font-display text-2xl tracking-tight">Loading the Universe</div>
          <div className="mt-2 text-sm text-white/60">
            Drag to erase the darkness while it loads
          </div>
        </div>

        <div className="mt-8 w-full max-w-sm">
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/70 transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/60">
            <span>{pct}%</span>
            <span className="hidden sm:inline">drag • swipe • explore</span>
            <span className="sm:hidden">swipe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

