import { UserRound } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { initials } from "@/lib/admin/labels";

// Deep ends of the brand ramps, so white initials stay legible at 10px.
const GRADIENTS = [
  "from-abyss-700 to-azure-600",
  "from-ink-800 to-abyss-500",
  "from-abyss-600 to-aqua-600",
  "from-ink-700 to-azure-600",
] as const;

function pick(name: string): string {
  let hash = 11;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * The salesperson on a card or list row: initials in a circle, the full name
 * on hover and for screen readers. Unassigned shows a dashed placeholder.
 * Server-safe: no hooks.
 */
export function OwnerAvatar({ owner, className }: { owner: { name: string } | null; className?: string }) {
  if (!owner) {
    return (
      <span
        title="No salesperson"
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-300 text-ink-400",
          className,
        )}
      >
        <UserRound className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">No salesperson</span>
      </span>
    );
  }
  return (
    <span
      title={`Salesperson: ${owner.name}`}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br font-display text-[0.6rem] font-bold text-white",
        pick(owner.name),
        className,
      )}
    >
      <span aria-hidden="true">{initials(owner.name)}</span>
      <span className="sr-only">Salesperson: {owner.name}</span>
    </span>
  );
}
