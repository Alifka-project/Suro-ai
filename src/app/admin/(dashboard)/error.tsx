"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, EmptyState, LinkButton } from "@/components/admin/ui";

/**
 * Fallback error boundary for every dashboard page without one of its own —
 * the client dashboard and Account today — e.g. when the database is
 * unreachable. It renders inside the dashboard layout, so the sidebar stays
 * put and every other page is still one click away. CRM, billing and projects
 * keep their own, more specific boundaries.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <EmptyState
        icon={TriangleAlert}
        title="This page could not be loaded"
        description={
          <>
            Something went wrong on our side, often a brief problem reaching the database. Please try again, or
            go back to the dashboard.
            {error.digest && (
              <span className="mt-2 block font-mono text-[0.68rem] text-ink-600">Reference: {error.digest}</span>
            )}
          </>
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => retry()}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
            {pathname !== "/admin" && (
              <LinkButton href="/admin" variant="ghost" size="sm">
                Back to dashboard
              </LinkButton>
            )}
          </div>
        }
      />
    </div>
  );
}
