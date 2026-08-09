import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signInWithCode } from "@/lib/team.functions";
import { readSession, saveSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Worksy — Creative Company Universe" },
    { name: "description", content: "A fun, secure workspace for your creative companies." },
  ]}),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const s = readSession(); if (s) navigate({ to: s.isAdmin ? "/admin" : "/worker" }); }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!code.trim()) return; setBusy(true);
    try {
      const session = await signIn({ data: { code } });
      const activeCompanyId = session.companies[0]?.id;
      saveSession({ ...session, activeCompanyId });
      toast.success(`Welcome back, ${session.name}! 🎉`);
      navigate({ to: session.isAdmin ? "/admin" : "/worker" });
    } catch { toast.error("That code didn't match anyone. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none fixed inset-0 opacity-60" aria-hidden="true">
        <div className="absolute left-[8%] top-[10%] h-32 w-32 rotate-12 rounded-[2rem] bg-sunny/40" />
        <div className="absolute right-[8%] top-[20%] h-40 w-40 -rotate-12 rounded-full bg-sky/40" />
        <div className="absolute bottom-[8%] left-[20%] h-36 w-36 rotate-45 rounded-[3rem] bg-mint/40" />
      </div>
      <div className="relative w-full max-w-2xl pop-in">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 rotate-[-6deg] items-center justify-center rounded-[2rem] bg-primary text-4xl shadow-xl">✨</div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Worksy · Creative Company Universe</p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">Make work feel like yours.</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">One secure home for your teams, ideas, projects and four very different creative worlds.</p>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["🟨","Section A Origami"],["💻","World of Tech"],["🏠","World of Designing"],["🎨","World of Colours"]].map(([emoji,name]) => <div key={name} className="rounded-2xl border-2 border-border bg-card/80 p-4 text-center shadow-sm"><div className="text-2xl">{emoji}</div><p className="mt-1 text-xs font-extrabold">{name}</p></div>)}
        </div>
        <form onSubmit={submit} className="card-fun p-6 md:p-8">
          <label htmlFor="code" className="text-sm font-bold">Your worker code</label>
          <input id="code" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RAVI01" maxLength={20} className="mt-2 w-full rounded-2xl border-2 border-border bg-secondary px-4 py-4 text-lg font-bold tracking-widest outline-none transition focus:border-primary" />
          <button type="submit" disabled={busy} className="mt-4 w-full rounded-2xl bg-primary px-4 py-4 text-lg font-extrabold text-primary-foreground transition hover:brightness-105 disabled:opacity-60">{busy ? "Opening your workspace…" : "Enter my workspace ✨"}</button>
          <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Your account only unlocks companies you are authorized to access.</p>
        </form>
      </div>
    </main>
  );
}
