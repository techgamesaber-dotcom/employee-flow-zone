import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addWorkspaceItem, deleteWorkspaceItem, getWorkspaceItems, updateWorkspaceItem } from "@/lib/workspace.functions";
import { readSession } from "@/lib/session";

const spacesByCompany: Record<string, string[]> = {
  "section-a-origami": ["Origami Studio", "Creation Gallery", "Folding Challenges", "Paper & Materials", "Custom Requests", "Workshops"],
  "world-of-tech": ["App Idea Lab", "Build Board", "UI/UX Studio", "Testing Lab", "Bug Hunt", "Launch Center"],
  "world-of-designing": ["Interior Studio", "Room Planner", "Moodboards", "Client Projects", "Company Planner", "Strategy Board"],
  "world-of-colours": ["Art Studio", "Sketchbook", "Painting Projects", "Artwork Gallery", "Creative Challenges", "Portfolio"],
};
const icons = ["✨", "🚀", "🎯", "🧩", "🔥", "💡"];
const SAMPLE_VIDEO = "https://www.youtube.com/embed/dQw4w9WgXcQ";

type Item = { id: string; space_key: string; title: string; description: string | null; created_at?: string };

function getVideoUrl(description: string | null) {
  const match = description?.match(/\[youtube:(https?:\/\/[^\]]+)\]/i);
  return match?.[1] ?? null;
}
function getText(description: string | null) {
  return (description ?? "").replace(/\[youtube:https?:\/\/[^\]]+\]/i, "").trim();
}
function toEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
  } catch {}
  return null;
}

