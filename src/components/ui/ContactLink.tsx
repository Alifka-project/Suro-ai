"use client";

import type { MouseEvent, ReactNode } from "react";
import {
  announceContactIntent,
  BOOK_CALL_HREF,
  CONTACT_HREF,
  type ContactIntent,
} from "@/lib/contact-intent";

/** A left click with no modifier key, i.e. one that follows the link in this tab. */
function isPlainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * "Talk to us" / "Book a call" link, shared by the nav, the hero and the
 * footer (they are server components; this is the small client island they
 * render). It is a real link, so it works without JavaScript and in a new
 * tab. On click it also tells the contact form what the visitor wants: a call
 * preselects "Video call", a message just opens the form.
 *
 * A call goes to BOOKING_URL when one is configured: that page opens in a new
 * tab and the form is left alone.
 *
 * Only a plain left click announces the intent. A Ctrl/Cmd/Shift/Alt click
 * opens #contact in a new tab or window, so it must not tick a package or
 * switch the contact preference in the form on this page.
 */
export function ContactLink({
  intent,
  className,
  children,
  onNavigate,
}: {
  intent: ContactIntent;
  className?: string;
  children: ReactNode;
  /** Extra work after the click, e.g. closing the mobile menu. Client callers only. */
  onNavigate?: () => void;
}) {
  const href = intent.kind === "call" ? BOOK_CALL_HREF : CONTACT_HREF;
  const external = /^https?:\/\//i.test(href);

  return (
    <a
      href={href}
      className={className}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        if (!external) announceContactIntent(intent);
        onNavigate?.();
      }}
    >
      {children}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
