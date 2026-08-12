# Suro AI — landing page

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

The form works out of the box: without credentials it validates, accepts the
submission, and logs the lead to the server console so nothing is lost. To send
real email, fill in `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxx
CONTACT_TO_EMAIL=you@yourdomain.com
CONTACT_FROM_EMAIL="Suro AI <noreply@yourdomain.com>"
```

The sending domain must be verified in Resend first. For testing you can use
`Suro AI <onboarding@resend.dev>` as the sender.

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

Type: Sora (display) · Inter (body) · JetBrains Mono (labels).

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
