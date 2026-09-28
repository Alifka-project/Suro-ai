import type { Metadata } from "next";
import { ShieldCheck, UsersRound } from "lucide-react";
import { Badge, Card, CardHeader, Detail, PageHeader, cn } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { initials, timeAgo } from "@/lib/admin/labels";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/admin/password";
import { formatBusinessDateTime } from "@/lib/admin/time";
import { db } from "@/lib/db";
import { PasswordForm } from "./_components/PasswordForm";
import { SessionsForm } from "./_components/SessionsForm";

export const metadata: Metadata = { title: "Account" };

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        size === "lg"
          ? "h-14 w-14 bg-linear-to-br from-abyss-600 via-azure-500 to-aqua-500 text-[1.05rem] text-white shadow-[0_10px_24px_-14px_rgb(7_38_60_/_0.8)]"
          : "h-9 w-9 bg-linear-to-br from-azure-500/15 to-aqua-500/20 text-[0.72rem] text-abyss-600",
      )}
    >
      {initials(name)}
    </span>
  );
}

function LastSignIn({ at }: { at: Date | null }) {
  if (!at) return <span className="text-ink-550">Never signed in</span>;
  return (
    <time dateTime={at.toISOString()} title={formatBusinessDateTime(at)}>
      {formatBusinessDateTime(at)}
      <span className="text-ink-550"> · {timeAgo(at)}</span>
    </time>
  );
}

/**
 * The signed-in admin's own account: password, sessions, and a read-only view
 * of the team. Accounts themselves are created and deactivated from the
 * command line (`npm run admin:user`), never from the browser.
 */
export default async function AccountPage() {
  const admin = await requireAdmin();

  const [me, team] = await Promise.all([
    db.adminUser.findUnique({
      where: { id: admin.id },
      select: { username: true, name: true, createdAt: true, lastLoginAt: true },
    }),
    db.adminUser.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: { id: true, username: true, name: true, active: true, lastLoginAt: true },
    }),
  ]);
  // requireAdmin() just read this row; it can only be missing if deleted mid-request.
  const profile = me ?? { username: admin.username, name: admin.name, createdAt: null, lastLoginAt: null };
  const activeCount = team.filter((t) => t.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Your account"
        description="Your password and sessions, and who else can sign in to this dashboard."
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Change password"
            subtitle="Enter your current password, then the new one twice."
          />
          <PasswordForm username={profile.username} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} />
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <Card>
            <div className="flex items-center gap-3.5">
              <Avatar name={profile.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-[1.1rem] font-bold text-ink-900">{profile.name}</p>
                <p className="text-[0.76rem] text-ink-550">Signed in on this device</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-ink-100 pt-4">
              <Detail label="Admin ID">
                <span className="font-mono text-[0.84rem]">{profile.username}</span>
              </Detail>
              <Detail label="Last sign-in">
                <LastSignIn at={profile.lastLoginAt} />
              </Detail>
              {profile.createdAt && (
                <Detail label="Account created">
                  <time dateTime={profile.createdAt.toISOString()}>{formatBusinessDateTime(profile.createdAt)}</time>
                </Detail>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Sessions"
              subtitle="Lost a laptop, or signed in on a shared computer? End every other session at once."
            />
            <SessionsForm />
          </Card>
        </div>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader
            title="Team"
            subtitle={`${team.length} ${team.length === 1 ? "account" : "accounts"} · ${activeCount} active`}
            action={
              <span className="hidden items-center gap-1.5 text-[0.74rem] text-ink-550 sm:inline-flex">
                <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
                Read-only
              </span>
            }
          />
          <ul className="divide-y divide-ink-100/70">
            {team.map((t) => {
              const isMe = t.id === admin.id;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                    <Avatar name={t.name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[0.88rem] font-semibold text-ink-900">{t.name}</span>
                        {isMe && (
                          <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-600">
                            You
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[0.74rem] text-ink-550">
                        <span className="sr-only">Admin ID: </span>
                        {t.username}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-ink-700 max-sm:pl-12">
                    <Badge tone={t.active ? "mint" : "neutral"}>{t.active ? "Active" : "Deactivated"}</Badge>
                    <span>
                      <span className="text-ink-550">Last sign-in: </span>
                      <LastSignIn at={t.lastLoginAt} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-haze px-3 py-2.5 text-[0.76rem] text-ink-600">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-abyss-600" aria-hidden="true" />
            <span>
              Accounts are added, deactivated and reset from the server with{" "}
              <code className="rounded bg-white px-1 py-px font-mono text-[0.72rem] text-ink-800">npm run admin:user</code>,
              never from the browser.
            </span>
          </p>
        </Card>
      </div>
    </>
  );
}
