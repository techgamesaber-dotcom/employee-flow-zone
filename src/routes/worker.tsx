import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addOrder, deleteOrder, getWorkerDashboard, markAttendance, updateOrder } from "@/lib/team.functions";
import { clearSession, money, readSession, saveSession, type Session, type CompanyAccess } from "@/lib/session";
import { UpdateButton } from "@/components/UpdateButton";

export const Route = createFileRoute("/worker")({
  head: () => ({ meta: [{ title: "Worksy — My Creative Workspace" }, { name: "description", content: "A fun, secure workspace for your company." }] }),
  component: WorkerPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const companyFeatures: Record<string, string[]> = {
  "section-a-origami": ["Origami Studio", "Creation Gallery", "Folding Challenges", "Paper & Materials", "Custom Requests", "Workshops"],
  "world-of-tech": ["App Idea Lab", "Build Board", "UI/UX Studio", "Testing Lab", "Bug Hunt", "Launch Center"],
  "world-of-designing": ["Interior Studio", "Room Planner", "Moodboards", "Client Projects", "Company Planner", "Strategy Board"],
  "world-of-colours": ["Art Studio", "Sketchbook", "Painting Projects", "Artwork Gallery", "Creative Challenges", "Portfolio"],
};

function WorkerPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<CompanyAccess | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ customerName: "", orderDetails: "", price: "", pricePaid: "", cost: "" });
  const [editForm, setEditForm] = useState({ customerName: "", orderDetails: "", price: "", pricePaid: "", cost: "" });
  const qc = useQueryClient();
  const fetchDash = useServerFn(getWorkerDashboard);
  const mark = useServerFn(markAttendance);
  const create = useServerFn(addOrder);
  const edit = useServerFn(updateOrder);
  const remove = useServerFn(deleteOrder);

  useEffect(() => {
    const s = readSession();
    if (!s) { navigate({ to: "/" }); return; }
    if (s.isAdmin) { navigate({ to: "/admin" }); return; }
    setSession(s);
    setCompany(s.companies.find((c) => c.id === s.activeCompanyId) ?? s.companies[0] ?? null);
  }, [navigate]);

  const companyId = company?.id ?? "";
  const dash = useQuery({ queryKey: ["worker", session?.code, companyId], enabled: !!session?.code && !!companyId, queryFn: () => fetchDash({ data: { code: session!.code, companyId } }) });
  const attendanceMut = useMutation({ mutationFn: (status: "present" | "absent") => mark({ data: { code: session!.code, companyId, status } }), onSuccess: (r) => { toast.success(r.status === "present" ? "Present! Your streak lives 🔥" : "Marked absent 🌙"); qc.invalidateQueries({ queryKey: ["worker", session?.code, companyId] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save attendance.") });
  const orderMut = useMutation({ mutationFn: () => create({ data: { code: session!.code, companyId, customerName: form.customerName, orderDetails: form.orderDetails, price: Number(form.price || 0), pricePaid: Number(form.pricePaid || 0), cost: Number(form.cost || 0) } }), onSuccess: () => { toast.success("Order added 🎉 +20 XP"); setForm({ customerName: "", orderDetails: "", price: "", pricePaid: "", cost: "" }); qc.invalidateQueries({ queryKey: ["worker", session?.code, companyId] }); }, onError: () => toast.error("Please fill in the order details and amounts.") });
  const editMut = useMutation({ mutationFn: (id: string) => edit({ data: { code: session!.code, companyId, id, customerName: editForm.customerName, orderDetails: editForm.orderDetails, price: Number(editForm.price || 0), pricePaid: Number(editForm.pricePaid || 0), cost: Number(editForm.cost || 0) } }), onSuccess: () => { toast.success("Order updated ✏️"); setEditingId(null); qc.invalidateQueries({ queryKey: ["worker", session?.code, companyId] }); }, onError: () => toast.error("Could not update this order.") });
  const deleteMut = useMutation({ mutationFn: (id: string) => remove({ data: { code: session!.code, companyId, id } }), onSuccess: () => { toast.success("Order removed 🗑️"); qc.invalidateQueries({ queryKey: ["worker", session?.code, companyId] }); }, onError: () => toast.error("Could not delete this order.") });

  const data = dash.data;
  const todayStatus = data?.attendance.find((a) => a.day === today())?.status ?? null;
  const present = data?.attendance.filter((a) => a.status === "present").length ?? 0;
  const absent = data?.attendance.filter((a) => a.status === "absent").length ?? 0;
  const collected = data?.orders.reduce((s, o) => s + Number(o.price_paid), 0) ?? 0;
  const pending = data?.orders.reduce((s, o) => s + Number(o.price_left), 0) ?? 0;
  const xp = present * 20 + (data?.orders.length ?? 0) * 20;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const streak = useMemo(() => Math.min(present, 7), [present]);
  const left = Math.max(Number(form.price || 0) - Number(form.pricePaid || 0), 0);

  function switchCompany(next: CompanyAccess) {
    setCompany(next); setSession((s) => s ? { ...s, activeCompanyId: next.id } : s); const s = readSession(); if (s) saveSession({ ...s, activeCompanyId: next.id });
    toast.success(`Welcome to ${next.name} ${next.emoji}`); qc.invalidateQueries();
  }

  if (!session || !company) return <main className="p-8 text-center">Loading your workspace…</main>;
  const features = companyFeatures[company.slug] ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Worksy · {company.emoji} {company.name}</p><h1 className="mt-1 text-3xl font-extrabold">Hey {session.name}! 👋</h1><p className="text-sm font-semibold text-muted-foreground">{company.tagline}</p></div>
        <div className="flex gap-2"><UpdateButton /><button onClick={() => { clearSession(); navigate({ to: "/" }); }} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold hover:bg-secondary">Log out</button></div>
      </header>

      {session.companies.length > 1 && <section className="mb-6 rounded-3xl border-2 border-border bg-card p-4 shadow-sm"><p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Your unlocked worlds</p><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{session.companies.map((c) => <button key={c.id} onClick={() => switchCompany(c)} className={`rounded-2xl p-4 text-left font-extrabold transition hover:-translate-y-0.5 ${c.id === company.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary"}`}><span className="text-2xl">{c.emoji}</span><span className="mt-2 block text-sm">{c.name}</span></button>)}</div></section>}

      <section className="mb-6 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="card-fun overflow-hidden p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wider opacity-70">My level</p><p className="mt-1 text-4xl font-extrabold">Level {level} 🚀</p><p className="mt-1 font-semibold opacity-80">{xp} XP · {streak}-day momentum</p></div><div className="rounded-2xl bg-background/60 px-4 py-3 text-center"><div className="text-2xl">🔥</div><div className="text-xs font-extrabold">STREAK</div></div></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-background/60"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, xp % 100)}%` }} /></div><p className="mt-2 text-xs font-bold opacity-70">Next level: {100 - (xp % 100)} XP to go</p></div>
        <Stat label="Present" value={String(present)} emoji="✅" /><Stat label="Orders" value={String(data?.orders.length ?? 0)} emoji="📦" />
      </section>

      <section className="mb-6"><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wider text-primary">Your toolbox</p><h2 className="text-2xl font-extrabold">Jump into something fun</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold">{features.length} spaces</span></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{features.map((feature, i) => <button key={feature} onClick={() => toast.success(`${feature} is queued in your workspace ✨`)} className="group rounded-2xl border-2 border-border bg-card p-4 text-left font-extrabold shadow-sm transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-xl">{["✨","🚀","🎯","🧩","🔥","💡"][i % 6]}</div><span>{feature}</span><p className="mt-1 text-xs font-semibold text-muted-foreground">Open workspace →</p></button>)}</div></section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Absent" value={String(absent)} emoji="🌙" /><Stat label="Collected" value={money(collected)} emoji="💰" /><Stat label="Pending" value={money(pending)} emoji="⏳" /><Stat label="Achievements" value={String(Math.min(12, Math.floor(xp / 50)))} emoji="🏆" /></section>

      <section className="card-fun mb-6 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-primary">Today's mission</p><h2 className="text-2xl font-extrabold">Show up. Make something. Win the day. 🎯</h2><p className="mt-1 text-sm text-muted-foreground">Attendance is real work — the fun layer just makes progress easier to see.</p></div><div className="flex gap-2"><button onClick={() => attendanceMut.mutate("present")} className={`rounded-2xl px-5 py-4 font-extrabold transition ${todayStatus === "present" ? "bg-mint text-mint-foreground ring-4 ring-mint/40" : "bg-secondary hover:bg-mint"}`}>✅ Present</button><button onClick={() => attendanceMut.mutate("absent")} className={`rounded-2xl px-5 py-4 font-extrabold transition ${todayStatus === "absent" ? "bg-berry text-berry-foreground ring-4 ring-berry/30" : "bg-secondary hover:bg-berry"}`}>🌙 Absent</button></div></div></section>

      <section className="card-fun mb-6 p-6"><h2 className="text-xl font-extrabold">Add an order</h2><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); orderMut.mutate(); }}><Field label="Customer name" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} placeholder="Meena Traders" /><Field label="Order" value={form.orderDetails} onChange={(v) => setForm({ ...form, orderDetails: v })} placeholder="20 cartons of tape" /><Field label="Price" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="12000" type="number" /><Field label="Price paid" value={form.pricePaid} onChange={(v) => setForm({ ...form, pricePaid: v })} placeholder="8000" type="number" /><Field label="Money spent making it" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} placeholder="4000" type="number" /><div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 font-bold md:col-span-2"><span>Price left</span><span className="text-lg text-primary">{money(left)}</span></div><button type="submit" disabled={orderMut.isPending} className="rounded-xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground md:col-span-2">{orderMut.isPending ? "Saving…" : "Save order 🎉"}</button></form></section>

      <section className="card-fun p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">My orders</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold">{data?.orders.length ?? 0} total</span></div>{dash.isLoading ? <p className="mt-3 text-muted-foreground">Loading your orders…</p> : !data?.orders.length ? <p className="mt-3 text-muted-foreground">No orders yet — your first one can start your XP streak.</p> : <ul className="mt-4 space-y-3">{data.orders.map((o) => <li key={o.id} className="rounded-2xl border-2 border-border bg-background/60 p-4">{editingId === o.id ? <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); editMut.mutate(o.id); }}><Field label="Customer name" value={editForm.customerName} onChange={(v) => setEditForm({ ...editForm, customerName: v })} /><Field label="Order" value={editForm.orderDetails} onChange={(v) => setEditForm({ ...editForm, orderDetails: v })} /><Field label="Price" type="number" value={editForm.price} onChange={(v) => setEditForm({ ...editForm, price: v })} /><Field label="Price paid" type="number" value={editForm.pricePaid} onChange={(v) => setEditForm({ ...editForm, pricePaid: v })} /><Field label="Money spent making it" type="number" value={editForm.cost} onChange={(v) => setEditForm({ ...editForm, cost: v })} /><div className="flex gap-2 md:col-span-2"><button type="submit" disabled={editMut.isPending} className="flex-1 rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground">Save changes</button><button type="button" onClick={() => setEditingId(null)} className="rounded-xl border-2 border-border bg-card px-4 py-3 font-bold">Cancel</button></div></form> : <><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-lg font-extrabold">{o.customer_name}</p><p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p></div><p className="text-sm text-muted-foreground">{o.order_details}</p><div className="mt-3 flex flex-wrap gap-2 text-sm font-bold"><span className="rounded-lg bg-secondary px-3 py-1">Price {money(o.price)}</span><span className="rounded-lg bg-mint px-3 py-1 text-mint-foreground">Paid {money(o.price_paid)}</span><span className="rounded-lg bg-primary px-3 py-1 text-primary-foreground">Left {money(o.price_left)}</span><span className="rounded-lg bg-sunny px-3 py-1 text-sunny-foreground">Spent {money(o.cost ?? 0)}</span><span className="rounded-lg bg-sky px-3 py-1 text-sky-foreground">Profit {money(Number(o.price) - Number(o.cost ?? 0))}</span></div><div className="mt-3 flex gap-2"><button onClick={() => { setEditingId(o.id); setEditForm({ customerName: o.customer_name, orderDetails: o.order_details, price: String(o.price), pricePaid: String(o.price_paid), cost: String(o.cost ?? 0) }); }} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold">✏️ Update</button><button onClick={() => { if (confirm(`Delete the order for ${o.customer_name}?`)) deleteMut.mutate(o.id); }} disabled={deleteMut.isPending} className="rounded-xl bg-berry px-4 py-2 text-sm font-bold text-berry-foreground">🗑️ Delete</button></div></>}</li>)}</ul>}</section>
    </main>
  );
}

function Stat({ label, value, emoji }: { label: string; value: string; emoji: string }) { return <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm"><div className="text-xl">{emoji}</div><p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-extrabold">{value}</p></div>; }
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) { return <label className="block"><span className="text-sm font-bold">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold outline-none transition focus:border-primary" /></label>; }
