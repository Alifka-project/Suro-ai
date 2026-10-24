# SULOAI — website

The public landing page and the private admin dashboard for SULOAI, a
Dubai-based business automation and AI consultancy. Next.js 16 (App Router) ·
React 19 · Tailwind v4 · Framer Motion · TypeScript.

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## The landing page

**Positioning:** "Small task or complex system — we turn business challenges
into smarter solutions." Automation, integration and AI for any business
function and any size of problem, for individuals, SMEs and enterprises. Supply
chain and logistics is the team's background and credibility, not the whole
pitch.

### Sections, in page order

`src/app/page.tsx` sets the order. Section files are in
`src/components/sections/` unless noted.

| # | Section | File | Anchor |
| --- | --- | --- | --- |
| 1 | Hero: headline, value pillars, solution console | `Hero.tsx` | `#top` |
| 2 | Running capability badges | `CapabilityMarquee.tsx` | — |
| 3 | Pain points | `PainPoints.tsx` | `#pain-points` |
| 4 | Technology-agnostic approach | `Approach.tsx` | `#approach` |
| 5 | Business functions | `BusinessFunctions.tsx` | `#functions` |
| 6 | Services: packages 0–9 | `Services.tsx` | `#services`, each package `#service-<id>` |
| 7 | About / profile | `About.tsx` | `#about` |
| 8 | FAQ | `Faq.tsx` | `#faq` |
| — | Footer with the contact form | `src/components/layout/Footer.tsx`, `ContactForm.tsx` | `#contact` |

### Where the content lives

Anything shown in more than one place has a single source, so the page, the
contact form, the CRM and the search-engine data can't drift apart:

| File | What it holds |
| --- | --- |
| `src/lib/site.ts` | Site URL, brand name, tagline and descriptor, the three value pillars, contact details (email, WhatsApp, city), the booking link, the profile line and the only published figures, section anchors |
| `src/lib/packages.ts` | The ten service packages (0–9): promise, what each covers, example flows, who it is best for. `formLabel` ("Package 1: Automate") is what the contact form stores on a lead and what a service agreement prints as its package reference |
| `src/lib/faq-content.ts` | FAQ questions and answers. Plain text, because the same strings are published as structured data |
| `src/lib/contact-intent.ts` | How "Talk to us" and "Book a call" buttons pre-fill the contact form |

Copy used by only one section lives in that section's file.

The only figures on the page are the client's own (`PROFILE` in `site.ts`:
100+ projects, three client sizes, eight business functions). Don't add
numbers, client names or testimonials without the client's written sign-off.

### Before launch

| What | Where |
| --- | --- |
| **WhatsApp number.** `CONTACT.whatsapp` is `null`, so every WhatsApp link is hidden rather than showing a made-up number. Set it in international format (`"+971 50 123 4567"`) and the links appear, and the number is added to the structured data. | `src/lib/site.ts` |
| **Booking page.** Without `NEXT_PUBLIC_BOOKING_URL`, "Book a call" opens the contact form with "Video call" preselected. | Vercel env |
| **Domain.** Set `NEXT_PUBLIC_SITE_URL` once a custom domain points at this Vercel project. | Vercel env |
| **Intro video (optional).** Drop an MP4 at `public/media/intro.mp4` (and a still at `public/media/intro-poster.jpg` if you have one). The About section checks for the file and switches from its brand panel to the player, with no code change. For anything above ~15 MB, host it externally and change `VIDEO_SRC` in `About.tsx`. | `public/media/` |

### Environment variables for the landing page

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The public URL used for canonical links, the sitemap, OpenGraph tags and structured data, e.g. `https://suloai.com`. Set it when a custom domain points at Vercel. If unset, Vercel's production domain is used (`VERCEL_PROJECT_PRODUCTION_URL`, provided automatically), then `http://localhost:3000`. Don't point it at suloai.com while that domain still serves the old Squarespace site: search engines would treat this page as a copy of it. |
| `NEXT_PUBLIC_BOOKING_URL` | A Calendly or Google Calendar appointment page. When set, every "Book a call" button opens it. |

`NEXT_PUBLIC_` values are fixed at build time, so redeploy after changing
them.

### SEO

