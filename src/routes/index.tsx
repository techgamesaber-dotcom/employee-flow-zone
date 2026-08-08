import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signInWithCode } from "@/lib/team.functions";
import { readSession, saveSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World of Origami Portal" },
      { name: "description", content: "World of Origami employee portal for attendance and order tracking." },
      { property: "og:title", content: "World of Origami Portal" },
      { property: "og:description", content: "Employee attendance and order tracking for World of Origami." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (s) navigate({ to: s.isAdmin ? "/admin" : "/worker" });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const session = await signIn({ data: { code } });
      saveSession(session);
      toast.success(`Welcome back, ${session.name}! 🎉`);
      navigate({ to: session.isAdmin ? "/admin" : "/worker" });
    } catch {
      toast.error("That code didn't match anyone. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md pop-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 rotate-[-6deg] items-center justify-center rounded-3xl bg-primary text-3xl shadow-lg">🧡</div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">World of Origami</p>
          <h1 className="mt-1 text-4xl font-extrabold">Employee Portal</h1>
          <p className="mt-2 text-muted-foreground">Your workspace for attendance, orders and team updates.</p>
        </div>

        <form onSubmit={submit} className="card-fun p-6">
          <label htmlFor="code" className="text-sm font-bold">Your worker code</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RAVI01" maxLength={20} className="mt-2 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 text-lg font-bold tracking-widest outline-none transition focus:border-primary" />
          <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60">{busy ? "Checking…" : "Enter portal"}</button>
        </form>
      </div>
    </main>
  );
}