export function UpdateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => readSession());
  const [spaceKey, setSpaceKey] = useState("space-1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");

  useEffect(() => setSession(readSession()), [open]);
  const company = session?.companies.find((c) => c.id === session.activeCompanyId) ?? session?.companies[0];
  const companyId = company?.id ?? "";
  const spaceNames = spacesByCompany[company?.slug ?? ""] ?? [];
  const items = useQuery({ queryKey: ["workspace", session?.code, companyId], enabled: open && !!session?.code && !!companyId, queryFn: () => getWorkspaceItems({ data: { code: session!.code, companyId } }) });

  const add = useMutation({
    mutationFn: () => addWorkspaceItem({ data: { code: session!.code, companyId, spaceKey, title, description: `${videoUrl.trim() ? `[youtube:${videoUrl.trim()}] ` : ""}${description}` } }),
    onSuccess: () => { setTitle(""); setDescription(""); setVideoUrl(""); toast.success("Workspace item added ✨"); qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add item."),
  });
  const edit = useMutation({
    mutationFn: () => updateWorkspaceItem({ data: { code: session!.code, companyId, id: editingId!, title: editTitle, description: `${editVideoUrl.trim() ? `[youtube:${editVideoUrl.trim()}] ` : ""}${editDescription}` } }),
    onSuccess: () => { setEditingId(null); toast.success("Workspace updated ✨"); qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not edit item."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkspaceItem({ data: { code: session!.code, companyId, id } }),
    onSuccess: () => { toast.success("Workspace item removed."); qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove item."),
  });

  const grouped = useMemo(() => spaceNames.map((name, i) => ({ key: `space-${i + 1}`, name, items: (items.data ?? []) as Item[] })).map((space, i) => ({ ...space, items: space.items.filter((x) => x.space_key === `space-${i + 1}`) })), [spaceNames, items.data]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || !companyId || !spaceNames.length || button.closest("[data-workspace-modal]")) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const index = spaceNames.findIndex((name) => text.includes(name));
      if (index < 0) return;
      event.preventDefault(); event.stopPropagation(); setSpaceKey(`space-${index + 1}`); setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [companyId, spaceNames]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("updated") === "1") {
      url.searchParams.delete("updated"); window.history.replaceState({}, "", url.toString()); setOpen(true);
    }
  }, []);

  async function handleUpdate() {
    if (busy) return; setBusy(true); toast.success("Getting the latest version… ✨");
    try {
      await qc.invalidateQueries();
      if ("serviceWorker" in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } catch {}
    const url = new URL(window.location.href); url.searchParams.set("v", Date.now().toString()); url.searchParams.set("updated", "1"); window.location.replace(url.toString());
  }

  function beginEdit(item: Item) {
    setEditingId(item.id); setEditTitle(item.title); setEditDescription(getText(item.description)); setEditVideoUrl(getVideoUrl(item.description) ?? "");
  }

  return <>
    <div className="flex gap-2">
      <button onClick={() => setOpen(true)} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold shadow-sm hover:bg-secondary">✨ Spaces</button>
      <button onClick={handleUpdate} disabled={busy} title="Refresh the newest deployed version" className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm disabled:opacity-60">{busy ? "Updating…" : "🔄 Update app"}</button>
    </div>

    {open && <div data-workspace-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-2 border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-primary">{company?.emoji} {company?.name}</p><h2 className="text-2xl font-extrabold">Your six workspaces</h2><p className="text-sm font-semibold text-muted-foreground">Open a space and edit its layout/content. Admins can add, edit and remove blocks.</p></div><button onClick={() => setOpen(false)} className="rounded-xl border-2 border-border px-3 py-2 font-bold">✕</button></div>

        {session?.isAdmin && <form onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; add.mutate(); }} className="mt-5 rounded-2xl border-2 border-primary/20 bg-secondary p-4"><p className="font-extrabold">Admin: add a block</p><div className="mt-3 grid gap-3 md:grid-cols-4"><select value={spaceKey} onChange={(e) => setSpaceKey(e.target.value)} className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold">{spaceNames.map((name, i) => <option key={name} value={`space-${i + 1}`}>{name}</option>)}</select><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Block title" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Text / description" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold" /><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube URL (optional)" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold" /><button disabled={add.isPending} className="rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground md:col-span-4">{add.isPending ? "Adding…" : "＋ Add block"}</button></div></form>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">{grouped.map((space, i) => {
          const sample = i === 0 && space.items.length === 0;
          const displayItems: (Item | { id: string; sample: true; space_key: string; title: string; description: string })[] = sample ? [{ id: "sample-video", sample: true, space_key: space.key, title: "Sample: Origami tutorial video", description: "[youtube:https://www.youtube.com/watch?v=dQw4w9WgXcQ] This is a sample video block. Admins can add their own YouTube videos." }] : space.items;
          return <div key={space.key} className={`rounded-2xl border-2 p-4 ${space.key === spaceKey ? "border-primary bg-primary/5" : "border-border bg-background/60"}`}>
            <button type="button" data-workspace-control onClick={() => setSpaceKey(space.key)} className="w-full text-left"><div className="flex items-center justify-between gap-2"><div><span className="text-xl">{icons[i]}</span><h3 className="mt-1 font-extrabold">{space.name}</h3></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold">{space.items.length + (sample ? 1 : 0)} blocks</span></div></button>
            <div className="mt-3 space-y-3">{displayItems.map((item) => { const video = toEmbed(getVideoUrl(item.description)); const text = getText(item.description); const isSample = "sample" in item;
              return <div key={item.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-extrabold">{item.title}</p>{text && <p className="mt-1 text-xs font-semibold text-muted-foreground">{text}</p>}</div>{session?.isAdmin && !isSample && <div className="flex gap-2"><button type="button" onClick={() => beginEdit(item)} className="rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold">✏️ Edit</button><button type="button" data-workspace-control onClick={() => remove.mutate(item.id)} disabled={remove.isPending} className="rounded-lg bg-berry/10 px-2 py-1 text-xs font-extrabold text-berry-foreground">− Remove</button></div>}</div>{video && <div className="mt-3 overflow-hidden rounded-xl bg-black"><iframe className="aspect-video w-full" src={video} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}
                {editingId === item.id && <form onSubmit={(e) => { e.preventDefault(); edit.mutate(); }} className="mt-4 grid gap-2 rounded-xl bg-secondary p-3"><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="rounded-lg border-2 border-border bg-card px-3 py-2 font-semibold" /><input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className="rounded-lg border-2 border-border bg-card px-3 py-2 font-semibold" /><input value={editVideoUrl} onChange={(e) => setEditVideoUrl(e.target.value)} placeholder="YouTube URL (optional)" className="rounded-lg border-2 border-border bg-card px-3 py-2 font-semibold" /><div className="flex gap-2"><button disabled={edit.isPending} className="rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground">Save</button><button type="button" onClick={() => setEditingId(null)} className="rounded-lg border-2 border-border px-3 py-2 text-xs font-bold">Cancel</button></div></form>}
              </div>;
            })}{!displayItems.length && <p className="text-sm font-semibold text-muted-foreground">Nothing here yet.</p>}</div>
          </div>;
        })}</div>
      </section>
    </div>}
  </>;
}
