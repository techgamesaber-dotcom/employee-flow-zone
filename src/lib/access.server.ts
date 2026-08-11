// Server-only helpers shared by the app's server functions.
import type { Json } from "@/integrations/supabase/types";

export const MEDIA_BUCKET = "workspace-media";

export type WorkerRow = { id: string; name: string; code: string; is_admin: boolean };
export type CompanyRow = { id: string; slug: string; name: string; emoji: string; tagline: string };

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function resolveWorker(code: string): Promise<WorkerRow> {
  const d = await db();
  const { data, error } = await d
    .from("workers")
    .select("id, name, code, is_admin")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid code");
  return data as WorkerRow;
}

export async function authorizeCompany(code: string, companyId: string) {
  const worker = await resolveWorker(code);
  const d = await db();
  const { data: company, error } = await d
    .from("companies")
    .select("id, slug, name, emoji, tagline")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!company) throw new Error("Company not found");
  if (!worker.is_admin) {
    const { data: access, error: accessError } = await d
      .from("worker_companies")
      .select("worker_id")
      .eq("worker_id", worker.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (accessError) throw new Error(accessError.message);
    if (!access) throw new Error("You are not authorized for this company");
  }
  return { worker, company: company as CompanyRow };
}

export async function requireAdmin(code: string, companyId: string) {
  const ctx = await authorizeCompany(code, companyId);
  if (!ctx.worker.is_admin) throw new Error("Only admins can do this");
  return ctx;
}

export async function signPath(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;
  const d = await db();
  const { data } = await d.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

/** Adds resolved `url` / `urls` next to stored storage `path` / `paths`. */
export async function signContent(content: unknown): Promise<Record<string, Json>> {
  const c: Record<string, Json> = { ...((content as Record<string, Json>) ?? {}) };
  if (typeof c["path"] === "string") c["url"] = await signPath(c["path"]);
  if (Array.isArray(c["paths"])) {
    c["urls"] = await Promise.all((c["paths"] as unknown[]).map((p) => signPath(p)));
  }
  return c;
}

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  config: Record<string, unknown>;
  answer_key: Record<string, unknown>;
  marks: number;
  position: number;
};

export const MANUAL_TYPES = ["written", "photo", "video"];

/** Returns the auto-awarded marks for one objective question, or null when it needs a human. */
export function scoreQuestion(q: QuestionRow, answer: unknown): number | null {
  if (MANUAL_TYPES.includes(q.type)) return null;
  const marks = Number(q.marks) || 0;
  if (q.type === "mcq") {
    return Number(answer) === Number(q.answer_key?.["correct"]) ? marks : 0;
  }
  if (q.type === "fill") {
    const accepted = [q.answer_key?.["text"], ...((q.answer_key?.["alternatives"] as unknown[]) ?? [])]
      .filter((x) => x !== undefined && x !== null)
      .map(norm);
    return accepted.includes(norm(answer)) ? marks : 0;
  }
  if (q.type === "match") {
    const pairs = (q.config?.["pairs"] as { left: string; right: string }[]) ?? [];
    if (!pairs.length) return 0;
    const given = (answer as unknown[]) ?? [];
    const correct = pairs.filter((p, i) => norm(given[i]) === norm(p.right)).length;
    return Math.round((correct / pairs.length) * marks * 100) / 100;
  }
  return 0;
}
