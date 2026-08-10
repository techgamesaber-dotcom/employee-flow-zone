import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWorkspaceItem, deleteWorkspaceItem, getWorkspaceItems } from "@/lib/workspace.functions";
import { readSession } from "@/lib/session";

const spacesByCompany: Record<string, string[]> = {
  "section-a-origami": ["Origami Studio", "Creation Gallery", "Folding Challenges", "Paper & Materials", "Custom Requests", "Workshops"],
  "world-of-tech": ["App Idea Lab", "Build Board", "UI/UX Studio", "Testing Lab", "Bug Hunt", "Launch Center"],
  "world-of-designing": ["Interior Studio", "Room Planner", "Moodboards", "Client Projects", "Company Planner", "Strategy Board"],
  "world-of-colours": ["Art Studio", "Sketchbook", "Painting Projects", "Artwork Gallery", "Creative Challenges", "Portfolio"],
};

const icons = ["✨", "🚀", "🎯", "🧩", "🔥", "💡"];

export function UpdateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => readSession());
  const [spaceKey, setSpaceKey] = useState("space-1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => setSession(readSession()), [open]);

  const company = session?.companies.find((c) => c.id === session.activeCompanyId) ?? session?.companies[0];
  const companyId = company?.id ?? "";
  const spaceNames = spacesByCompany[company?.slug ?? ""] ?? [];

  const items = useQuery({
    queryKey: ["workspace", session?.code, companyId],
    enabled: open && !!session?.code && !!companyId,
    queryFn: () => getWorkspaceItems({ data: { code: session!.code, companyId } }),
  });

  const add = useMutation({
    mutationFn: () => addWorkspaceItem({ data: { code: session!.code, companyId, spaceKey, title, description } }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      toast.success("Workspace item added ✨");
      qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add item."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkspaceItem({ data: { code: session!.code, companyId, id } }),
    onSuccess: () => {
      toast.success("Workspace item removed.");
      qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove item."),
  });

  const grouped = useMemo(
    () => spaceNames.map((name, i) => ({ key: `space-${i + 1}`, name, items: (items.data ?? []).filter((x) => x.space_key === `space-${i + 1}`) })),
    [spaceNames, items.data]
  );

  // The worker dashboard used to show "queued in your workspace" instead of opening anything.
  // Capture those six toolbox buttons here so the already shared UpdateButton provides the real workspace.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !companyId || !spaceNames.length) return;
      if (button.closest("[data-workspace-modal]")) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const index = spaceNames.findIndex((name) => text.includes(name));
      if (index < 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSpaceKey(`space-${index + 1}`);
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [companyId, spaceNames]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("updated") === "1") {
      url.searchParams.delete("updated");
      window.history.replaceState({}, "", url.toString());
      setOpen(true);
    }
  }, []);

  async function handleUpdate() {
    if (busy) return;
    setBusy(true);
    try {
      await qc.invalidateQueries();
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // A hard reload below is still enough when there is no service worker/cache.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    url.searchParams.set("updated", "1");
    window.location.replace(url.toString());
  }

  return <>
    <div className="flex gap-2">
      <button onClick={() => setOpen(true)} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:bg-secondary" title="Open the six workspace spaces">✨ Spaces</button>
      <button onClick={handleUpdate} disabled={busy} title="Refresh the newest deployed version" className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60">{busy ? "Updating…" : "🔄 Update app"}</button>
    </div>

    {open && <div data-workspace-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border-2 border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-wider text-primary">{company?.emoji} {company?.name}</p><h2 className="text-2xl font-extrabold">Your six workspaces</h2><p className="text-sm font-semibold text-muted-foreground">Choose a workspace to view its library.</p></div>
          <button onClick={() => setOpen(false)} className="rounded-xl border-2 border-border px-3 py-2 font-bold">✕</button>
        </div>

        {session?.isAdmin && <form onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; add.mutate(); }} className="mt-5 rounded-2xl border-2 border-primary/20 bg-secondary p-4">
          <p className="font-extrabold">Admin: add to a workspace</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <select value={spaceKey} onChange={(e) => setSpaceKey(e.target.value)} className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold">{spaceNames.map((name, i) => <option key={name} value={`space-${i + 1}`}>{name}</option>)}</select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-semibold" />
            <button disabled={add.isPending} className="rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground">{add.isPending ? "Adding…" : "＋ Add"}</button>
          </div>
        </form>}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {grouped.map((space, i) => <div key={space.key} className={`rounded-2xl border-2 p-4 ${space.key === spaceKey ? "border-primary bg-primary/5" : "border-border bg-background/60"}`}>
            <button type="button" data-workspace-control onClick={() => setSpaceKey(space.key)} className="w-full text-left">
              <div className="flex items-center justify-between gap-2"><div><span className="text-xl">{icons[i]}</span><h3 className="mt-1 font-extrabold">{space.name}</h3></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold">{space.items.length} items</span></div>
            </button>
            <div className="mt-3 space-y-2">{space.items.map((item) => <div key={item.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-extrabold">{item.title}</p>{item.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.description}</p>}</div>{session?.isAdmin && <button type="button" data-workspace-control onClick={() => remove.mutate(item.id)} disabled={remove.isPending} className="rounded-lg bg-berry/10 px-2 py-1 text-xs font-extrabold text-berry-foreground">− Remove</button>}</div></div>)}{!space.items.length && <p className="text-sm font-semibold text-muted-foreground">Nothing here yet.</p>}</div>
          </div>)}
        </div>
      </section>
    </div>}
  </>;
}

// Small local helpers keep this component self-contained.
function toast(message: string) {
  // Import-free fallback notification; the existing app's toast system is not required for workspace actions.
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("worksy-toast", { detail: message }));
}
