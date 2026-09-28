"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/admin/ui";
import type { OpenStage } from "@/lib/admin/pipeline";

/*
 * Which column's quick-create card is open. Shared through context so the
 * page header's "New opportunity" button (server-rendered around the board)
 * and each column's "+" open the same composer. One at a time, like Odoo.
 */

type Composer = { stage: OpenStage; nonce: number } | null;

type ComposerApi = {
  composer: Composer;
  openComposer: (stage: OpenStage) => void;
  closeComposer: () => void;
};

const ComposerContext = createContext<ComposerApi | null>(null);

export function PipelineProvider({
  initialStage = null,
  children,
}: {
  /** Open a column's composer on arrival (e.g. /admin/crm/pipeline?new=1). */
  initialStage?: OpenStage | null;
  children: ReactNode;
}) {
  const [composer, setComposer] = useState<Composer>(initialStage ? { stage: initialStage, nonce: 1 } : null);
  const api = useMemo<ComposerApi>(
    () => ({
      composer,
      // A new nonce each time, so re-opening an already open composer still
      // moves focus back to its first field.
      openComposer: (stage) => setComposer((c) => ({ stage, nonce: (c?.nonce ?? 0) + 1 })),
      closeComposer: () => setComposer(null),
    }),
    [composer],
  );
  return <ComposerContext value={api}>{children}</ComposerContext>;
}

export function useComposer(): ComposerApi {
  const api = useContext(ComposerContext);
  if (!api) throw new Error("useComposer must be used inside <PipelineProvider>.");
  return api;
}

/** Page-header action: opens the quick-create card in the New column. */
export function NewOpportunityButton() {
  const { openComposer } = useComposer();
  return (
    <Button type="button" onClick={() => openComposer("NEW")}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      New opportunity
    </Button>
  );
}
