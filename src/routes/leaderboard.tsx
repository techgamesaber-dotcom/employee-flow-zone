import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/scores.functions";
import { readSession, type CompanyAccess, type Session } from "@/lib/session";
import { UpdateButton } from "@/components/UpdateButton";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Worksy — Team Leaderboard" },
      { name: "description", content: "Delivery points, exam marks, total points and Bronze/Silver levels for every worker." },
      { property: "og:title", content: "Worksy — Team Leaderboard" },
      { property: "og:description", content: "Delivery points, exam marks, total points and Bronze/Silver levels for every worker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<CompanyAccess | null>(null);
  const fetchBoard = useServerFn(getLeaderboard);

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
  const board = useQuery({ queryKey: ["leaderboard", code, companyId], enabled: !!code && !!companyId, queryFn: () => fetchBoard({ data: { code, companyId } }) });

  if (!session || !company) return <main className="p-8 text-center font-bold">Loading leaderboard…</main>;
  const rows = board.data?.rows ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate({ to: session.isAdmin ? "/admin" : "/worker" })} className="text-xs font-extrabold uppercase tracking-wider text-primary hover:underline">← Back to dashboard</button>
          <h1 className="mt-1 text-3xl font-extrabold">🏆 Leaderboard</h1>
          <p className="text-sm font-semibold text-muted-foreground">5 points per completed delivery · 150 points upgrades Bronze to Silver</p>
        </div>
        <UpdateButton />
      </header>

      {board.isLoading && <p className="font-bold text-muted-foreground">Loading…</p>}
      {!board.isLoading && !rows.length && <p className="font-bold text-muted-foreground">No workers to rank yet.</p>}

      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className={`card-fun p-5 ${r.id === board.data?.meId ? "ring-4 ring-primary/40" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-extrabold">{["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`}</span>
                <div>
                  <p className="text-lg font-extrabold">{r.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">Code {r.code}</p>
                </div>
              </div>
              <span className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${r.level === "Silver" ? "bg-sky text-sky-foreground" : "bg-sunny text-sunny-foreground"}`}>
                {r.level === "Silver" ? "🥈 Silver" : "🥉 Bronze"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <Cell label="Deliveries" value={`${r.deliveries}`} />
              <Cell label="Delivery points" value={`${r.deliveryPoints}`} />
              <Cell label="Exam marks" value={`${r.examPoints}${r.examMax ? ` / ${r.examMax}` : ""}`} />
              <Cell label="Total points" value={`${r.totalPoints}`} />
            </div>
            {r.level === "Bronze" && (
              <div className="mt-3">
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (r.totalPoints / 150) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs font-bold text-muted-foreground">{r.toSilver} points to Silver</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}
