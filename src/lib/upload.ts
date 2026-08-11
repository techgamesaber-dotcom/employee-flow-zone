import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/canvas.functions";

const BUCKET = "workspace-media";

export async function uploadToWorkspace(
  file: File,
  args: { code: string; companyId: string; purpose: "canvas" | "answer" },
): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error("Files must be under 50 MB");
  const { path, token } = await createUploadUrl({
    data: { code: args.code, companyId: args.companyId, filename: file.name, purpose: args.purpose },
  });
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);
  return path;
}
