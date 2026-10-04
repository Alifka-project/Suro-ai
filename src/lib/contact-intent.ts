/**
 * Lets any button on the page open the contact form already pointed at what
 * the visitor wants: "Book a call" preselects a call as the contact
 * preference, and "Talk to us about this package" ticks that package.
 *
 * Buttons stay real links to #contact (they work without JavaScript and when
 * opened in a new tab); the click handler additionally dispatches this event,
 * which the contact form listens for.
 *
 * No "use client" here on purpose: server components import the hrefs as
 * plain strings. announceContactIntent only ever runs in an event handler.
 */
import { BOOKING_URL, SECTION_IDS } from "./site";

export const CONTACT_INTENT_EVENT = "suloai:contact-intent";

export type ContactIntent = {
  /** "call" preselects "Video call" as the contact preference. */
  kind: "call" | "message";
  /** A package formLabel (see packages.ts) to tick in the services step. */
  packageLabel?: string;
};

export const CONTACT_HREF = `#${SECTION_IDS.contact}`;

/** Where a "Book a call" link should point: the booking page if one is configured, else the form. */
export const BOOK_CALL_HREF = BOOKING_URL ?? CONTACT_HREF;

/** Dispatches the intent. Call from an onClick on a link to CONTACT_HREF. */
export function announceContactIntent(intent: ContactIntent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ContactIntent>(CONTACT_INTENT_EVENT, { detail: intent }));
}
