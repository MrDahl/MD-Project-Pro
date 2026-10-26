import { useCallback, useEffect, useRef } from "react";

export interface MiniRow {
  /** 0-based task row (below the stage rows) */
  row: number;
  start: number;
  end: number;
  color: string;
  critical: boolean;
}

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  rows: MiniRow[];
  /** total rows in the chart (stage rows + task rows) */
  rowCount: number;
  stageRows: number;
  minDay: number;
  days: number;
  colW: number;
  labelW: number;
  headerH: number;
  rowH: number;
}

const H = 64;

/** Whole project in miniature. Click or drag to jump; the frame shows what is visible in the chart. */
export function GanttMinimap({ scrollRef, rows, rowCount, stageRows, minDay, days, colW, labelW, headerH, rowH }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Draw the tasks
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const draw = () => {
      const w = wrap.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = H * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, H);
      const total = Math.max(1, rowCount);
      const rh = Math.max(1.5, Math.min(4, H / total));
      for (const r of rows) {
        const x = ((r.start - minDay) / Math.max(1, days)) * w;
        const x2 = ((r.end + 1 - minDay) / Math.max(1, days)) * w;
        const y = ((stageRows + r.row) / total) * (H - rh);
        ctx.fillStyle = r.critical ? "#ef4444" : r.color;
        ctx.fillRect(x, y, Math.max(1.5, x2 - x), rh);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [rows, rowCount, stageRows, minDay, days]);

  // Move the frame when the chart scrolls (no React state: updated straight in the DOM)
  const place = useCallback(() => {
    const el = scrollRef.current;
    const frame = frameRef.current;
    const wrap = wrapRef.current;
    if (!el || !frame || !wrap) return;
    const w = wrap.clientWidth;
    const tl = days * colW;
    const left = Math.max(0, el.scrollLeft) / tl;
    const width = Math.min(1 - left, (el.clientWidth - labelW) / tl);
    const total = Math.max(1, rowCount) * rowH;
    const top = Math.max(0, el.scrollTop - headerH) / total;
    const height = Math.min(1 - top, el.clientHeight / total);
    frame.style.left = `${left * w}px`;
    frame.style.width = `${Math.max(6, width * w)}px`;
    frame.style.top = `${top * H}px`;
    frame.style.height = `${Math.max(8, height * H)}px`;
  }, [scrollRef, days, colW, labelW, rowCount, rowH, headerH]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    place();
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      el.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, place]);

  const go = (clientX: number, clientY: number) => {
    const el = scrollRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const r = wrap.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (clientY - r.top) / H));
    el.scrollLeft = fx * days * colW - (el.clientWidth - labelW) / 2;
    el.scrollTop = headerH + fy * Math.max(1, rowCount) * rowH - el.clientHeight / 2;
  };

  return (
    <div
      ref={wrapRef}
      data-testid="minimap"
      role="presentation"
      aria-label="Minikort over hele projektet. Klik eller træk for at hoppe."
      title="Hele projektet. Klik eller træk for at hoppe."
      className="relative w-full rounded-lg border border-slate-200 bg-white overflow-hidden cursor-pointer touch-none select-none"
      style={{ height: H }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        go(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) go(e.clientX, e.clientY);
      }}
    >
      <canvas ref={canvasRef} className="block" />
      <div ref={frameRef} data-testid="minimap-frame" className="absolute border-2 border-sky-500 bg-sky-400/15 rounded-sm pointer-events-none" />
    </div>
  );
}
