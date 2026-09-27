import { cn, inputClass, textareaClass } from "@/components/admin/ui";

/**
 * The shared controls already turn the border red when aria-invalid and use
 * 16px text below `sm`. This module's forms add a faint red fill, and keep the
 * red border and ring while an invalid field has focus (the shared focus style
 * would otherwise switch it back to blue mid-fix).
 */
const invalidState = cn(
  "aria-[invalid=true]:bg-red-50/30",
  "aria-[invalid=true]:focus:border-red-400 aria-[invalid=true]:focus:ring-red-500/15",
);

export const fieldClass = cn(inputClass, invalidState);

export const fieldTextareaClass = cn(textareaClass, invalidState, "min-h-28");
