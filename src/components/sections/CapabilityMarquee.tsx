import { Pause, Play } from "lucide-react";

/** The client's running list, in their order. */
const CAPABILITIES = [
  "Excel",
  "CSV",
  "PDF",
  "Outlook",
  "Email",
  "SharePoint",
  "OneDrive",
  "ERP",
  "CRM",
  "Web Portals",
  "Databases",
  "APIs",
  "Power Automate",
  "Browser Automation",
  "Internal Systems",
  "Power Apps",
  "Maintenance",
  "AI Agents",
  "Internal Chatbots",
  "Document Assistants",
  "Data Assistants",
  "Workflow Bots",
  "VBA",
  "Microsoft Integration",
];

/**
 * Infinite capability rail. The track holds two identical lists and slides by
 * exactly -50%, so the loop has no visible seam at any width: every item,
 * including the first of the second copy, is preceded by the same dot and gap.
 *
 * Pure CSS, so it renders on the server and ships no JavaScript. With reduced
 * motion the rail becomes a static, wrapped list of every item instead of
 * freezing with most of them clipped off-screen.
 *
 * Pausing (WCAG 2.2.2): hovering the rail pauses it, and so does the toggle
 * at its right edge, for keyboard and touch. The toggle is a native checkbox
 * drawn as a round button: it works before (and without) hydration, Space
 * operates it, and screen readers announce its checked state. The track
 * reads the state through the section's :has(:checked). Focus alone does not
 * pause it: clicking the label focuses the checkbox, so a focus pause would
 * keep the rail still after the visitor pressed play.
 */
export function CapabilityMarquee() {
  return (
    <section
      aria-labelledby="capabilities-heading"
      className="group/marquee relative border-y border-ink-100/80 bg-white/50 py-5 backdrop-blur-sm"
    >
      <h2 id="capabilities-heading" className="sr-only">
        Tools, systems and formats we work with
      </h2>

      {/* The rail stops 8px short of the pause toggle, so its right-hand fade
          ends before the button instead of running text underneath it. */}
      <div className="mask-fade-x mr-12 overflow-hidden sm:mr-14 lg:mr-16 motion-reduce:mr-0 motion-reduce:[-webkit-mask-image:none] motion-reduce:[mask-image:none]">
        <div className="flex w-max animate-marquee items-center gap-8 pr-8 hover:[animation-play-state:paused] group-has-checked/marquee:[animation-play-state:paused] sm:gap-12 sm:pr-12 motion-reduce:w-auto motion-reduce:animate-none motion-reduce:justify-center motion-reduce:px-4 sm:motion-reduce:px-6">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
              className={`flex shrink-0 items-center gap-8 sm:gap-12 ${
                copy === 1
                  ? "motion-reduce:hidden"
                  : "motion-reduce:min-w-0 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-6 motion-reduce:gap-y-2.5 sm:motion-reduce:gap-x-8 sm:motion-reduce:gap-y-3"
              }`}
            >
              {CAPABILITIES.map((c) => (
                <li
                  key={c}
                  className="flex shrink-0 items-center gap-2.5 font-display text-[0.92rem] font-medium text-ink-600 sm:text-[1.02rem]"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-aqua-500 to-lilac-400"
                  />
                  {c}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* Nothing moves under reduced motion, so there is nothing to pause. */}
      <div className="absolute inset-y-0 right-2 flex items-center sm:right-4 lg:right-6 motion-reduce:hidden">
        <input id="capabilities-pause" type="checkbox" className="peer sr-only" />
        <label
          htmlFor="capabilities-pause"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-600 glass transition-colors hover:text-ink-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-azure-500"
        >
          <Pause className="h-3.5 w-3.5 group-has-checked/marquee:hidden" aria-hidden="true" />
          <Play className="hidden h-3.5 w-3.5 group-has-checked/marquee:block" aria-hidden="true" />
          <span className="sr-only">Pause the scrolling list</span>
        </label>
      </div>
    </section>
  );
}
