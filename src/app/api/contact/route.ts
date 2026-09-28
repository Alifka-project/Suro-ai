import { NextResponse } from "next/server";
import { Resend } from "resend";
import { contactSchema, type ContactInput } from "@/lib/contact-schema";
import { sortOrderAtTop } from "@/lib/admin/deals";
import { logLeadEvent } from "@/lib/admin/timeline";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lead intake.
 *
 * Every valid submission is saved as a CRM lead — at the top of the pipeline's
 * New column, with "Enquiry received" on its timeline — then announced by
 * email with a link straight to that lead in the admin dashboard. The two
 * steps are independent on purpose: if the database is down the email still
 * goes out, and if email fails the lead is still saved — an enquiry is only
 * lost if both fail, and then it is logged in full.
 *
 * Sends through Resend when RESEND_API_KEY is present. Without a key the route
 * still validates and accepts the submission and logs it to the server console,
 * so the form is fully functional in development and never silently drops a
 * real lead if the key expires in production.
 *
 * Required env for live sending (.env.local):
 *   RESEND_API_KEY=re_xxxxxxxx
 *   CONTACT_TO_EMAIL=you@yourdomain.com
 *   CONTACT_FROM_EMAIL="SULOAI <noreply@suloai.com>"   # domain must be verified in Resend
 */

/** Naive per-IP limiter. Fine for a single instance; swap for Redis/Upstash if you scale out. */
const RATE_LIMIT = { windowMs: 60_000, max: 5 };
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }

  return recent.length > RATE_LIMIT.max;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value?: string | string[]): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return "";
  const text = Array.isArray(value) ? value.join(", ") : value;
  return `
    <tr>
      <td style="padding:8px 14px 8px 0;color:#517f9e;font:500 12px/1.5 -apple-system,Segoe UI,sans-serif;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#06253c;font:400 14px/1.6 -apple-system,Segoe UI,sans-serif">${escapeHtml(text).replace(/\n/g, "<br/>")}</td>
    </tr>`;
}

