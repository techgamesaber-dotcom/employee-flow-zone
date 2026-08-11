import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { authorizeCompany, db, MEDIA_BUCKET, requireAdmin, signContent } from "@/lib/access.server";

export const getCanvas = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; spaceKey: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    spaceKey: z.string().regex(/^space-[1-6]$/).parse(input.spaceKey),
  }))
  .handler(async ({ data }) => {
    const { worker, company } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    const { data: rows, error } = await d
      .from("canvas_elements")
      .select("id, space_key, type, x, y, w, h, z, content")
      .eq("company_id", data.companyId)
      .eq("space_key", data.spaceKey)
      .order("z", { ascending: true });
    if (error) throw new Error(error.message);
    const elements = await Promise.all(
      (rows ?? []).map(async (r) => ({ ...r, content: await signContent(r.content) })),
    );
    return { company, isAdmin: worker.is_admin, elements };
  });

export const addElement = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; spaceKey: string; type: string; x: number; y: number; w: number; h: number; content?: Record<string, unknown> }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    spaceKey: z.string().regex(/^space-[1-6]$/).parse(input.spaceKey),
    type: z.enum(["text", "heading", "image", "video", "youtube", "link", "file", "gallery", "divider", "shape", "table"]).parse(input.type),
    x: z.number().parse(input.x),
    y: z.number().parse(input.y),
    w: z.number().min(40).max(2000).parse(input.w),
    h: z.number().min(20).max(2000).parse(input.h),
    content: z.record(z.any()).default({}).parse(input.content ?? {}),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const { data: top } = await d
      .from("canvas_elements")
      .select("z")
      .eq("company_id", data.companyId)
      .eq("space_key", data.spaceKey)
      .order("z", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await d
      .from("canvas_elements")
      .insert({
        company_id: data.companyId,
        space_key: data.spaceKey,
        type: data.type,
        x: data.x,
        y: data.y,
        w: data.w,
        h: data.h,
        z: (top?.z ?? 0) + 1,
        content: data.content,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateElement = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string; x?: number; y?: number; w?: number; h?: number; z?: number; content?: Record<string, unknown> }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    id: z.string().uuid().parse(input.id),
    x: input.x === undefined ? undefined : z.number().parse(input.x),
    y: input.y === undefined ? undefined : z.number().parse(input.y),
    w: input.w === undefined ? undefined : z.number().min(40).max(2000).parse(input.w),
    h: input.h === undefined ? undefined : z.number().min(20).max(2000).parse(input.h),
    z: input.z === undefined ? undefined : z.number().int().parse(input.z),
    content: input.content === undefined ? undefined : z.record(z.any()).parse(input.content),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const patch: TablesUpdate<"canvas_elements"> = { updated_at: new Date().toISOString() };
    if (data.x !== undefined) patch.x = data.x;
    if (data.y !== undefined) patch.y = data.y;
    if (data.w !== undefined) patch.w = data.w;
    if (data.h !== undefined) patch.h = data.h;
    if (data.z !== undefined) patch.z = data.z;
    if (data.content !== undefined) patch.content = data.content as never;
    const { error } = await d.from("canvas_elements").update(patch).eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteElement = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    id: z.string().uuid().parse(input.id),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const { error } = await d.from("canvas_elements").delete().eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Returns a one-time signed upload target so the browser can PUT the file straight to storage. */
export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; filename: string; purpose: "canvas" | "answer" }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    filename: z.string().trim().min(1).max(200).parse(input.filename),
    purpose: z.enum(["canvas", "answer"]).parse(input.purpose),
  }))
  .handler(async ({ data }) => {
    const ctx = data.purpose === "canvas"
      ? await requireAdmin(data.code, data.companyId)
      : await authorizeCompany(data.code, data.companyId);
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${data.companyId}/${data.purpose}/${ctx.worker.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const d = await db();
    const { data: signed, error } = await d.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not start the upload");
    return { path: signed.path, token: signed.token };
  });
