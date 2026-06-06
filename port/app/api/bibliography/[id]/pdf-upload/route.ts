/**
 * Manual PDF upload fallback (paywalled / EndNote-only / scanned papers the
 * retrieval waterfall can't reach). Session-gated by middleware. Multipart
 * form: `file=<pdf>`. Stores to R2 and sets pdf_url + pdf_source='upload'.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { uploadAsset } from "@/lib/r2/upload";
import { getBibliographyRowById, updateBibliographyRow } from "@/lib/supabase/bibliography";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error("bad id", 400);

  const row = await getBibliographyRowById(id);
  if (!row) return error("citation not found", 404);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return error("file is required", 400);
  if (file.type && file.type !== "application/pdf") return error("must be a PDF", 400);
  if (file.size > 30 * 1024 * 1024) return error("file too large (max 30 MB)", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 8).toString("latin1").includes("%PDF")) return error("not a valid PDF", 400);

  await uploadAsset(bytes, `bibliography-pdfs/${id}.pdf`, "application/pdf");
  await updateBibliographyRow(id, { pdfUrl: `/api/bibliography/${id}/pdf`, pdfSource: "upload" });
  return json({ ok: true });
}
