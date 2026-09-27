"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, EmptyState, LinkButton } from "@/components/admin/ui";

/**
 * Error boundary for every billing screen (list, documents, editors), e.g. when
 * the database is unreachable. Keeps the dashboard shell and sidebar in place
 * instead of replacing the whole admin with the default error page.
 */
export default function BillingError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <EmptyState
        icon={TriangleAlert}
        title="Billing could not be loaded"
        description={
          <>
            Something went wrong while fetching quotes and invoices. Nothing was changed. Please try again.
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
            <LinkButton href="/admin/billing" variant="ghost" size="sm">
              Back to billing
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
