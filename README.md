# SULOAI — landing page

Automation & applied-AI landing page for a supply-chain consultancy. Next.js 16
(App Router) · React 19 · Tailwind v4 · Framer Motion · TypeScript.

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Before you launch — placeholders to replace

These are the only pieces of content that are invented. Everything else is
structural copy you can keep or edit freely.

| Where | What | File |
| --- | --- | --- |
| Footer contact details | Email, WhatsApp number, location | `src/components/layout/Footer.tsx` → `CONTACT` |
| Credibility stats | "9 yrs", "120+ processes", "4.5 hrs" | `src/components/sections/IntroVideo.tsx` → `CREDENTIALS` |
| Case results | All three engagement figures | `src/components/sections/Results.tsx` → `CASES` |
| Intro video | Drop `intro.mp4` into `public/media/` | see `public/media/README.md` |
| Domain | `SITE` constant used for SEO metadata | `src/app/layout.tsx` |

The results cards are deliberately written as *representative* engagement
patterns with no named clients, so nothing on the page misrepresents a real
customer. Swap in your own measured numbers, and get written sign-off before
attributing anything to a named client.

## Intro video

Drop an MP4 at `public/media/intro.mp4` (optional still at
`public/media/intro-poster.jpg`). The player probes for the file on mount and
switches from the branded placeholder to the real player automatically — no
code change. For anything above ~15 MB, host it externally and change
`VIDEO_SRC` in `src/components/sections/IntroVideo.tsx`.

## Contact form email

Every submission is saved as a lead in the admin CRM (see
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
a scoped solution outline. It is deterministic keyword scoring across 12
supply-chain playbooks — no API key, no per-visitor cost, instant response. It
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
| `public/brand/suloai-lockup.png` | Full vertical lockup — OpenGraph / social sharing |
| `public/brand/suloai-mark-square.png` | 512px padded square, for app icons or app stores |
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

Every decorative animation is disabled under `prefers-reduced-motion`, and the
typewriter and count-up both render their final value immediately in that mode.
Content is never gated on an animation completing — the hero's blueprint and CTA
reveal on a timer, not on the typing finishing, so a backgrounded tab can't
strand a visitor on a half-written answer.

---

## Admin dashboard

A private dashboard at **`/admin`** for analytics, CRM, billing and project
management. It is not linked from anywhere on the public site. Every page is
one click away in the sidebar, and the pages link to each other: a lead to its
quotations, agreement, invoices and project, and back.

| Page | What it does |
| --- | --- |
| `/admin` | Analytics — new leads, open and weighted pipeline, deals won this month, revenue collected, outstanding invoices, overdue follow-ups, agreements awaiting signature, active projects |
| `/admin/crm/pipeline` | The CRM pipeline: a kanban board of opportunities by stage (drag to move) |
| `/admin/crm` | Every lead as a searchable list, filterable by stage |
| `/admin/crm/activities` | Planner of scheduled calls, emails, meetings and follow-ups, overdue first |
| `/admin/crm/<id>` | One opportunity: details, timeline of notes and events, activities, linked documents |
| `/admin/billing` | Quotations and tax invoices in AED with 5% VAT, quote-to-invoice conversion, printable / PDF documents |
| `/admin/billing/agreements` | Service Agreements with their Statement of Work, generated from quotations |
| `/admin/projects` | Board of client projects with tasks, progress, due dates and invoiced-vs-value |
| `/admin/account` | Your password and sessions, and the team list |

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
2. `/api/contact` saves it as a **CRM lead** at the top of the pipeline's
   *New* column, with "Enquiry received via the website form" on its timeline.
3. The notification email includes an **"Open lead in dashboard"** button linking to
   `/admin/crm/<id>`. If you are signed out, you are taken to the login page and
   returned to that lead afterwards.

Saving and emailing are independent: if the database is unavailable the email
still goes out (flagged as unsaved), and if email fails the lead is still saved.

You can also add a card by hand on the pipeline board, e.g. for a client you
are approaching. Only a name is required; contact details can follow later.

### The CRM, Odoo-style

- **Pipeline.** Opportunities move through *New → Contacted → Qualified →
  Proposal → Won* by drag and drop (or the stage bar on the lead page). Each
  card shows its expected revenue, a 0–3 star priority, tags, the salesperson
  and an activity clock: red when a follow-up is overdue, amber when one is due
  today, green when one is planned.
- **Probability and weighted pipeline.** Every opportunity has a win
  probability, defaulting to its stage's (10/20/40/60%) unless you set one.
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
| `APP_URL` | Your public site URL, e.g. `https://suloai.com` — used for the dashboard link in lead emails |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Lead notification email (see above) |

There is no password variable: sign-in uses the admin accounts in the database
(see [Admin accounts](#admin-accounts)). An old `ADMIN_PASSWORD` can be removed
from your environment; nothing reads it.

### Deploying with Neon (recommended)

1. Create a free project at [neon.tech](https://neon.tech) and copy the **pooled**
   connection string.
2. In Vercel → Settings → Environment Variables, add `DATABASE_URL`,
   `SESSION_SECRET` and `APP_URL`.
3. Create or update the tables from your machine. Run this on first deploy
   **and every time a new migration is added** (for example
   `20260928090000_crm_pipeline_agreements_admins`, which adds the pipeline
   fields, activities, service agreements and admin accounts):

   ```bash
   DATABASE_URL="<your neon url>" npx prisma migrate deploy
   ```

   The migration only adds tables and columns (and relaxes a few lead fields
   to optional), so existing leads, quotations and invoices are kept.

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

The demo data covers every pipeline stage, activities that are overdue, due
today and planned, a lost deal, and a deal won this month with its accepted
quotation, a service agreement out for signature and the deposit invoice. It
assigns the demo leads to your existing admin accounts, so create an account
before seeding. Re-running the seed replaces the previous demo data.

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
  the database. `src/proxy.ts` adds an early redirect for signed-out visitors
  and `noindex` headers on top.
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
