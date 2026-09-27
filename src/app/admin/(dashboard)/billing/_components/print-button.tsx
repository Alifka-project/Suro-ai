"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/admin/ui";

/** Opens the browser print dialog; "Save as PDF" there produces the client-ready file. */
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
