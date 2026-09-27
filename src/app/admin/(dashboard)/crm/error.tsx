"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/admin/ui";

/** Error boundary for the CRM screens, e.g. when the database is unreachable. */
export default function CrmError({
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
    <EmptyState
      icon={TriangleAlert}
      title="The CRM could not be loaded"
      description={
        <>
          Something went wrong while fetching leads. Please try again.
          {error.digest && (
            <span className="mt-2 block font-mono text-[0.68rem] text-ink-600">Reference: {error.digest}</span>
          )}
        </>
      }
      action={
        <Button type="button" variant="secondary" size="sm" onClick={() => retry()}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </Button>
      }
    />
  );
}