| File | Produces |
| --- | --- |
| `src/app/layout.tsx` | Title, description, keywords, canonical link, OpenGraph and X (Twitter) tags, robots meta |
| `src/components/seo/StructuredData.tsx` | The shared title and descriptions (`SEO_TITLE`, `SEO_DESCRIPTION`, `SHARE_DESCRIPTION`) and the JSON-LD: Organization, WebSite, the page with its FAQ, and an OfferCatalog of the ten packages. Built from `site.ts`, `packages.ts` and `faq-content.ts`. No ratings, reviews or prices, because none have been published |
| `src/app/opengraph-image.tsx`, `src/app/twitter-image.tsx` | The 1200×630 link-preview image, generated at build time |
| `src/app/robots.ts` | `/robots.txt`: crawlers may visit everything except `/admin` and `/api`, and are pointed at the sitemap |
| `src/app/sitemap.ts` | `/sitemap.xml`: the home page |
| `src/app/manifest.ts` | `/manifest.webmanifest` |
| `src/app/icon.png`, `src/app/apple-icon.png` | Favicon and iOS touch icon |

Conventions to keep when editing sections: one `h1` on the page (the hero),
one `h2` per section, `h3` for items inside it. Content inside tabs and
accordions stays in the HTML (hidden with CSS, not unmounted) so search
engines can read it. Images need `alt` text, and link text should say where it
goes.

The preview image is set in Saira, the open-source face the SULOAI font is
based on, fetched from Google Fonts at build time (it falls back to a plain
sans if the fetch fails). The renderer can't read the `.woff2` files in
`src/app/fonts/`; add `SULOAI-Bold.ttf` and `SULOAI-Medium.ttf` from the
designer's font package to that folder and the image uses them instead.

