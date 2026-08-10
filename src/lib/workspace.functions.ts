import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.string().trim().min(2).max(40);
const companySchema = z.string().uuid();
const spaceSchema = z.string().regex(/^space-[1-6]$/);

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveWorker(code: string) {
  const db = await adminDb();
  const { data, error } = await db.from("workers").select("id, is_admin").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid code");
  return data;
}

async function authorize(code: string, companyId: string) {
  const worker = await resolveWorker(code);
  const db = await adminDb();
  const { data: company, error } = await db.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!company) throw new Error("Company not found");
  if (!worker.is_admin) {
    const { data: access, error: accessError } = await db.from("worker_companies").select("worker_id").eq("worker_id", worker.id).eq("company_id", companyId).maybeSingle();
    if (accessError) throw new Error(accessError.message);
    if (!access) throw new Error("You are not authorized for this company");
  }
  return worker;
}

export const getWorkspaceItems = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string }) => ({ code: codeSchema.parse(input.code), companyId: companySchema.parse(input.companyId) }))
  .handler(async ({ data }) => {
    await authorize(data.code, data.companyId);
    const db = await adminDb();
    const { data: items, error } = await db.from("workspace_items").select("id, space_key, title, description, created_at").eq("company_id", data.companyId).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const addWorkspaceItem = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; spaceKey: string; title: string; description?: string }) => ({
    code: codeSchema.parse(input.code), companyId: companySchema.parse(input.companyId), spaceKey: spaceSchema.parse(input.spaceKey),
    title: z.string().trim().min(1).max(100).parse(input.title), description: z.string().trim().max(500).parse(input.description ?? "")
  }))
  .handler(async ({ data }) => {
    const worker = await authorize(data.code, data.companyId);
    if (!worker.is_admin) throw new Error("Only admins can add workspace items");
    const db = await adminDb();
    const { error } = await db.from("workspace_items").insert({ company_id: data.companyId, space_key: data.spaceKey, title: data.title, description: data.description });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateWorkspaceItem = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string; title: string; description?: string }) => ({
    code: codeSchema.parse(input.code), companyId: companySchema.parse(input.companyId), id: z.string().uuid().parse(input.id),
    title: z.string().trim().min(1).max(100).parse(input.title), description: z.string().trim().max(500).parse(input.description ?? "")
  }))
  .handler(async ({ data }) => {
    const worker = await authorize(data.code, data.companyId);
    if (!worker.is_admin) throw new Error("Only admins can edit workspace items");
    const db = await adminDb();
    const { error } = await db.from("workspace_items").update({ title: data.title, description: data.description }).eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteWorkspaceItem = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string }) => ({ code: codeSchema.parse(input.code), companyId: companySchema.parse(input.companyId), id: z.string().uuid().parse(input.id) }))
  .handler(async ({ data }) => {
    const worker = await authorize(data.code, data.companyId);
    if (!worker.is_admin) throw new Error("Only admins can remove workspace items");
    const db = await adminDb();
    const { error } = await db.from("workspace_items").delete().eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
