import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Clears cached app files + query data and reloads the newest deployed build,
 * keeping the user signed in.
 */
export function UpdateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

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
    <button
      onClick={handleUpdate}
      disabled={busy}
      title="Refresh the newest deployed version"
      className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm disabled:opacity-60"
    >
      {busy ? "Updating…" : "🔄 Update app"}
    </button>
  );
}
