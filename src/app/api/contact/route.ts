import { NextResponse } from "next/server";
import { Resend } from "resend";
import { contactSchema, type ContactInput } from "@/lib/contact-schema";

export const runtime = "nodejs";

/**
 * Lead intake.
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

function buildEmail(data: ContactInput): string {
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

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "SULOAI <onboarding@resend.dev>";

  if (!apiKey || !to) {
    // No mail configured — keep the lead rather than losing it.
    console.warn(
      "[contact] RESEND_API_KEY or CONTACT_TO_EMAIL missing; logging lead instead of emailing."
    );
    console.info("[contact] lead:", JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true, delivered: false });
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
      html: buildEmail(data),
    });

    if (error) {
      console.error("[contact] Resend rejected the send:", error);
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

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[contact] unexpected failure:", err);
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