After each deploy that changes content, check the live URL with Google's
[Rich Results Test](https://search.google.com/test/rich-results) and the
[Schema Markup Validator](https://validator.schema.org/), and submit
`/sitemap.xml` in Google Search Console once the domain is final.

## Contact form email


Every submission is saved as a client on the admin dashboard (see
[Admin dashboard](#admin-dashboard)). Email is an extra notification on top: without
credentials the form still validates, saves the lead, and simply skips the email.
To send real email, fill in `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxx
CONTACT_TO_EMAIL=you@yourdomain.com
CONTACT_FROM_EMAIL="SULOAI <noreply@suloai.com>"
```

The sending domain must be verified in Resend first. For testing you can use
`SULOAI <onboarding@resend.dev>` as the sender.

The route also has a honeypot field and a simple per-IP rate limit (5/min). The
limiter is in-memory, which is correct for a single instance — move it to Redis
if you scale to multiple.

## The hero solution engine

`src/lib/solution-engine.ts` turns a free-text description of a bottleneck into
a scoped solution outline. It is deterministic keyword scoring across a set
of playbooks — no API key, no per-visitor cost, instant response. It
also detects named systems (SAP, Excel, EDI…) and volume phrases so the reply
quotes the visitor's own context back to them.

**To back it with a real model instead:** `generateSolution()` is the only seam.
Add `src/app/api/solution/route.ts` that calls the Anthropic API and returns
JSON matching the exported `SolutionResult` type, then swap the
`generateSolution(input)` call in `PromptConsole.tsx` for a `fetch`. Keep this
module as the fallback for errors, rate limits, or a missing key. Nothing else
in the UI changes.

Playbooks live in the `PLAYBOOKS` array — adding one is a single object with
weighted keywords, a diagnosis, a four-step blueprint, and outcome figures.

## Design system

The palette is sampled directly from the reference boards and lives in the
`@theme` block of `src/app/globals.css`:

| Token | Hues |
| --- | --- |
| `abyss` | `#0766A3` `#2067A5` — anchor blue, used sparingly so text never sits on a dark field |
| `azure` | `#3686D5` `#6FAFD6` |
| `aqua` | `#41B0CC` `#69C2DC` |
| `mint` | `#8ED1C4` `#96D9D2` `#ADDBC2` |
| `lilac` | `#B5ABE6` `#C6AFE2` `#C3A3E1` |
| `blush` | `#FD9CC2` `#FEB5D5` `#FEA4C8` |

### Typography

**SULOAI** carries both display and body text, self-hosted from
`src/app/fonts/` via `next/font/local` (4 weights: 300/400/500/700, woff2).
JetBrains Mono remains for the small mono eyebrows and data labels, since the
brand face has no monospace cut.

The face is Saira (SIL Open Font License) re-exported and renamed by the brand's
designer — see `src/app/fonts/SULOAI-FONT-README.txt`. OFL permits that,
including commercial use. One nit: the PostScript name inside the files still
reads `SUROAI-Regular` from an earlier naming pass. Harmless on the web (the CSS
family name is what matters) but worth fixing before handing the files to a
print or design team.

### Brand assets

| File | Use |
| --- | --- |
| `public/brand/suloai-mark.png` | The S mark, used in the header and footer lockups |
| `public/brand/suloai-lockup.png` | Full vertical lockup, for documents and print. Not used on the site: the link-preview image is generated by `src/app/opengraph-image.tsx` |
| `public/brand/suloai-mark-square.png` | 512px padded square: the logo in the structured data and the large web-manifest icon |
| `src/app/icon.png`, `src/app/apple-icon.png` | Favicon and iOS touch icon |

The header pairs the **mark only** with `SULOAI` as live text rather than
dropping in the supplied lockup. The lockup is vertical — mark stacked over
wordmark — so at the ~36px height a site header allows, its wordmark renders as
unreadable mush. Live text stays crisp at every size, is selectable, and is
readable by search engines.

The mark is the flowing ribbon S, per the client's choice. Two notes on it: the
favicon is cropped tight and lightly sharpened, because a detailed 3D ribbon
loses definition at the 16–32px a browser tab renders — a flatter mark would
read more sharply there if you ever want to revisit it. And the crop drops a
stray fragment of the wordmark's dotted "i" that sat inside the mark's bounding
box in the original file.

Note the supplied logo files are PNG bitmaps wrapped in an SVG container (a
colour image plus a luminance mask), not true vector, so they don't scale
indefinitely. The assets above were composited to transparent PNG and trimmed
from those originals. If you ever need large-format print, ask your designer for
a genuine vector version.

Reusable pieces: `AuroraField` (the animated background), `SpotlightCard`
(pointer-following glass card), `Reveal`/`RevealGroup` (scroll entrances),
`SectionHeading`.

> One caution when editing `globals.css`: don't declare `position` inside an
> `@utility` block. Tailwind emits utilities after its own, so a
> `@utility grain { position: relative }` silently overrides `absolute` on any
> element carrying both.

## Accessibility & motion

Every decorative animation is disabled under `prefers-reduced-motion`, and
anything that types or counts up renders its final value immediately in that
mode.
Content is never gated on an animation completing — the hero's blueprint and CTA
reveal on a timer, not on the typing finishing, so a backgrounded tab can't
strand a visitor on a half-written answer.

---

## Admin dashboard

A private dashboard at **`/admin`**, not linked from anywhere on the public
site. It currently runs as **two pages**: the client dashboard and Expenses.

| Page | What it does |
| --- | --- |
| `/admin` | The client dashboard: five cards (Clients, New, Goal, Project value, Revenue), monthly revenue and customer-engagement charts for the last 12 months, and a table of every client (website enquiries and projects added with "Add project"): their details, WhatsApp and call buttons, a quotation and an invoice button, a status you can change in place, and Remove |
| `/admin/expenses` | Every cost the business pays, as project costs (linked to a client) or running costs: monthly totals, profit over the last 12 months, a monthly expenses-and-revenue chart, a breakdown by category, a filterable list with add / edit / delete, and a CSV export (`/admin/expenses/export`) |
| `/admin/billing/quotes/new?leadId=<id>` and `/admin/billing/invoices/new?leadId=<id>` | Create a quotation or tax invoice prefilled from a client (opened from the table) |
| `/admin/billing/quotes/<id>` and `/admin/billing/invoices/<id>` | View, edit (drafts), print / save as PDF, change the document's status, convert an accepted quote to an invoice |
| `/admin/account` | Your password and sessions, and the team list |

Quotations and invoices are in AED with 5% VAT. Their "Back" links return to
the dashboard.

### Client statuses

The status column uses the team's words, in this order:

| Shown as | Stored as | Meaning |
| --- | --- | --- |
| New | `NEW` | New enquiry or project, nothing sent yet |
| Quotation sent | `PROPOSAL` | Quotation with the client |
| Invoice sent | `INVOICED` | Invoice sent, waiting for payment |
| Goal | `WON` | Deal closed |
| Cancel | `LOST` | Not going ahead |

The labels and the list (`CLIENT_STATUSES`) live in `src/lib/admin/labels.ts`.
Any status can be set by hand. The paperwork also moves a client forward on its
own, never backwards (`advanceClientStatus` in `src/lib/admin/deals.ts`):

- marking a draft quotation **sent** moves a New client to **Quotation sent**;
- marking a draft invoice **sent** moves it to **Invoice sent**;
- marking an invoice **paid** makes it **Goal**.

None of these moves a cancelled client. Accepting a quotation always makes the
client **Goal**, even from Cancel, because the client's yes decides it.

Each move is written to the client's timeline. The CRM's own stages
`CONTACTED` and `QUALIFIED` stay in the enum for the switched-off CRM; the
migration that added `INVOICED` moved every client in them to New.

### Removing a client

The bin button on a row (**Remove** on phones) asks for confirmation, then
takes the client off the table and out of the client counts, Project value,
the engagement chart and the sidebar badge. Nothing is deleted: `Lead.removedAt`
is set, so the client's quotations, invoices, expenses and timeline stay
intact, their invoices still count in Revenue and the revenue chart, and
**Undo** in the message puts them straight back. Lists
and counts use `ACTIVE_CLIENT` from `src/lib/admin/clients.ts`; a quotation or
invoice page still shows who it was for. The switched-off modules don't filter
removed clients yet (see the note in that file before turning one back on).

### Expenses

`/admin/expenses` records what the business spends: the date, amount (AED,
VAT included), category, what it was for, who was paid, an optional project
(any client on the dashboard) and notes. A cost without a project is a running
cost. Categories are listed in `src/lib/admin/expenses.ts`; they are stored as
plain keys, so a new one needs no migration. Profit on the page is revenue
collected (the dashboard's definition) minus expenses over the same 12 months.
Each client's details on the dashboard show its project costs, with a link to
add one.

### Switched-off modules

The full CRM (pipeline, leads list, activities, opportunity pages), projects,
the analytics page, the billing overview and quotation / invoice lists, and
service agreements are all **kept in the codebase but switched off** in
`src/lib/admin/modules.ts`:

```ts
export const ADMIN_MODULES = {
  analytics: false,  // /admin/analytics
  crm: false,        // /admin/crm/**
  projects: false,   // /admin/projects/**
  billing: false,    // /admin/billing overview and list pages
  agreements: false, // /admin/billing/agreements/** and agreement generation
} as const;
```

While a module is off its sidebar entry is hidden, nothing links to it, and its
URLs redirect to `/admin` (an old `/admin/crm/<id>` link opens that client's
row on the dashboard instead). **Set flags to `true` to bring modules back** —
their pages, sidebar entries and links return. The modules link into one
another, so a module only comes back once every module it needs is on too
(`MODULE_REQUIRES` in the same file): billing, agreements and projects come
back together; the CRM needs those three; analytics needs all of them. The
sections below on the CRM, deal automation and service agreements describe
those modules for when they are switched on.

### Admin accounts

Each person signs in with their own **admin ID and password**. There is no
shared password and no sign-up page: accounts are managed from a terminal with
the `admin:user` script, against whichever database `DATABASE_URL` (or
`.env.local`) points at.

```bash
npm run admin:user -- list                              # everyone, active or not, with last sign-in
npm run admin:user -- create alifka "Alifka"            # new account; you are asked for its password
npm run admin:user -- set-password alifka               # reset a password; signs out their other sessions
npm run admin:user -- deactivate alifka                 # blocks sign-in and ends their sessions at once
npm run admin:user -- activate alifka
```

Passwords are **never** taken as command-line arguments (they would end up in
shell history and the process list). In a terminal you get a hidden prompt,
asked twice. From a script, pipe the password on stdin:

```bash
printf '%s\n' "$NEW_PASSWORD" | npm run admin:user -- set-password alifka
```

Admin IDs are 3–32 characters (letters, numbers, `.`, `-`, `_`) and are
case-insensitive. Passwords need at least 10 characters.

Signed-in admins can change their own password at **`/admin/account`**, which
signs out every other device they are signed in on, and can "Sign out all other
devices" there without changing it. The same page lists the team (read-only).

### How a lead flows in

1. A visitor submits the contact form.
2. `/api/contact` saves it as a client with status **New**, at the top of the
   dashboard's client table (and of the CRM pipeline's *New* column), with
   "Enquiry received via the website form" on its timeline.
3. The notification email includes an **"Open client in dashboard"** button
   linking to that client's row on the dashboard (`/admin?client=<id>#clients`;
   their opportunity page instead while the CRM is switched on). If you are
   signed out, you are taken to the login page first. If the client has been
   removed since, the dashboard says so.

Saving and emailing are independent: if the database is unavailable the email
still goes out (flagged as unsaved), and if email fails the lead is still saved.

With the CRM switched on you can also add a card by hand on the pipeline board,
e.g. for a client you are approaching. Only a name is required; contact details
can follow later.

### The CRM, Odoo-style

- **Pipeline.** Opportunities move through *New → Contacted → Qualified →
  Proposal → Invoice sent → Won* by drag and drop (or the stage bar on the lead page). Each
  card shows its expected revenue, a 0–3 star priority, tags, the salesperson
  and an activity clock: red when a follow-up is overdue, amber when one is due
  today, green when one is planned.
- **Probability and weighted pipeline.** Every opportunity has a win
  probability, defaulting to its stage's (10/20/40/60/80%) unless you set one.
  Expected revenue × probability is the *weighted pipeline* on the overview.
- **Activities.** Schedule a call, email, meeting, to-do or follow-up on any
  opportunity, with a due date and an assignee. Marking one done asks for
  feedback, which is logged on the timeline. The Activities page and the
  sidebar badge show what is overdue.
- **Timeline.** Notes you write sit alongside events the system records:
  stage changes, won/lost, quotations accepted, agreements generated and sent,
  invoices created.
- **Won / Lost.** Lost asks for a reason (plus an optional note) and takes the
  card off the board; it can be restored to the stage it was in. Lost
  opportunities are left out of every pipeline figure.

### Deal automation: quotation → service agreement

When a deal is won, its paperwork is generated for you:

- **Accepting a quotation** (Billing) generates its **Service Agreement** as a
  draft and marks the linked opportunity **Won**.
- **Marking an opportunity Won** (CRM) uses its accepted quotation — or accepts
  the latest sent one, or takes the latest draft — and generates the agreement
  from it. With no quotation at all but an expected revenue, it first creates a
  draft quotation from that revenue, so the quotation and agreement arrive
  together for review.

The whole chain runs in one database transaction and every step lands on the
lead's timeline. The agreement is prefilled from the quotation (client, price,
one scope line per quote line) and the opportunity (project name, enquiry text
as background), plus the standard terms.

### Service agreements

Each agreement (numbered `SA-YYYY-NNNN`) holds the agreement terms and its
Statement of Work: scope, deliverables, out of scope, assumptions, a milestone
timeline and the three-stage payment schedule (50% deposit / 25% milestone /
25% final by default).

- **Edit** — only a *Draft* can be edited or re-synced from its quotation. Money
  and client details are snapshots, so a sent or signed agreement never changes
  if the quotation is edited later.
- **Statuses** — *Draft → Sent for signature → Signed*, or *Cancelled*. Sending
  locks the terms; "Back to draft" unlocks them while no payment stage has been
  invoiced.
- **Download / print** — a Word document (`.docx`, A4, letterhead) for the
  client to sign, or print / save as PDF from the browser.
- **Payment-schedule invoices** — one click creates the tax invoice for each
  stage (deposit, milestone, final), due on the agreement's payment terms. Each
  stage can be invoiced once.
- **Create project** — turns the SOW into a project on the Projects board,
  linked back to the agreement.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon, Vercel Postgres, …) |
| `SESSION_SECRET` | Signs session cookies. **At least 32 characters**; the app refuses to start without it. Generate one with `openssl rand -base64 32`. |
| `APP_URL` | The URL this app is deployed at (where `/admin` lives), e.g. your Vercel or custom domain — used for the dashboard link in lead emails |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Lead notification email (see above) |

The landing page's own variables (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BOOKING_URL`)
are described [above](#environment-variables-for-the-landing-page).

There is no password variable: sign-in uses the admin accounts in the database
(see [Admin accounts](#admin-accounts)). An old `ADMIN_PASSWORD` can be removed
from your environment; nothing reads it.

### Deploying with Neon (recommended)

1. Create a free project at [neon.tech](https://neon.tech) and copy the **pooled**
   connection string.
2. In Vercel → Settings → Environment Variables, add `DATABASE_URL`,
   `SESSION_SECRET` and `APP_URL`.
3. Vercel's build runs `npm run vercel-build`, which applies any new
   migration (`prisma migrate deploy`) before `next build`, so every push
   migrates the database first. A migration that fails fails the build, and the
   previous deployment stays live. To migrate by hand instead (first deploy, or
   another host):

   ```bash
   DATABASE_URL="<your neon url>" npx prisma migrate deploy
   ```

   The migrations only add tables, columns and enum values, so existing leads,
   quotations and invoices are kept and the deployed code keeps working
   meanwhile. One data change is one-way: `20261024120000_statuses_remove_expenses`
   (Invoice sent, Remove, Expenses) moves clients in Prospect / Follow-up to
   New.

4. Create at least one admin account against the same database, then redeploy.
   `postinstall` runs `prisma generate` automatically on Vercel.

   ```bash
   DATABASE_URL="<your neon url>" npm run admin:user -- create <admin-id> "<Your name>"
   ```

Never run `npm run db:seed` against production — the seeder refuses to run
unless `DATABASE_URL` points at `localhost`, and every lead it creates is tagged
`source = "demo"`.

### Local development

```bash
npm run db:migrate                               # apply migrations to your local DATABASE_URL
npm run admin:user -- create <admin-id> "<name>"  # an account to sign in with
npm run db:seed                                  # optional demo data (localhost only)
npm run db:studio                                # browse the database
```

The demo data covers every dashboard status, activities that are overdue, due
today and planned, a cancelled deal, a deal won this month with its accepted
quotation, a service agreement out for signature and the deposit invoice, and
a year of expenses (running costs plus costs booked to two projects). It
assigns the demo leads to your existing admin accounts, so create an account
before seeding. Re-running the seed replaces the previous demo data, including
anything you added to a demo client; other expenses you entered in the app are
kept.

### Security model

- **Sign-in:** per-person admin accounts. Passwords are hashed with scrypt
  (never stored or logged in plain text) and exchanged for a signed (HS256)
  HTTP-only session cookie that lasts 7 days. Failed sign-ins are rate-limited
  per IP and per admin ID, and an unknown ID takes as long to refuse as a wrong
  password, so response times don't reveal which IDs exist.
- **Changing a password needs the current one, and guesses are capped.** Five
  wrong current passwords within 15 minutes (counted per account, in memory)
  sign the account out on every device, including the one guessing, so a
  stolen session cookie can't be used to guess its way to a takeover. The
  owner simply signs in again.
- **Sessions can be revoked.** Each account has a session version carried in
  its cookie. Changing a password, "Sign out all other devices", too many
  wrong current passwords and deactivating an account bump it, which ends the
  affected sessions on their next request rather than when the cookie expires.
- **Every read and every mutation is authorised**, not just the page shell.
  Next.js 16 documents both the proxy and layouts as insufficient on their own
  (layouts don't re-run on client navigation; Server Actions are public POST
  endpoints), so `requireAdmin()` in `src/lib/admin/dal.ts` is called at the top
  of every admin page and every Server Action, and re-reads the account from
  the database. The Expenses CSV export (a route handler) checks it too.
  `src/proxy.ts` adds an early redirect for signed-out visitors and `noindex`
  headers on top.
- **Post-login redirects** only accept `/admin/...` paths, so the `?next=`
  parameter can't be used as an open redirect.
- **Money** is stored as integer fils (1 AED = 100 fils) and VAT as basis points,
  so totals never drift from floating-point rounding.

### Dependency notes

`npm audit` reports a *high* advisory in `deepmerge-ts`, reached only through the
Prisma **CLI** (`prisma` → `@prisma/config`). It is not in the runtime import
graph — `@prisma/client` has no dependencies — and it only ever merges the
project's own Prisma config, so it isn't exploitable in production. npm's
suggested "fix" is a downgrade to Prisma 6.12, which would be a worse trade.
