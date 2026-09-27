"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Card, LinkButton } from "@/components/admin/ui";

/**
 * Catches render errors in the projects routes and anything a Server Action
 * throws (a rejected or tampered request). Messages from the server are
 * generic in production, so the copy here doesn't depend on them.
 */
export default function ProjectsError({
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
    <Card className="mx-auto max-w-lg">
      <div className="flex flex-col items-center py-8 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-[1.1rem] font-bold text-ink-900">Something went wrong</h2>
        <p className="mt-1 max-w-sm text-[0.86rem] text-ink-500">
          That didn’t go through. The project may have been changed or removed in another tab — try again, or head
          back to the board.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-550">Ref {error.digest}</p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => retry()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <LinkButton href="/admin/projects">Back to projects</LinkButton>
        </div>
      </div>
    </Card>
  );
}
