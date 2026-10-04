"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";

/**
 * The tab state for the business functions section, and nothing else: the
 * labels, icons and panel content are rendered by the server component and
 * passed in. Every panel stays in the DOM (inactive ones carry the `hidden`
 * attribute), so all use cases are in the server HTML.
 *
 * WAI-ARIA tabs with automatic activation: arrow keys move focus and select,
 * Home and End jump to the ends, and only the selected tab is in the tab
 * order (roving tabindex).
 */

export type FunctionTabItem = {
  id: string;
  /** Full name, shown from lg up where the list is a sidebar. */
  label: string;
  /** Short name for the two- and four-column grids on smaller screens. */
  shortLabel: string;
  icon: ReactNode;
  /** Gradient stops for the selected tab's icon, e.g. "from-abyss-600 to-azure-400". */
  tone: string;
  panel: ReactNode;
};

/** Matches Tailwind's lg breakpoint, where the tab list becomes a vertical sidebar. */
const WIDE_QUERY = "(min-width: 64rem)";

function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** False on the server and during hydration, then the real value. */
function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

const tabId = (id: string) => `function-tab-${id}`;
const panelId = (id: string) => `function-panel-${id}`;

export function BusinessFunctionTabs({
  items,
  label,
}: {
  items: FunctionTabItem[];
  /** Accessible name for the tab list. */
  label: string;
}) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wide = useIsWide();

  function selectAndFocus(index: number) {
    const next = (index + items.length) % items.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    // Both axes work at every size: the list is a grid on phones and a
    // vertical sidebar on desktop, and visitors reach for either pair.
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        selectAndFocus(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        selectAndFocus(index - 1);
        break;
      case "Home":
        selectAndFocus(0);
        break;
      case "End":
        selectAndFocus(items.length - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  return (
    <div className="mt-9 grid gap-4 sm:mt-11 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-6">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={wide ? "vertical" : "horizontal"}
        className="grid min-w-0 grid-cols-2 gap-1.5 self-start rounded-3xl glass p-1.5 md:grid-cols-4 lg:grid-cols-1 lg:gap-1 lg:p-2"
      >
        {items.map((item, i) => {
          const selected = i === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(item.id)}
              aria-selected={selected}
              aria-controls={panelId(item.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`group flex min-h-12 min-w-0 items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-[0.85rem] font-medium leading-tight transition-[background-color,box-shadow,color] duration-300 sm:text-[0.9rem] lg:min-h-10 lg:rounded-xl lg:px-3 lg:py-1.5 ${
                selected
                  ? "bg-white text-ink-900 shadow-[0_10px_24px_-16px_rgb(7_38_60/0.6)] ring-1 ring-ink-200/80"
                  : "text-ink-700 hover:bg-white/60 hover:text-ink-900"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 lg:h-7 lg:w-7 lg:rounded-lg ${
                  selected
                    ? `bg-linear-to-br text-white shadow-[0_8px_16px_-10px_rgb(7_38_60/0.7)] ${item.tone}`
                    : "bg-ink-100 text-ink-600 group-hover:text-ink-800"
                }`}
              >
                {item.icon}
              </span>
              <span className="min-w-0 lg:hidden">{item.shortLabel}</span>
              <span className="hidden min-w-0 lg:block">{item.label}</span>
              <ChevronRight
                aria-hidden="true"
                className={`ml-auto hidden h-4 w-4 shrink-0 transition-[color,transform] duration-300 lg:block ${
                  selected ? "translate-x-0.5 text-ink-700" : "text-ink-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        {items.map((item, i) => (
          <div
            key={item.id}
            role="tabpanel"
            id={panelId(item.id)}
            aria-labelledby={tabId(item.id)}
            tabIndex={0}
            hidden={i !== active}
            className="h-full rounded-3xl"
          >
            {item.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
