import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addWorker, deleteOrder, deleteWorker, getAdminDashboard, updateOrder, updateWorker } from "@/lib/team.functions";
import { clearSession, money, readSession, type Session } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "World of Origami Portal — Admin" },
    { name: "description", content: "World of Origami employee management, attendance and sales dashboard." },
  ] }),
  component: AdminPage,
});

type WorkerEdit = { id: string; name: string; workerCode: string };

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [workerSearch, setWorkerSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [workerEdit, setWorkerEdit] = useState<WorkerEdit | null>(null);
  const [newWorker, setNewWorker] = useState({ name: "", workerCode: "" });
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", orderDetails: "", price: "", pricePaid: "" });

  const fetchDash = useServerFn(getAdminDashboard);
  const create = useServerFn(addWorker);
  const editWorker = useServerFn(updateWorker);
  const removeWorker = useServerFn(deleteWorker);
  const editOrder = useServerFn(updateOrder);
  const removeOrder = useServerFn(deleteOrder);

  useEffect(() => {
    const s = readSession();
    if (!s) navigate({ to: "/" });
    else if (!s.isAdmin) navigate({ to: "/worker" });
    else setSession(s);
  }, [navigate]);

  const code = session?.code ?? "";
  const dash = useQuery({ queryKey: ["admin", code], enabled: !!code, queryFn: () => fetchDash({ data: { code } }) });
  const d = dash.data;

  const workerMut = useMutation({
    mutationFn: () => create({ data: { code, name: newWorker.name, workerCode: newWorker.workerCode } }),
    onSuccess: () => { toast.success("Worker added 🎉"); setNewWorker({ name: "", workerCode: "" }); qc.invalidateQueries({ queryKey: ["admin", code] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add worker."),
  });
  const workerEditMut = useMutation({
    mutationFn: () => editWorker({ data: { code, workerId: workerEdit!.id, name: workerEdit!.name, workerCode: workerEdit!.workerCode } }),
    onSuccess: () => { toast.success("Worker profile updated ✨"); setWorkerEdit(null); qc.invalidateQueries({ queryKey: ["admin", code] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update worker."),
  });
  const workerDeleteMut = useMutation({
    mutationFn: (workerId: string) => removeWorker({ data: { code, workerId } }),
    onSuccess: () => { toast.success("Worker removed."); qc.invalidateQueries({ queryKey: ["admin", code] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove worker."),
  });
  const orderEditMut = useMutation({
    mutationFn: (id: string) => editOrder({ data: { code, id, customerName: editForm.customerName, orderDetails: editForm.orderDetails, price: Number(editForm.price || 0), pricePaid: Number(editForm.pricePaid || 0) } }),
    onSuccess: () => { toast.success("Order updated ✏️"); setEditingOrder(null); qc.invalidateQueries({ queryKey: ["admin", code] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update order."),
  });
  const orderDeleteMut = useMutation({
    mutationFn: (id: string) => removeOrder({ data: { code, id } }),
    onSuccess: () => { toast.success("Order deleted."); qc.invalidateQueries({ queryKey: ["admin", code] }); },
    onError: () => toast.error("Could not delete order."),
  });

  const workers = useMemo(() => (d?.summary ?? []).filter((w) => `${w.name} ${w.code}`.toLowerCase().includes(workerSearch.toLowerCase())), [d?.summary, workerSearch]);
  const orders = useMemo(() => (d?.orders ?? []).filter((o) => `${o.workerName} ${o.customer_name} ${o.order_details}`.toLowerCase().includes(orderSearch.toLowerCase())), [d?.orders, orderSearch]);

  function exportCsv() {
    const rows = [["Worker", "Customer", "Order", "Price", "Paid", "Pending", "Created"], ...orders.map((o) => [o.workerName, o.customer_name, o.order_details, String(o.price), String(o.price_paid), String(o.price_left), String(o.created_at)])];
    const csv = rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "world-of-origami-orders.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl shadow-md">🧡</div>
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">World of Origami</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Admin Command Center</h1><p className="text-sm font-semibold text-muted-foreground">Welcome, {d?.admin.name ?? session.name} · manage the whole team from one place</p></div>
        </div>
        <div className="flex gap-2"><button onClick={exportCsv} className="rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-extrabold hover:bg-secondary">⬇️ Export CSV</button><button onClick={() => window.print()} className="rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-extrabold hover:bg-secondary">🖨️ Print</button><button onClick={() => { clearSession(); navigate({ to: "/" }); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground">Log out</button></div>
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Workers" value={String(d?.totals.workers ?? 0)} /><Stat label="Present today" value={String(d?.totals.presentToday ?? 0)} /><Stat label="Absent today" value={String(d?.totals.absentToday ?? 0)} /><Stat label="Order value" value={money(d?.totals.total)} /><Stat label="Collected" value={money(d?.totals.collected)} /><Stat label="Pending" value={money(d?.totals.pending)} />
      </section>

      <section className="card-fun mb-7 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">People</p><h2 className="text-2xl font-black">Worker management</h2></div><input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="Search workers…" className="w-full max-w-xs rounded-xl border-2 border-border bg-secondary px-4 py-2.5 font-semibold outline-none focus:border-primary" /></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((w) => <article key={w.id} className="rounded-2xl border-2 border-border bg-background/70 p-4 shadow-sm transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-black">{w.name}</h3><p className="text-xs font-bold text-muted-foreground">Login code · {w.code}</p></div><span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${w.todayStatus === "present" ? "bg-mint text-mint-foreground" : w.todayStatus === "absent" ? "bg-berry text-berry-foreground" : "bg-secondary text-secondary-foreground"}`}>{w.todayStatus ? w.todayStatus.toUpperCase() : "NOT MARKED"}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Pill label="Present" value={String(w.present)} /><Pill label="Absent" value={String(w.absent)} /><Pill label="Orders" value={String(w.orderCount)} /><Pill label="Sales" value={money(w.total)} /><Pill label="Collected" value={money(w.collected)} /><Pill label="Pending" value={money(w.pending)} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setWorkerEdit({ id: w.id, name: w.name, workerCode: w.code })} className="rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm font-extrabold hover:bg-secondary">✏️ Edit</button><button onClick={() => { if (confirm(`Remove ${w.name} from World of Origami? Their related records may also be removed depending on database rules.`)) workerDeleteMut.mutate(w.id); }} className="rounded-xl bg-berry/15 px-3 py-2.5 text-sm font-extrabold text-berry-foreground hover:bg-berry/25">🗑️ Remove</button></div>
          </article>)}
        </div>
        {!dash.isLoading && !workers.length && <p className="mt-4 text-sm font-semibold text-muted-foreground">No workers match your search.</p>}
      </section>

      <section className="card-fun mb-7 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Finance & operations</p><h2 className="text-2xl font-black">Order management</h2></div><div className="flex gap-2"><input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search orders…" className="w-full max-w-xs rounded-xl border-2 border-border bg-secondary px-4 py-2.5 font-semibold outline-none focus:border-primary" /></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b-2 border-border text-[11px] font-black uppercase tracking-wide text-muted-foreground"><th className="px-2 py-3">Worker</th><th className="px-2 py-3">Customer</th><th className="px-2 py-3">Order</th><th className="px-2 py-3 text-right">Price</th><th className="px-2 py-3 text-right">Paid</th><th className="px-2 py-3 text-right">Pending</th><th className="px-2 py-3 text-right">Actions</th></tr></thead><tbody>
          {orders.map((o) => editingOrder === o.id ? <tr key={o.id} className="border-b border-border"><td className="px-2 py-3 font-bold">{o.workerName}</td><td className="px-2 py-3"><CellInput value={editForm.customerName} onChange={(v) => setEditForm({ ...editForm, customerName: v })} /></td><td className="px-2 py-3"><CellInput value={editForm.orderDetails} onChange={(v) => setEditForm({ ...editForm, orderDetails: v })} /></td><td className="px-2 py-3"><CellInput type="number" value={editForm.price} onChange={(v) => setEditForm({ ...editForm, price: v })} /></td><td className="px-2 py-3"><CellInput type="number" value={editForm.pricePaid} onChange={(v) => setEditForm({ ...editForm, pricePaid: v })} /></td><td className="px-2 py-3 text-right font-black text-primary">{money(Math.max(Number(editForm.price || 0) - Number(editForm.pricePaid || 0), 0))}</td><td className="px-2 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => orderEditMut.mutate(o.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Save</button><button onClick={() => setEditingOrder(null)} className="rounded-lg border-2 border-border px-3 py-2 text-xs font-bold">Cancel</button></div></td></tr> : <tr key={o.id} className="border-b border-border font-semibold"><td className="px-2 py-3">{o.workerName}</td><td className="px-2 py-3">{o.customer_name}</td><td className="px-2 py-3 text-muted-foreground">{o.order_details}</td><td className="px-2 py-3 text-right">{money(o.price)}</td><td className="px-2 py-3 text-right">{money(o.price_paid)}</td><td className={`px-2 py-3 text-right font-black ${Number(o.price_left) > 0 ? "text-primary" : "text-muted-foreground"}`}>{money(o.price_left)}</td><td className="px-2 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditingOrder(o.id); setEditForm({ customerName: o.customer_name, orderDetails: o.order_details, price: String(o.price), pricePaid: String(o.price_paid) }); }} className="rounded-lg border-2 border-border px-3 py-2 text-xs font-bold">✏️ Edit</button><button onClick={() => { if (confirm(`Delete order for ${o.customer_name}?`)) orderDeleteMut.mutate(o.id); }} className="rounded-lg bg-berry px-3 py-2 text-xs font-bold text-berry-foreground">🗑️ Delete</button></div></td></tr>)}
        </tbody></table></div>
        {!dash.isLoading && !orders.length && <p className="mt-4 text-sm font-semibold text-muted-foreground">No orders match your search.</p>}
      </section>

      <section className="card-fun p-5 md:p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Team management</p><h2 className="text-2xl font-black">Add a worker</h2><form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); workerMut.mutate(); }}><input required value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} placeholder="Employee name" className="rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold outline-none focus:border-primary" /><input required value={newWorker.workerCode} onChange={(e) => setNewWorker({ ...newWorker, workerCode: e.target.value.toUpperCase() })} placeholder="LOGIN CODE" className="rounded-xl border-2 border-border bg-secondary px-4 py-3 font-bold tracking-widest outline-none focus:border-primary" /><button disabled={workerMut.isPending} className="rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-60">{workerMut.isPending ? "Adding…" : "+ Add worker"}</button></form></section>

      {workerEdit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Worker profile</p><h2 className="mt-1 text-2xl font-black">Edit {workerEdit.name}</h2><div className="mt-5 space-y-3"><label className="block text-sm font-bold">Name<input value={workerEdit.name} onChange={(e) => setWorkerEdit({ ...workerEdit, name: e.target.value })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-semibold" /></label><label className="block text-sm font-bold">Login code<input value={workerEdit.workerCode} onChange={(e) => setWorkerEdit({ ...workerEdit, workerCode: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-4 py-3 font-bold tracking-widest" /></label></div><div className="mt-5 flex gap-2"><button onClick={() => workerEditMut.mutate()} disabled={workerEditMut.isPending} className="flex-1 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">{workerEditMut.isPending ? "Saving…" : "Save changes"}</button><button onClick={() => setWorkerEdit(null)} className="rounded-xl border-2 border-border px-4 py-3 font-bold">Cancel</button></div></div></div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm"><p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Pill({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="text-base font-black">{value}</p></div>; }
function CellInput({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) { return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border-2 border-border bg-secondary px-2 py-1.5 font-semibold outline-none focus:border-primary" />; }
