import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const APP_VERSION = "2.0.0";

/**
 * Clears cached app files + query data and reloads the newest deployed build,
 * keeping the user signed in. This is the single user-facing update path.
 */
export function UpdateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleUpdate() {
    if (busy) return;
    setBusy(true);
    toast.success("Getting the latest version… ✨");
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
      /* best effort — reload anyway */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    window.location.replace(url.toString());
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 rounded-xl border-2 border-border bg-card p-1 shadow-sm">
        <button
          onClick={handleUpdate}
          disabled={busy}
          title={`Update to Worksy ${APP_VERSION}`}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-extrabold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "Updating…" : "🔄 Update app"}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Show update notes"
          className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-muted-foreground hover:bg-secondary"
        >
          v{APP_VERSION}
        </button>
      </div>
      {open && (
        <div className="absolute right-0 z-[100] mt-2 w-80 rounded-2xl border-2 border-border bg-card p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-wider text-primary">Latest release</p><h3 className="mt-1 text-lg font-extrabold">Worksy {APP_VERSION}</h3></div>
            <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 font-bold hover:bg-secondary">✕</button>
          </div>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-muted-foreground">
            <li>🎨 Smoother Canva-style workspace editing</li>
            <li>🔍 Canvas zoom, grid toggle and fullscreen</li>
            <li>📝 Mixed-format exam builder and grading</li>
            <li>🏆 Delivery points, levels and leaderboard</li>
            <li>📱 Polished responsive dashboards</li>
          </ul>
          <button onClick={handleUpdate} disabled={busy} className="mt-4 w-full rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "Updating…" : "Update to latest →"}</button>
        </div>
      )}
    </div>
  );
}
