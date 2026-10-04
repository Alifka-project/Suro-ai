# Landing page revision plan

Source: client document "Small task or complex system.docx" (received 4 Oct 2026).
Status: **built on 4 Oct 2026.** Where the client hadn't answered yet, these
defaults were used (all easy to change):
positioning broadened to every business function, with supply chain kept as
background; section label "Pain points"; line icons instead of emoji; pillars
"Automation · Integration · Intelligence"; Results section removed (its
numbers were placeholders); "100+ projects" as the only published figure;
WhatsApp hidden until a real number is set in `src/lib/site.ts`; "Book a call"
opens the form with "Video call" preselected unless `NEXT_PUBLIC_BOOKING_URL`
is set; package 9 (Training) wording drafted for the client to confirm.
Content now lives in `src/lib/site.ts`, `src/lib/packages.ts` and
`src/lib/faq-content.ts`.

## The big shift

The current page sells *supply-chain* automation ("Your supply chain has a
bottleneck."). The client's document repositions SULOAI as automation and AI
for **any business function and any size of problem** — "Small task or complex
system" — with supply chain as one of eight functions, and services organised
as **packages 0–9 from basic to complex** instead of by tool (Power Automate,
VBA, …).

## Proposed page order

| # | Section | Status | Notes |
|---|---|---|---|
| 1 | Hero | **Revise** | New headline + value pillars + new CTAs; keep the prompt console |
| 2 | Running badges (marquee) | Keep | Already the client's exact list |
| 3 | "Does this sound familiar?" | **New** | Six quote-bubble hooks |
| 4 | Pain points (today: Root causes) | **Revise** | Same 5 topics, client's richer copy |
| 5 | Technology-agnostic approach | **New** | Process → Systems → Data → Bottleneck → right tool |
| 6 | Across every business function | **New** | 8 functions × use cases, explorable |
| 7 | Services — packages 0–9 | **Replace** | Basic → complex ladder, grouped |
| 8 | How it works (Process) | Keep, light touch | Step 1 becomes the "Automation Audit" |
| 9 | Results | Keep (placeholders) | Not in the client doc — ask |
| 10 | About / profile (today: Intro video) | **Revise + move** | "100+ projects", individuals → SMEs → enterprises |
| 11 | FAQ | Keep, add 2–3 | Audit, project rescue, support retainer |
| 12 | Footer: form + contact | **Revise** | "Talk to us" / "Book a call", new service options |

The intro video section moves from the top to just before the FAQ/form,
matching the client's order ("Contact and profile information" next to the form).

## Section by section

### 1. Hero — revise
- Headline: "Small task or complex system — we turn business challenges into smarter solutions."
- Value position as three animated pillars under the headline: **Automate · Integrate · Intelligent** (wording to confirm, see questions).
- Eyebrow chip "Automation & AI, built for supply chain" → broader wording.
- CTAs: "Talk to us" (primary, to form) and "Book a call".
- Keep the prompt console; its 12 playbooks stay, but each answer should
  recommend one of the new packages (e.g. "Package 2 — Connect").

### 2. Running badges — keep
Already the client's list verbatim. Only fix capitalisation ("Power App(s)").

### 3. Hook "Does this sound familiar?" — new
Six short quotes, styled as chat bubbles that pop in on scroll:
"My team does this every single day." · "Our data is everywhere, and nothing
matches." · "We're still sending the same emails, manually." · "Our systems
don't talk to each other." · "That project? Started, then stuck." · "We know it
should be automated — we just don't know how."
Each bubble can link to the package that fixes it (e.g. "Started, then stuck" →
Project Rescue).

### 4. Pain points — revise the existing zigzag section
New titles from the client:
1. Too Much Manual Work, Too Often, Too Risky
2. Data Scattered, Duplicated & Never in the Same Format
3. Overcomplicated Excel & Formula Dependency
4. Heavy & Unstable Files
5. Poor or Untrusted Master Data

The client's copy is long. Earlier feedback was "too many words", so per item show:
the title, a two-line summary, the examples as compact chips (not sentences), and
the closing punchline ("What's manual, eventually goes wrong.") as the highlight.
Keep the zigzag timeline and scroll reveal.

### 5. Technology-agnostic approach — new
- Outcome strip: Time saved · Fewer errors · Less manual work · Higher efficiency.
- Statement: "We don't start with a technology and force your process into it."
- Animated flow: Your process → Your systems → Your data → Your bottleneck → the right automation approach.
- Short band, not a full section, to keep the page length in check.

### 6. Across every business function — new
Eight functions, each with its use-case list: Finance & Accounting ·
Procurement · Supply Chain, Logistics & Operations · HR & Administration ·
Sales & Customer Service · Legal & Compliance · Manufacturing & Planning ·
Executive & Business Management.
Format: tabs on desktop / swipeable chips on mobile; selecting a function shows
its use cases as chips. Only one function is open at a time, so the page stays short.

### 7. Services — replace with packages 0–9
Grouped ladder, basic → complex:

| Group | Packages |
|---|---|
| Start here | 0 Automation Audit |
| Working within what you already have | 1 Automate · 2 Connect · 3 Data Flow & Reporting |
| Adding intelligence | 4 AI Agents & Intelligent Solutions |
| Building something new | 5 Web & Business Applications |
| Special situations | 6 Project Rescue & Recovery · 7 Digital Solution / Custom Development · 8 Support & Continuous Improvement |
| Enablement | 9 Training (content incomplete — see questions) |

Each card: number + name, one-line promise, "Best for", and an expandable detail
(what it covers as chips, the example flow drawn as an animated step chain, e.g.
Collect → Clean → Transform → Validate → Consolidate → Report).
Replace every "[Brand Name]" with SULOAI. Tidy package 2's example flows
(wording in the doc is unclear).

### 8. How it works — light touch
Keep the four steps; rename step 1 to tie into package 0 (Automation Audit).

### 9. Results — keep for now
Still placeholder numbers. Ask the client whether to keep, replace with real
cases, or remove.

### 10. About / profile — revise and move
- Credentials: "100+ projects" and "Individuals · SMEs · Enterprises"
  (replaces the placeholder "9 yrs / 120+ processes / 4.5 hrs").
- Copy "Supply chain people who learned to build" → broader, keeping the
  supply-chain origin as credibility.

### 11. FAQ — add
Where do I start if I'm not sure? (→ Audit) · Can you finish a project another
developer left? (→ Rescue) · Do you offer ongoing support? (→ monthly retainer).

### 12. Footer, form and CTAs — revise
- Buttons site-wide: "Start a project" → "Talk to us"; add "Book a call".
- Form "services" step: options become the packages (0–9 + "Not sure yet").
- Footer link lists and the top nav: update to the new sections
  (Pain points, Functions, Services, How it works, FAQ).

## Knock-on changes outside the sections

- **Contact form options → CRM → agreements.** New leads will carry package
  names; the service agreement's "Package reference" line is filled from them
  automatically (the client's own template asks for "Package 1: Automate").
- **SEO**: page title and description in `src/app/layout.tsx` still say
  "for Supply Chain".
- **Documents**: the letterhead tagline on quotes, invoices and agreements
  (`src/lib/admin/business.ts`, "Automation & AI for Supply Chain") should match
  the new positioning.
- **Lead email** template copy, and the solution-engine answers (package names).

## Design approach (keeping the page fast to read)
New content roughly doubles the page. To avoid a wall of text: progressive
disclosure (tabs, expandable cards, chips instead of sentences), short visible
copy with detail one tap away, consistent section spacing as today, same web3
light style, animations and palette, fully responsive.

## Open questions for the client

1. **Positioning**: move away from "supply chain only" to all business
   functions? (Affects hero, SEO, About copy and the document letterhead.)
2. **Section label**: "Pain points" (client doc) or keep "Root cause"?
3. **Emoji** in the hook and function list, or matching line icons (current site style)?
4. **"Book a call"**: is there a booking link (Calendly / Google Calendar), or should it open WhatsApp or the form?
5. **Package 9 Training**: the document is incomplete ("… Master data preparation", "…how to use … in your work"). What does it include?
6. **Package 2 examples**: confirm the four example flows' wording.
7. **Value position wording**: "Automate · Integrate · Intelligent" or "Automate · Integrate · Intelligence"?
8. **Profile numbers**: is "100+ projects" the only figure? Real WhatsApp number?
9. **Results**: keep the three representative cases, replace with real ones, or remove?

## Suggested build order
1. Hero + CTAs + nav/footer links (positioning change visible immediately)
2. Services packages 0–9 + contact form options (feeds the CRM)
3. Pain points rewrite + new hook section
4. Approach band + business functions explorer
5. About/profile move, FAQ additions, SEO and document tagline
6. Full responsive/accessibility pass, build, push
