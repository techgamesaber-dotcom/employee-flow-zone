import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addWorker, deleteOrder, getAdminDashboard, updateOrder } from "@/lib/team.functions";
import { clearSession, money, readSession, type Session } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Control Room — Worksy" },
      {
        name: "description",
        content:
          "See every worker's present and absent count, orders collected, money received and money still pending in one place.",
      },
      { property: "og:title", content: "Admin Control Room — Worksy" },
      {
        property: "og:description",
        content: "Live attendance counts and order collections across your whole team.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const fetchDash = useServerFn(getAdminDashboard);
  const create = useServerFn(addWorker);

  useEffect(() => {
    const s = readSession();
    if (!s) navigate({ to: "/" });
    else if (!s.isAdmin) navigate({ to: "/worker" });
    else setSession(s);
  }, [navigate]);

  const code = session?.code ?? "";
  const dash = useQuery({
    queryKey: ["admin", code],
    enabled: !!code,
    queryFn: () => fetchDash({ data: { code } }),
  });

  const [newWorker, setNewWorker] = useState({ name: "", workerCode: "" });
  const workerMut = useMutation({
    mutationFn: () =>
      create({ data: { code, name: newWorker.name, workerCode: newWorker.workerCode } }),
    onSuccess: () => {
      toast.success("Worker added 🎉");
      setNewWorker({ name: "", workerCode: "" });
      qc.invalidateQueries({ queryKey: ["admin", code] });
    },
    onError: () => toast.error("Could not add worker — code may already be taken."),
  });

  const edit = useServerFn(updateOrder);
  const remove = useServerFn(deleteOrder);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    orderDetails: "",
    price: "",
    pricePaid: "",
  });

  const editMut = useMutation({
    mutationFn: (id: string) =>
      edit({
        data: {
          code,
          id,
          customerName: editForm.customerName,
          orderDetails: editForm.orderDetails,
          price: Number(editForm.price || 0),
          pricePaid: Number(editForm.pricePaid || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Order updated ✏️");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", code] });
    },
    onError: () => toast.error("Could not update this order."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { code, id } }),
    onSuccess: () => {
      toast.success("Order deleted 🗑️");
      qc.invalidateQueries({ queryKey: ["admin", code] });
    },
    onError: () => toast.error("Could not delete this order."),
  });

  if (!session) return null;

  const d = dash.data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted-foreground">Control room</p>
          <h1 className="text-3xl font-extrabold">Everything, at a glance</h1>
        </div>
        <button
          onClick={() => {
            clearSession();
            navigate({ to: "/" });
          }}
          className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold transition hover:bg-secondary"
        >
          Log out
        </button>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Workers" value={String(d?.totals.workers ?? 0)} tone="bg-secondary" />
        <Stat
          label="Present today"
          value={String(d?.totals.presentToday ?? 0)}
          tone="bg-mint text-mint-foreground"
        />
        <Stat
          label="Absent today"
          value={String(d?.totals.absentToday ?? 0)}
          tone="bg-berry text-berry-foreground"
        />
        <Stat label="Order value" value={money(d?.totals.total)} tone="bg-sunny text-sunny-foreground" />
        <Stat label="Collected" value={money(d?.totals.collected)} tone="bg-sky text-sky-foreground" />
        <Stat
          label="Pending"
          value={money(d?.totals.pending)}
          tone="bg-primary text-primary-foreground"
        />
      </section>

      <section className="card-fun mb-6 p-6 pop-in">
        <h2 className="text-xl font-extrabold">Worker scoreboard</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(d?.summary ?? []).map((w) => (
            <div
              key={w.id}
              className="rounded-2xl border-2 border-border bg-background/60 p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold">{w.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">Code {w.code}</p>
                </div>
                <span
                  className={`rounded-lg px-3 py-1 text-xs font-extrabold ${
                    w.todayStatus === "present"
                      ? "bg-mint text-mint-foreground"
                      : w.todayStatus === "absent"
                        ? "bg-berry text-berry-foreground"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {w.todayStatus ? `Today: ${w.todayStatus}` : "Not marked today"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold sm:grid-cols-4">
                <Pill label="Present" value={String(w.present)} />
                <Pill label="Absent" value={String(w.absent)} />
                <Pill label="Orders" value={String(w.orderCount)} />
                <Pill label="Pending" value={money(w.pending)} />
              </div>
            </div>
          ))}
          {!dash.isLoading && !(d?.summary ?? []).length && (
            <p className="text-muted-foreground">No workers yet. Add one below.</p>
          )}
        </div>
      </section>

      <section className="card-fun mb-6 p-6">
        <h2 className="text-xl font-extrabold">All orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Worker</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Order</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Left</th>
              </tr>
            </thead>
            <tbody>
              {(d?.orders ?? []).map((o) => (
                <tr key={o.id} className="border-t-2 border-border font-semibold">
                  <td className="py-3">{o.workerName}</td>
                  <td className="py-3">{o.customer_name}</td>
                  <td className="py-3 text-muted-foreground">{o.order_details}</td>
                  <td className="py-3 text-right">{money(o.price)}</td>
                  <td className="py-3 text-right">{money(o.price_paid)}</td>
                  <td
                    className={`py-3 text-right font-extrabold ${
                      Number(o.price_left) > 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {money(o.price_left)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!dash.isLoading && !(d?.orders ?? []).length && (
            <p className="mt-3 text-muted-foreground">No orders recorded yet.</p>
          )}
        </div>
      </section>

      <section className="card-fun p-6">
        <h2 className="text-xl font-extrabold">Add a worker</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            workerMut.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm font-bold">Name</span>
            <input
              value={newWorker.name}
              onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
              placeholder="Anita Rao"
              className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold outline-none transition focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Login code</span>
            <input
              value={newWorker.workerCode}
              onChange={(e) =>
                setNewWorker({ ...newWorker, workerCode: e.target.value.toUpperCase() })
              }
              placeholder="ANITA04"
              className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold tracking-widest outline-none transition focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={workerMut.isPending}
            className="mt-6 rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
          >
            {workerMut.isPending ? "Adding…" : "Add worker"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl px-4 py-5 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
      <p className="text-[10px] uppercase opacity-70">{label}</p>
      <p className="text-base font-extrabold">{value}</p>
    </div>
  );
}