function buildEmail(
  data: ContactInput,
  { saved, dashboardUrl }: { saved: boolean; dashboardUrl: string | null },
): string {
  const isCompany = data.clientType === "company";

  return `
  <div style="background:#f7fafc;padding:28px">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #d3e0e9">
      <div style="background:linear-gradient(115deg,#0766A3,#3686D5 38%,#41B0CC 62%,#B5ABE6 84%,#FD9CC2);padding:22px 26px">
        <p style="margin:0;color:#fff;font:700 17px/1.3 -apple-system,Segoe UI,sans-serif">New enquiry — ${escapeHtml(data.fullName)}</p>
        <p style="margin:5px 0 0;color:rgba(255,255,255,.88);font:500 12px/1.4 -apple-system,Segoe UI,sans-serif">
          ${isCompany ? escapeHtml(data.companyName || "Company") : "Individual"} · ${escapeHtml(data.city)}, ${escapeHtml(data.country)} · ${escapeHtml(data.budget)}
        </p>
      </div>
      <div style="padding:22px 26px">
        <table style="width:100%;border-collapse:collapse">
          ${row("Type", isCompany ? "Company" : "Individual")}
          ${row("Name", data.fullName)}
          ${row("Email", data.email)}
          ${row("Phone", data.phone)}
          ${row("Preferred contact", data.contactPreference)}
          ${row("Location", `${data.city}, ${data.country}`)}
          ${isCompany ? row("Company", data.companyName) : ""}
          ${isCompany ? row("Role", data.role) : ""}
          ${isCompany ? row("Size", data.companySize) : ""}
          ${isCompany ? row("Industry", data.industry) : ""}
          ${row("Services", data.services)}
          ${row("Systems", data.systems)}
          ${row("Timeline", data.timeline)}
          ${row("Budget", data.budget)}
        </table>
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid #eaf1f6">
          <p style="margin:0 0 6px;color:#517f9e;font:500 12px/1.5 -apple-system,Segoe UI,sans-serif">The problem, in their words</p>
          <p style="margin:0;color:#06253c;font:400 14px/1.7 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">${escapeHtml(data.message)}</p>
        </div>
        ${
          !saved
            ? `<p style="margin:22px 0 0;color:#b45309;font:500 12px/1.5 -apple-system,Segoe UI,sans-serif">Heads-up: this lead could not be saved to the dashboard database, so it only exists in this email.</p>`
            : dashboardUrl
            ? `<div style="margin-top:22px">
          <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:linear-gradient(100deg,#0766A3,#3686D5 45%,#41B0CC);color:#fff;text-decoration:none;font:600 14px/1 -apple-system,Segoe UI,sans-serif;padding:13px 20px;border-radius:12px">Open lead in dashboard &rarr;</a>
        </div>`
            : ""
        }
      </div>
    </div>
  </div>`;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400 }
    );
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Some fields need attention.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Honeypot: accept silently so the bot doesn't learn it was caught.
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // 1. Save the lead. A failure here must not stop the email below.
  let leadId: string | null = null;
  try {
    const lead = await db.lead.create({
      data: {
        // Newest enquiry first in the pipeline's New column.
        sortOrder: await sortOrderAtTop(db, "NEW"),
        clientType: data.clientType === "company" ? "COMPANY" : "INDIVIDUAL",
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        city: data.city,
        contactPreference: data.contactPreference,
        companyName: data.companyName || null,
        role: data.role || null,
        companySize: data.companySize ?? null,
        industry: data.industry ?? null,
        services: data.services,
        systems: data.systems || null,
        timeline: data.timeline,
        budget: data.budget,
        message: data.message,
      },
      select: { id: true },
    });
    leadId = lead.id;
    // After leadId is set: if only the timeline entry fails, the lead still
    // counts as saved below.
    await logLeadEvent(lead.id, "Enquiry received via the website form.", null);
  } catch (err) {
    console.error(
      leadId
        ? "[contact] lead saved, but its timeline entry failed:"
        : "[contact] could not save lead to database:",
      err
    );
  }

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const dashboardUrl = leadId && appUrl ? `${appUrl}/admin/crm/${leadId}` : null;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "SULOAI <onboarding@resend.dev>";

  if (!apiKey || !to) {
    // No mail configured — keep the lead rather than losing it.
    console.warn(
      "[contact] RESEND_API_KEY or CONTACT_TO_EMAIL missing; logging lead instead of emailing."
    );
    if (!leadId) {
      // Neither channel worked — keep the full lead in the logs so it is recoverable.
      console.info("[contact] lead (unsaved, unsent):", JSON.stringify(data, null, 2));
    }
    return NextResponse.json({ ok: true, saved: !!leadId, delivered: false });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: data.email,
      subject: `New enquiry — ${data.fullName}${
        data.clientType === "company" && data.companyName
          ? ` (${data.companyName})`
          : ""
      } · ${data.budget}`,
      html: buildEmail(data, { saved: !!leadId, dashboardUrl }),
    });

    if (error) {
      console.error("[contact] Resend rejected the send:", error);
      // Saved to the dashboard, so the enquiry is safe — don't alarm the visitor.
      if (leadId) return NextResponse.json({ ok: true, saved: true, delivered: false });
      console.info("[contact] lead (undelivered):", JSON.stringify(data, null, 2));
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn't send that just now. Please email us directly and we'll pick it up.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, saved: !!leadId, delivered: true });
  } catch (err) {
    console.error("[contact] unexpected failure:", err);
    if (leadId) return NextResponse.json({ ok: true, saved: true, delivered: false });
    console.info("[contact] lead (undelivered):", JSON.stringify(data, null, 2));
    return NextResponse.json(
      {
        ok: false,
        error:
          "Something broke on our side. Please email us directly and we'll pick it up.",
      },
      { status: 500 }
    );
  }
}
