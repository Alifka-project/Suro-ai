import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { buildAgreementDocument } from "@/lib/admin/agreement-document";
import { renderAgreementDocx } from "@/lib/admin/agreement-docx";
import { isPlausibleId } from "../../../_lib/queries";

/**
 * GET /admin/billing/agreements/:id/docx — the agreement and its SOW as a Word
 * file, rendered from the same document model as the printable page.
 * Authorized like every admin read; never cached, since it carries client data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  if (!isPlausibleId(id)) return new Response("Agreement not found", { status: 404 });

  const agreement = await db.agreement.findUnique({
    where: { id },
    include: { quote: { select: { number: true } } },
  });
  if (!agreement) return new Response("Agreement not found", { status: 404 });

  const doc = buildAgreementDocument({ ...agreement, quoteNumber: agreement.quote?.number ?? null });
  const buffer = await renderAgreementDocx(doc);

  // Plain-ASCII fallback for old clients, plus the exact name per RFC 6266 / 5987.
  const ascii = doc.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(doc.fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
