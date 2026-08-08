import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.string().trim().min(2).max(40);

type WorkerRow = {
  id: string;
  name: string;
  code: string;
  is_admin: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveWorker(code: string): Promise<WorkerRow> {
  const db = await admin();
  const { data, error } = await db
    .from("workers")
    .select("id, name, code, is_admin")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid code");
  return data as WorkerRow;
}

export const signInWithCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: codeSchema.parse(input.code) }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    return { id: w.id, name: w.name, isAdmin: w.is_admin, code: w.code };
  });

export const getWorkerDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: codeSchema.parse(input.code) }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    const db = await admin();

    const [attendance, orders] = await Promise.all([
      db
        .from("attendance")
        .select("id, day, status")
        .eq("worker_id", w.id)
        .order("day", { ascending: false })
        .limit(60),
      db
        .from("orders")
        .select("id, customer_name, order_details, price, price_paid, price_left, created_at")
        .eq("worker_id", w.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (attendance.error) throw new Error(attendance.error.message);
    if (orders.error) throw new Error(orders.error.message);

    return {
      worker: { id: w.id, name: w.name, isAdmin: w.is_admin },
      attendance: attendance.data ?? [],
      orders: orders.data ?? [],
    };
  });

export const markAttendance = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; status: "present" | "absent"; day?: string }) => ({
    code: codeSchema.parse(input.code),
    status: z.enum(["present", "absent"]).parse(input.status),
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .parse(input.day),
  }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    const db = await admin();
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const { error } = await db
      .from("attendance")
      .upsert({ worker_id: w.id, day, status: data.status }, { onConflict: "worker_id,day" });
    if (error) throw new Error(error.message);
    return { ok: true as const, day, status: data.status };
  });

export const addOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      code: string;
      customerName: string;
      orderDetails: string;
      price: number;
      pricePaid: number;
    }) => ({
      code: codeSchema.parse(input.code),
      customerName: z.string().trim().min(1).max(120).parse(input.customerName),
      orderDetails: z.string().trim().min(1).max(500).parse(input.orderDetails),
      price: z.number().min(0).max(100000000).parse(input.price),
      pricePaid: z.number().min(0).max(100000000).parse(input.pricePaid),
    }),
  )
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    const db = await admin();
    const { error } = await db.from("orders").insert({
      worker_id: w.id,
      customer_name: data.customerName,
      order_details: data.orderDetails,
      price: data.price,
      price_paid: Math.min(data.pricePaid, data.price),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      code: string;
      id: string;
      customerName: string;
      orderDetails: string;
      price: number;
      pricePaid: number;
    }) => ({
      code: codeSchema.parse(input.code),
      id: z.string().uuid().parse(input.id),
      customerName: z.string().trim().min(1).max(120).parse(input.customerName),
      orderDetails: z.string().trim().min(1).max(500).parse(input.orderDetails),
      price: z.number().min(0).max(100000000).parse(input.price),
      pricePaid: z.number().min(0).max(100000000).parse(input.pricePaid),
    }),
  )
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    const db = await admin();
    const query = db
      .from("orders")
      .update({
        customer_name: data.customerName,
        order_details: data.orderDetails,
        price: data.price,
        price_paid: Math.min(data.pricePaid, data.price),
      })
      .eq("id", data.id);
    const { error } = w.is_admin ? await query : await query.eq("worker_id", w.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; id: string }) => ({
    code: codeSchema.parse(input.code),
    id: z.string().uuid().parse(input.id),
  }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    const db = await admin();
    const query = db.from("orders").delete().eq("id", data.id);
    const { error } = w.is_admin ? await query : await query.eq("worker_id", w.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getAdminDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: codeSchema.parse(input.code) }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    if (!w.is_admin) throw new Error("Not allowed");
    const db = await admin();

    const [workersRes, attendanceRes, ordersRes] = await Promise.all([
      db.from("workers").select("id, name, code, is_admin").order("name"),
      db.from("attendance").select("id, worker_id, day, status").order("day", { ascending: false }),
      db
        .from("orders")
        .select("id, worker_id, customer_name, order_details, price, price_paid, price_left, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (workersRes.error) throw new Error(workersRes.error.message);
    if (attendanceRes.error) throw new Error(attendanceRes.error.message);
    if (ordersRes.error) throw new Error(ordersRes.error.message);

    const workers = (workersRes.data ?? []).filter((x) => !x.is_admin);
    const attendance = attendanceRes.data ?? [];
    const orders = ordersRes.data ?? [];

    const summary = workers.map((worker) => {
      const att = attendance.filter((a) => a.worker_id === worker.id);
      const ord = orders.filter((o) => o.worker_id === worker.id);
      return {
        id: worker.id,
        name: worker.name,
        code: worker.code,
        present: att.filter((a) => a.status === "present").length,
        absent: att.filter((a) => a.status === "absent").length,
        todayStatus: att.find((a) => a.day === new Date().toISOString().slice(0, 10))?.status ?? null,
        orderCount: ord.length,
        collected: ord.reduce((s, o) => s + Number(o.price_paid), 0),
        pending: ord.reduce((s, o) => s + Number(o.price_left), 0),
        total: ord.reduce((s, o) => s + Number(o.price), 0),
      };
    });

    const workerNames = Object.fromEntries(workers.map((x) => [x.id, x.name]));

    return {
      admin: { name: w.name },
      summary,
      orders: orders.map((o) => ({ ...o, workerName: workerNames[o.worker_id] ?? "Unknown" })),
      totals: {
        total: orders.reduce((s, o) => s + Number(o.price), 0),
        collected: orders.reduce((s, o) => s + Number(o.price_paid), 0),
        pending: orders.reduce((s, o) => s + Number(o.price_left), 0),
        presentToday: summary.filter((s) => s.todayStatus === "present").length,
        absentToday: summary.filter((s) => s.todayStatus === "absent").length,
        workers: workers.length,
      },
    };
  });

export const addWorker = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; name: string; workerCode: string }) => ({
    code: codeSchema.parse(input.code),
    name: z.string().trim().min(1).max(80).parse(input.name),
    workerCode: z
      .string()
      .trim()
      .min(3)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/)
      .parse(input.workerCode),
  }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    if (!w.is_admin) throw new Error("Not allowed");
    const db = await admin();
    const { error } = await db
      .from("workers")
      .insert({ name: data.name, code: data.workerCode.toUpperCase() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; workerId: string }) => ({
    code: codeSchema.parse(input.code),
    workerId: z.string().uuid().parse(input.workerId),
  }))
  .handler(async ({ data }) => {
    const w = await resolveWorker(data.code);
    if (!w.is_admin) throw new Error("Not allowed");

    const db = await admin();
    const { data: target, error: targetError } = await db
      .from("workers")
      .select("id, is_admin")
      .eq("id", data.workerId)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (!target) throw new Error("Worker not found");
    if (target.is_admin) throw new Error("Admin accounts cannot be deleted");

    const { error } = await db.from("workers").delete().eq("id", data.workerId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
