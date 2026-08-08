import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signInWithCode } from "@/lib/team.functions";
import { readSession, saveSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Worksy — Team Attendance & Order Tracker" },
      {
        name: "description",
        content:
          "Workers mark present or absent in one tap and log every order they collect. Admins see attendance counts, collections and pending money live.",
      },
      { property: "og:title", content: "Worksy — Team Attendance & Order Tracker" },
      {
        property: "og:description",
        content: "One-tap attendance and order collection tracking for your team.",
      },
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
          <div className="mx-auto mb-4 flex h-16 w-16 rotate-[-6deg] items-center justify-center rounded-3xl bg-primary text-3xl shadow-lg">
            🧡
          </div>
          <h1 className="text-4xl font-extrabold">Worksy</h1>
          <p className="mt-2 text-muted-foreground">
            Mark your day. Log your orders. Keep the money clear.
          </p>
        </div>

        <form onSubmit={submit} className="card-fun p-6">
          <label htmlFor="code" className="text-sm font-bold">
            Your worker code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. RAVI01"
            maxLength={20}
            className="mt-2 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 text-lg font-bold tracking-widest outline-none transition focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Let me in"}
          </button>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-mint px-3 py-2 font-bold text-mint-foreground">
              Worker demo: RAVI01
            </div>
            <div className="rounded-xl bg-sky px-3 py-2 font-bold text-sky-foreground">
              Admin demo: ADMIN2024
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
