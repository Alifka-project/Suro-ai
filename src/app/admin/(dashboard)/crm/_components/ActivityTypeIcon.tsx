import type { ActivityType } from "@prisma/client";
import { ListTodo, Mail, Phone, Repeat, Users, type LucideIcon } from "lucide-react";
import { ACTIVITY_TYPE } from "@/lib/admin/pipeline";

/** lucide-react component per icon name in ACTIVITY_TYPE (pipeline.ts names them, this resolves them). */
const ICONS: Record<(typeof ACTIVITY_TYPE)[ActivityType]["icon"], LucideIcon> = {
  Phone,
  Mail,
  Users,
  ListTodo,
  Repeat,
};

/** Decorative: the type is always also written out next to the icon. Server-safe. */
export function ActivityTypeIcon({ type, className = "h-4 w-4" }: { type: ActivityType; className?: string }) {
  const Icon = ICONS[ACTIVITY_TYPE[type].icon];
  return <Icon className={className} aria-hidden="true" />;
}
