import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addElement, deleteElement, getCanvas, updateElement } from "@/lib/canvas.functions";
import { uploadToWorkspace } from "@/lib/upload";
import { readSession, type CompanyAccess, type Session } from "@/lib/session";
import { spaceIcons, spaceIndex, spaceLabel, spaceNames } from "@/lib/spaces";
import { CanvasSurface, type CanvasElement } from "@/components/canvas/CanvasSurface";
import { UpdateButton } from "@/components/UpdateButton";

export const Route = createFileRoute("/space/$spaceKey")({
  head: () => ({
    meta: [
      { title: "Worksy — Workspace canvas" },
      { name: "description", content: "A free-form company workspace with photos, videos, files and notes." },
      { property: "og:title", content: "Worksy — Workspace canvas" },
      { property: "og:description", content: "A free-form company workspace with photos, videos, files and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpacePage,
});

const ADDABLE: { type: string; label: string; icon: string; w: number; h: number; content: Record<string, unknown> }[] = [
  { type: "heading", label: "Heading", icon: "🅷", w: 520, h: 60, content: { text: "New heading", size: 34 } },
  { type: "text", label: "Text box", icon: "📝", w: 340, h: 120, content: { text: "Write something here…", size: 16 } },
  { type: "image", label: "Photo upload", icon: "🖼️", w: 360, h: 240, content: {} },
  { type: "video", label: "Video upload", icon: "🎬", w: 480, h: 270, content: {} },
  { type: "youtube", label: "YouTube video", icon: "▶️", w: 480, h: 270, content: { url: "" } },
  { type: "link", label: "Link", icon: "🔗", w: 320, h: 64, content: { url: "", label: "New link" } },
  { type: "file", label: "Document / file", icon: "📄", w: 320, h: 64, content: {} },
  { type: "gallery", label: "Gallery", icon: "🖼️🖼️", w: 480, h: 200, content: { paths: [] } },
  { type: "divider", label: "Divider", icon: "➖", w: 520, h: 20, content: {} },
  { type: "shape", label: "Shape / box", icon: "⬛", w: 240, h: 160, content: { bg: "#ffe1c4", radius: 24 } },
  { type: "table", label: "Table", icon: "🧮", w: 480, h: 180, content: { rows: [["Column A", "Column B"], ["", ""]] } },
];

function SpacePage() {
  const { spaceKey } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<CompanyAccess | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [els, setEls] = useState<CanvasElement[]>([]);
  const [busy, setBusy] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchCanvas = useServerFn(getCanvas);
  const create = useServerFn(addElement);
  const patch = useServerFn(updateElement);
  const remove = useServerFn(deleteElement);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setSession(s);
    setCompany(s.companies.find((c) => c.id === s.activeCompanyId) ?? s.companies[0] ?? null);
  }, [navigate]);

  const code = session?.code ?? "";
  const companyId = company?.id ?? "";
  const canvas = useQuery({
    queryKey: ["canvas", code, companyId, spaceKey],
    enabled: !!code && !!companyId,
    queryFn: () => fetchCanvas({ data: { code, companyId, spaceKey } }),
  });

  useEffect(() => {
    if (canvas.data) setEls(canvas.data.elements as unknown as CanvasElement[]);
  }, [canvas.data]);

  const isAdmin = !!session?.isAdmin;
  const editable = isAdmin && editMode;
  const selected = els.find((e) => e.id === selectedId) ?? null;
  const names = spaceNames(company?.slug);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["canvas", code, companyId, spaceKey] });
  }

  async function handleAdd(item: (typeof ADDABLE)[number]) {
    setAddOpen(false);
    try {
      const y = 40 + (els.length % 12) * 30;
      await create({ data: { code, companyId, spaceKey, type: item.type, x: 60, y, w: item.w, h: item.h, content: item.content } });
      toast.success(`${item.label} added ✨`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that element.");
    }
  }

  function onLive(id: string, geom: { x: number; y: number; w: number; h: number }) {
    setEls((prev) => prev.map((e) => (e.id === id ? { ...e, ...geom } : e)));
  }

  async function onCommit(id: string, geom: { x: number; y: number; w: number; h: number }) {
    try {
      await patch({ data: { code, companyId, id, ...geom } });
    } catch {
      toast.error("Could not save the new position.");
      refresh();
    }
  }

  function patchContent(id: string, next: Record<string, unknown>) {
    setEls((prev) => prev.map((e) => (e.id === id ? { ...e, content: { ...e.content, ...next } } : e)));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const current = { ...(els.find((e) => e.id === id)?.content ?? {}), ...next };
      delete current["url"];
      delete current["urls"];
      try {
        await patch({ data: { code, companyId, id, content: current } });
      } catch {
        toast.error("Could not save that change.");
      }
    }, 500);
  }

  async function saveContentNow(id: string, next: Record<string, unknown>) {
    const current = { ...(els.find((e) => e.id === id)?.content ?? {}), ...next };
    delete current["url"];
    delete current["urls"];
    await patch({ data: { code, companyId, id, content: current } });
    refresh();
  }

  async function handleUpload(id: string, file: File, field: "path" | "paths", extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const path = await uploadToWorkspace(file, { code, companyId, purpose: "canvas" });
      if (field === "path") await saveContentNow(id, { path, ...(extra ?? {}) });
      else {
        const paths = [...((els.find((e) => e.id === id)?.content?.paths as string[]) ?? []), path];
        await saveContentNow(id, { paths });
      }
      toast.success("Uploaded ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove({ data: { code, companyId, id } });
      setSelectedId(null);
      toast.success("Removed 🗑️");
      refresh();
    } catch {
      toast.error("Could not remove that element.");
    }
  }

  async function changeLayer(id: string, dir: 1 | -1) {
    const el = els.find((e) => e.id === id);
    if (!el) return;
    await patch({ data: { code, companyId, id, z: Math.max(1, el.z + dir) } });
    refresh();
  }

  if (!session || !company) return <main className="p-8 text-center font-bold">Loading your space…</main>;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate({ to: isAdmin ? "/admin" : "/worker" })} className="text-xs font-extrabold uppercase tracking-wider text-primary hover:underline">
            ← Back to dashboard
          </button>
          <h1 className="mt-1 text-3xl font-extrabold">
            {spaceIcons[spaceIndex(spaceKey)]} {spaceLabel(company.slug, spaceKey)}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            {company.emoji} {company.name} · {editable ? "Edit mode — drag, resize and add anything" : "Published view"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setEditMode((v) => !v);
                setSelectedId(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold shadow-sm ${editMode ? "bg-mint text-mint-foreground" : "border-2 border-border bg-card"}`}
            >
              {editMode ? "✅ Done editing" : "✏️ Edit space"}
            </button>
          )}
          {editable && (
            <div className="relative">
              <button onClick={() => setAddOpen((v) => !v)} className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm">
                ＋ Add
              </button>
              {addOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border-2 border-border bg-card p-2 shadow-2xl">
                  {ADDABLE.map((item) => (
                    <button key={item.type} onClick={() => handleAdd(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-extrabold hover:bg-secondary">
                      <span className="w-6 text-center">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <UpdateButton />
        </div>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2">
        {names.map((name, i) => (
          <button
            key={name}
            onClick={() => navigate({ to: "/space/$spaceKey", params: { spaceKey: `space-${i + 1}` } })}
            className={`rounded-xl px-3 py-2 text-xs font-extrabold ${`space-${i + 1}` === spaceKey ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card hover:bg-secondary"}`}
          >
            {spaceIcons[i]} {name}
          </button>
        ))}
      </nav>

      <div className={`grid gap-4 ${editable ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        {canvas.isLoading ? (
          <p className="font-bold text-muted-foreground">Loading canvas…</p>
        ) : (
          <CanvasSurface elements={els} editable={editable} selectedId={selectedId} onSelect={setSelectedId} onLive={onLive} onCommit={onCommit} />
        )}

        {editable && (
          <aside className="h-fit rounded-3xl border-2 border-border bg-card p-4 shadow-sm">
            {!selected ? (
              <p className="text-sm font-semibold text-muted-foreground">Click an element on the canvas to edit it, or use ＋ Add to place a new one. Nothing is mandatory — build the space however you like.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">{selected.type}</p>
                  <div className="flex gap-1">
                    <button onClick={() => changeLayer(selected.id, 1)} title="Bring forward" className="rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold">⬆︎</button>
                    <button onClick={() => changeLayer(selected.id, -1)} title="Send backward" className="rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold">⬇︎</button>
                  </div>
                </div>

                <Inspector element={selected} busy={busy} onPatch={(p) => patchContent(selected.id, p)} onUpload={(file, field, extra) => handleUpload(selected.id, file, field, extra)} onSaveNow={(p) => saveContentNow(selected.id, p)} />

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <NumField label="Width" value={selected.w} onChange={(v) => { onLive(selected.id, { ...selected, w: v }); onCommit(selected.id, { x: selected.x, y: selected.y, w: v, h: selected.h }); }} />
                  <NumField label="Height" value={selected.h} onChange={(v) => { onLive(selected.id, { ...selected, h: v }); onCommit(selected.id, { x: selected.x, y: selected.y, w: selected.w, h: v }); }} />
                </div>

                <button onClick={() => { if (confirm("Delete this element?")) handleDelete(selected.id); }} className="w-full rounded-xl bg-berry px-3 py-2 text-sm font-extrabold text-berry-foreground">
                  🗑️ Delete element
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

function Inspector({
  element,
  busy,
  onPatch,
  onUpload,
  onSaveNow,
}: {
  element: CanvasElement;
  busy: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onUpload: (file: File, field: "path" | "paths", extra?: Record<string, unknown>) => void;
  onSaveNow: (patch: Record<string, unknown>) => void;
}) {
  const c: any = element.content ?? {};
  const t = element.type;

  return (
    <div className="space-y-3">
      {(t === "text" || t === "heading") && (
        <>
          <label className="block text-sm font-bold">
            Text
            <textarea value={c.text ?? ""} onChange={(e) => onPatch({ text: e.target.value })} rows={t === "text" ? 5 : 2} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Font size" value={Number(c.size ?? (t === "heading" ? 34 : 16))} onChange={(v) => onPatch({ size: v })} />
            <label className="block text-sm font-bold">
              Align
              <select value={c.align ?? "left"} onChange={(e) => onPatch({ align: e.target.value })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-2 py-2 font-semibold">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <ColorField label="Text colour" value={c.color ?? "#3a2a1d"} onChange={(v) => onPatch({ color: v })} />
        </>
      )}

      {(t === "image" || t === "video" || t === "file") && (
        <>
          <FileField
            label={t === "image" ? "Upload a photo" : t === "video" ? "Upload a video" : "Upload a document"}
            accept={t === "image" ? "image/*" : t === "video" ? "video/*" : undefined}
            busy={busy}
            onFile={(f) => onUpload(f, "path", t === "file" ? { name: f.name } : undefined)}
          />
          {c.path && <p className="truncate text-xs font-semibold text-muted-foreground">Current: {String(c.path).split("/").pop()}</p>}
          {t === "image" && (
            <label className="block text-sm font-bold">
              Alt text
              <input value={c.alt ?? ""} onChange={(e) => onPatch({ alt: e.target.value })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
            </label>
          )}
          {t === "file" && (
            <label className="block text-sm font-bold">
              File label
              <input value={c.name ?? ""} onChange={(e) => onPatch({ name: e.target.value })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
            </label>
          )}
        </>
      )}

      {t === "youtube" && (
        <label className="block text-sm font-bold">
          YouTube link
          <input value={c.url ?? ""} onChange={(e) => onPatch({ url: e.target.value })} placeholder="https://youtube.com/watch?v=…" className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
        </label>
      )}

      {t === "link" && (
        <>
          <label className="block text-sm font-bold">
            Label
            <input value={c.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
          </label>
          <label className="block text-sm font-bold">
            URL
            <input value={c.url ?? ""} onChange={(e) => onPatch({ url: e.target.value })} placeholder="https://…" className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
          </label>
        </>
      )}

      {t === "gallery" && (
        <>
          <FileField label="Add a photo to the gallery" accept="image/*" busy={busy} onFile={(f) => onUpload(f, "paths")} />
          <p className="text-xs font-semibold text-muted-foreground">{(c.paths ?? []).length} photo(s)</p>
          {!!(c.paths ?? []).length && (
            <button onClick={() => onSaveNow({ paths: (c.paths as string[]).slice(0, -1) })} className="w-full rounded-xl border-2 border-border px-3 py-2 text-xs font-extrabold">
              Remove last photo
            </button>
          )}
        </>
      )}

      {t === "shape" && (
        <>
          <ColorField label="Fill colour" value={c.bg ?? "#ffe1c4"} onChange={(v) => onPatch({ bg: v })} />
          <NumField label="Corner radius" value={Number(c.radius ?? 24)} onChange={(v) => onPatch({ radius: v })} />
        </>
      )}

      {t === "divider" && <ColorField label="Line colour" value={c.color ?? "#e4d3c2"} onChange={(v) => onPatch({ color: v })} />}

      {t === "table" && (
        <label className="block text-sm font-bold">
          Rows — one per line, cells separated by |
          <textarea
            value={(c.rows ?? []).map((r: string[]) => r.join(" | ")).join("\n")}
            onChange={(e) => onPatch({ rows: e.target.value.split("\n").map((line) => line.split("|").map((cell) => cell.trim())) })}
            rows={6}
            className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-mono text-xs font-semibold"
          />
        </label>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-2 border-border bg-secondary px-1" />
    </label>
  );
}

function FileField({ label, accept, busy, onFile }: { label: string; accept?: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        className="mt-1 w-full rounded-xl border-2 border-dashed border-border bg-secondary px-3 py-2 text-xs font-semibold"
      />
      {busy && <span className="text-xs font-bold text-primary">Uploading…</span>}
    </label>
  );
}
