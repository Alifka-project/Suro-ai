import { cn } from "@/components/admin/ui";
import { initials } from "@/lib/admin/labels";

// Brand-ramp gradients; a lead always gets the same one, derived from its name.
const GRADIENTS = [
  "from-abyss-600 to-azure-400",
  "from-azure-500 to-aqua-400",
  "from-aqua-500 to-mint-400",
  "from-lilac-600 to-blush-400",
  "from-azure-500 to-lilac-400",
] as const;

function pick(name: string): string {
  let hash = 7;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function LeadAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-display font-bold text-white shadow-[0_6px_14px_-8px_rgb(7_38_60_/_0.6)]",
        size === "lg" ? "h-14 w-14 text-[1.05rem]" : "h-9 w-9 text-[0.74rem]",
        pick(name),
      )}
    >
      {initials(name)}
    </span>
  );
}
