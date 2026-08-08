import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addOrder, getWorkerDashboard, markAttendance } from "@/lib/team.functions";
import { clearSession, money, readSession, type Session } from "@/lib/session";

export const Route = createFileRoute("/worker")({
  head: () => ({
    meta: [
      { title: "My Day — Worksy" },
      {
        name: "description",
        content: "Mark yourself present or absent and record the orders you collected today.",
      },
      { property: "og:title", content: "My Day — Worksy" },
      {
        property: "og:description",
        content: "One-tap attendance and quick order entry for workers.",
      },
    ],
  }),
  component: WorkerPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function WorkerPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const qc = useQueryClient();

  const fetchDash = useServerFn(getWorkerDashboard);
  const mark = useServerFn(markAttendance);
  const create = useServerFn(addOrder);

  useEffect(() => {
    const s = readSession();
    if (!s) navigate({ to: "/" });
    else if (s.isAdmin) navigate({ to: "/admin" });
    else setSession(s);
  }, [navigate]);

  const code = session?.code ?? "";
  const dash = useQuery({
    queryKey: ["worker", code],
    enabled: !!code,
    queryFn: () => fetchDash({ data: { code } }),
  });

  const attendanceMut = useMutation({
    mutationFn: (status: "present" | "absent") => mark({ data: { code, status } }),
    onSuccess: (r) => {
      toast.success(r.status === "present" ? "Marked present ✅" : "Marked absent 🌙");
      qc.invalidateQueries({ queryKey: ["worker", code] });
    },
    onError: () => toast.error("Could not save attendance."),
  });

  const [form, setForm] = useState({ customerName: "", orderDetails: "", price: "", pricePaid: "" });
  const orderMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          code,
          customerName: form.customerName,
          orderDetails: form.orderDetails,
          price: Number(form.price || 0),
          pricePaid: Number(form.pricePaid || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Order saved 🎉");
      setForm({ customerName: "", orderDetails: "", price: "", pricePaid: "" });
      qc.invalidateQueries({ queryKey: ["worker", code] });
    },
    onError: () => toast.error("Please fill name, order and valid amounts."),
  });

  if (!session) return null;

  const data = dash.data;
  const todayStatus = data?.attendance.find((a) => a.day === today())?.status ?? null;
  const present = data?.attendance.filter((a) => a.status === "present").length ?? 0;
  const absent = data?.attendance.filter((a) => a.status === "absent").length ?? 0;
  const collected = data?.orders.reduce((s, o) => s + Number(o.price_paid), 0) ?? 0;
  const pending = data?.orders.reduce((s, o) => s + Number(o.price_left), 0) ?? 0;
  const left = Math.max(Number(form.price || 0) - Number(form.pricePaid || 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted-foreground">Hey there 👋</p>
          <h1 className="text-3xl font-extrabold">{session.name}</h1>
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

      <section className="card-fun mb-6 p-6 pop-in">
        <h2 className="text-xl font-extrabold">Today, {new Date().toDateString()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {todayStatus
            ? `You are marked ${todayStatus} today. Tap again to change it.`
            : "You haven't marked your attendance yet."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => attendanceMut.mutate("present")}
            className={`rounded-2xl px-4 py-6 text-lg font-extrabold transition active:translate-y-0.5 ${
              todayStatus === "present"
                ? "bg-mint text-mint-foreground ring-4 ring-mint/50"
                : "bg-secondary text-secondary-foreground hover:bg-mint hover:text-mint-foreground"
            }`}
          >
            ✅ Present
          </button>
          <button
            onClick={() => attendanceMut.mutate("absent")}
            className={`rounded-2xl px-4 py-6 text-lg font-extrabold transition active:translate-y-0.5 ${
              todayStatus === "absent"
                ? "bg-berry text-berry-foreground ring-4 ring-berry/40"
                : "bg-secondary text-secondary-foreground hover:bg-berry hover:text-berry-foreground"
            }`}
          >
            🌙 Absent
          </button>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Days present" value={String(present)} tone="bg-mint text-mint-foreground" />
        <Stat label="Days absent" value={String(absent)} tone="bg-sunny text-sunny-foreground" />
        <Stat label="Collected" value={money(collected)} tone="bg-sky text-sky-foreground" />
        <Stat
          label="Still pending"
          value={money(pending)}
          tone="bg-primary text-primary-foreground"
        />
      </section>

      <section className="card-fun mb-6 p-6">
        <h2 className="text-xl font-extrabold">Add an order</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            orderMut.mutate();
          }}
        >
          <Field
            label="Customer name"
            value={form.customerName}
            onChange={(v) => setForm({ ...form, customerName: v })}
            placeholder="Meena Traders"
          />
          <Field
            label="Order"
            value={form.orderDetails}
            onChange={(v) => setForm({ ...form, orderDetails: v })}
            placeholder="20 cartons of tape"
          />
          <Field
            label="Price"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            placeholder="12000"
            type="number"
          />
          <Field
            label="Price paid"
            value={form.pricePaid}
            onChange={(v) => setForm({ ...form, pricePaid: v })}
            placeholder="8000"
            type="number"
          />
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 font-bold md:col-span-2">
            <span>Price left</span>
            <span className="text-lg text-primary">{money(left)}</span>
          </div>
          <button
            type="submit"
            disabled={orderMut.isPending}
            className="rounded-xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60 md:col-span-2"
          >
            {orderMut.isPending ? "Saving…" : "Save order"}
          </button>
        </form>
      </section>

      <section className="card-fun p-6">
        <h2 className="text-xl font-extrabold">My orders</h2>
        {dash.isLoading ? (
          <p className="mt-3 text-muted-foreground">Loading…</p>
        ) : !data?.orders.length ? (
          <p className="mt-3 text-muted-foreground">No orders yet — add your first one above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.orders.map((o) => (
              <li
                key={o.id}
                className="rounded-2xl border-2 border-border bg-background/60 p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-extrabold">{o.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{o.order_details}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                  <span className="rounded-lg bg-secondary px-3 py-1">Price {money(o.price)}</span>
                  <span className="rounded-lg bg-mint px-3 py-1 text-mint-foreground">
                    Paid {money(o.price_paid)}
                  </span>
                  <span
                    className={`rounded-lg px-3 py-1 ${
                      Number(o.price_left) > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-sky text-sky-foreground"
                    }`}
                  >
                    Left {money(o.price_left)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold outline-none transition focus:border-primary"
      />
    </label>
  );
}
