import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authorizeCompany, db } from "@/lib/access.server";

export const DELIVERY_POINTS = 5;
export const SILVER_AT = 150;

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
  }))
  .handler(async ({ data }) => {
    const { worker } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    const [workersRes, ordersRes, examsRes] = await Promise.all([
      d.from("workers").select("id, name, code, is_admin").order("name"),
      d.from("orders").select("id, worker_id, delivered_at").eq("company_id", data.companyId),
      d.from("exams").select("id").eq("company_id", data.companyId),
    ]);
    if (workersRes.error) throw new Error(workersRes.error.message);
    if (ordersRes.error) throw new Error(ordersRes.error.message);
    const examIds = (examsRes.data ?? []).map((e) => e.id);
    const submissions = examIds.length
      ? (await d.from("exam_submissions").select("worker_id, total_score, max_score").in("exam_id", examIds)).data ?? []
      : [];

    const rows = (workersRes.data ?? [])
      .filter((w) => !w.is_admin)
      .map((w) => {
        const deliveries = (ordersRes.data ?? []).filter((o) => o.worker_id === w.id && o.delivered_at).length;
        const deliveryPoints = deliveries * DELIVERY_POINTS;
        const mine = submissions.filter((s) => s.worker_id === w.id);
        const examPoints = mine.reduce((s, x) => s + Number(x.total_score), 0);
        const examMax = mine.reduce((s, x) => s + Number(x.max_score), 0);
        const totalPoints = deliveryPoints + examPoints;
        return {
          id: w.id,
          name: w.name,
          code: w.code,
          deliveries,
          deliveryPoints,
          examPoints,
          examMax,
          examsTaken: mine.length,
          totalPoints,
          level: totalPoints >= SILVER_AT ? "Silver" : "Bronze",
          toSilver: Math.max(0, SILVER_AT - totalPoints),
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return { rows, meId: worker.id, isAdmin: worker.is_admin };
  });

export const setOrderDelivered = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; orderId: string; delivered: boolean }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    orderId: z.string().uuid().parse(input.orderId),
    delivered: z.boolean().parse(input.delivered),
  }))
  .handler(async ({ data }) => {
    const { worker } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    let query = d
      .from("orders")
      .update({ delivered_at: data.delivered ? new Date().toISOString() : null })
      .eq("id", data.orderId)
      .eq("company_id", data.companyId);
    if (!worker.is_admin) query = query.eq("worker_id", worker.id);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const, delivered: data.delivered };
  });
