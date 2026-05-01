/**
 * Extract plain text from an uploaded file (PDF, DOCX, or TXT).
 *
 * On Cloudflare Workers, mammoth and pdf-parse can't run — pdf-parse's
 * dependency on pdfjs-dist references DOMMatrix at module-import time,
 * and mammoth depends on Node's Buffer in ways that fail under nodejs_compat.
 * Both libraries also bring substantial bundle weight.
 *
 * Solution: hand off to port (Vercel/Node), which exposes a bearer-auth'd
 * `/api/extract-text` endpoint that runs the same libraries and returns
 * extracted text. depth-chart stays clean for CF Workers.
 *
 * Auth: PORT_EXTRACT_TOKEN — shared secret. Set on both the port (env var)
 * and on this worker (`wrangler secret put PORT_EXTRACT_TOKEN`).
 */

const PORT_EXTRACT_URL =
  process.env.PORT_EXTRACT_URL ?? "https://port.windedvertigo.com/api/extract-text";

export async function extract_text(file: File): Promise<string> {
  const token = process.env.PORT_EXTRACT_TOKEN;
  if (!token) {
    throw new Error("PORT_EXTRACT_TOKEN not configured");
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(PORT_EXTRACT_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(
      `port extract-text returned ${res.status}: ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await res.json()) as { text?: string; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.text ?? "";
}
