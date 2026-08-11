import { useRef, useState } from "react";

export type CanvasElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  content: Record<string, any>;
};

export const CANVAS_W = 1200;
export const CANVAS_H = 1600;
const GRID = 10;
const snap = (n: number) => Math.round(n / GRID) * GRID;

export function youtubeEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
  } catch {
    /* not a url yet */
  }
  return null;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/60 p-3 text-center text-xs font-extrabold text-muted-foreground">
      {label}
    </div>
  );
}

export function ElementView({ el }: { el: CanvasElement }) {
  const c: any = el.content ?? {};
  switch (el.type) {
    case "heading":
      return <h2 className="font-extrabold leading-tight" style={{ fontSize: c.size ?? 34, color: c.color || undefined, textAlign: c.align ?? "left" }}>{c.text || "Your heading"}</h2>;
    case "text":
      return <p className="whitespace-pre-wrap font-semibold leading-relaxed" style={{ fontSize: c.size ?? 16, color: c.color || undefined, textAlign: c.align ?? "left" }}>{c.text || "Write something here…"}</p>;
    case "image":
      return c.url ? <img src={c.url} alt={c.alt || "Workspace image"} className="h-full w-full rounded-xl object-cover" /> : <Empty label="🖼️ Upload a photo" />;
    case "video":
      return c.url ? <video src={c.url} controls className="h-full w-full rounded-xl bg-black object-contain" /> : <Empty label="🎬 Upload a video" />;
    case "youtube": {
      const embed = youtubeEmbed(c.url ?? "");
      return embed ? <iframe className="h-full w-full rounded-xl" src={embed} title="YouTube video" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen /> : <Empty label="▶️ Paste a YouTube link" />;
    }
    case "link":
      return <a href={c.url || "#"} target="_blank" rel="noreferrer" className="flex h-full w-full items-center gap-3 rounded-xl border-2 border-border bg-card px-4 font-extrabold hover:border-primary"><span className="text-xl">🔗</span><span className="truncate">{c.label || c.url || "Add a link"}</span></a>;
    case "file":
      return <a href={c.url || "#"} target="_blank" rel="noreferrer" className="flex h-full w-full items-center gap-3 rounded-xl border-2 border-border bg-card px-4 font-extrabold hover:border-primary"><span className="text-xl">📄</span><span className="truncate">{c.name || "Upload a document"}</span></a>;
    case "gallery": {
      const urls: string[] = (c.urls ?? []).filter(Boolean);
      if (!urls.length) return <Empty label="🖼️🖼️ Upload gallery photos" />;
      return <div className="grid h-full w-full grid-cols-3 gap-2 overflow-hidden">{urls.map((u, i) => <img key={i} src={u} alt={`Gallery ${i + 1}`} className="h-full w-full rounded-lg object-cover" />)}</div>;
    }
    case "divider":
      return <div className="flex h-full w-full items-center"><div className="h-1 w-full rounded-full" style={{ background: c.color || "hsl(var(--border))" }} /></div>;
    case "shape":
      return <div className="h-full w-full" style={{ background: c.bg || "hsl(var(--secondary))", borderRadius: c.radius ?? 24, border: c.border ? `3px solid ${c.border}` : undefined }} />;
    case "table": {
      const rows: string[][] = c.rows?.length ? c.rows : [["Column A", "Column B"], ["—", "—"]];
      return <div className="h-full w-full overflow-auto rounded-xl border-2 border-border bg-card"><table className="w-full text-left text-sm"><tbody>{rows.map((row, ri) => <tr key={ri} className={ri === 0 ? "bg-secondary" : "border-t border-border"}>{row.map((cell, ci) => <td key={ci} className={`px-3 py-2 ${ri === 0 ? "font-extrabold" : "font-semibold"}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
    }
    default:
      return <Empty label={el.type} />;
  }
}

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; ox: number; oy: number; ow: number; oh: number };

export function CanvasSurface({
  elements,
  editable,
  selectedId,
  onSelect,
  onLive,
  onCommit,
}: {
  elements: CanvasElement[];
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onLive: (id: string, geom: { x: number; y: number; w: number; h: number }) => void;
  onCommit: (id: string, geom: { x: number; y: number; w: number; h: number }) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [showGrid, setShowGrid] = useState(editable);

  function start(e: React.PointerEvent, el: CanvasElement, mode: "move" | "resize") {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(el.id);
    setDrag({ id: el.id, mode, startX: e.clientX, startY: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h });
  }

  function move(e: React.PointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / zoom;
    const dy = (e.clientY - drag.startY) / zoom;
    const geom = drag.mode === "move"
      ? { x: Math.max(0, snap(drag.ox + dx)), y: Math.max(0, snap(drag.oy + dy)), w: drag.ow, h: drag.oh }
      : { x: drag.ox, y: drag.oy, w: Math.max(60, snap(drag.ow + dx)), h: Math.max(40, snap(drag.oh + dy)) };
    onLive(drag.id, geom);
  }

  function end() {
    if (!drag) return;
    const el = elements.find((x) => x.id === drag.id);
    if (el) onCommit(el.id, { x: el.x, y: el.y, w: el.w, h: el.h });
    setDrag(null);
  }

  function changeZoom(delta: number) {
    setZoom((z) => Math.min(1.25, Math.max(0.4, Number((z + delta).toFixed(2)))));
  }

  async function fullscreen() {
    try {
      if (!document.fullscreenElement) await surface.current?.parentElement?.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* fullscreen may be blocked */ }
  }

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-border bg-background shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeZoom(-0.1)} className="rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold hover:bg-secondary" title="Zoom out">−</button>
          <button type="button" onClick={() => setZoom(0.72)} className="min-w-16 rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold hover:bg-secondary" title="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => changeZoom(0.1)} className="rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold hover:bg-secondary" title="Zoom in">＋</button>
        </div>
        {editable && <div className="flex items-center gap-2"><button type="button" onClick={() => setShowGrid((v) => !v)} className={`rounded-lg px-3 py-1 text-xs font-extrabold ${showGrid ? "bg-secondary" : "border-2 border-border"}`}>▦ Grid</button><button type="button" onClick={fullscreen} className="rounded-lg border-2 border-border px-3 py-1 text-xs font-extrabold hover:bg-secondary">⛶ Fullscreen</button></div>}
      </div>
      <div className="overflow-auto p-5">
        <div
          ref={surface}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onMouseDown={(e) => { if (editable && e.target === e.currentTarget) onSelect(null); }}
          className="relative mx-auto rounded-2xl bg-card shadow-[0_30px_80px_-35px_rgba(0,0,0,.45)]"
          style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, minWidth: CANVAS_W * zoom, minHeight: CANVAS_H * zoom }}
        >
          <div className="relative origin-top-left rounded-2xl bg-card" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})`, backgroundImage: editable && showGrid ? "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)" : undefined, backgroundSize: "20px 20px" }}>
            {elements.map((el) => {
              const selected = editable && selectedId === el.id;
              return <div key={el.id} onPointerDown={(e) => start(e, el, "move")} onPointerMove={move} onPointerUp={end} className={`absolute rounded-xl ${editable ? "cursor-move" : ""} ${selected ? "ring-4 ring-primary/60" : editable ? "hover:ring-2 hover:ring-primary/30" : ""}`} style={{ left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}><div className="pointer-events-none h-full w-full overflow-hidden" style={{ pointerEvents: editable ? "none" : "auto" }}><ElementView el={el} /></div>{selected && <div onPointerDown={(e) => start(e, el, "resize")} onPointerMove={move} onPointerUp={end} title="Drag to resize" className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-card bg-primary" />}</div>;
            })}
            {!elements.length && <p className="absolute left-1/2 top-24 -translate-x-1/2 text-sm font-extrabold text-muted-foreground">{editable ? "This space is empty — use ＋ Add to place anything you like." : "Nothing published in this space yet."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
