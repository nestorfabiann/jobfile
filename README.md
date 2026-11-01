# Jobfile (phase 1)

A shared project record for contractors and homeowners. This first slice covers:

- Email sign-in (no passwords) for contractors and homeowners
- Contractor companies, projects, and homeowner invites by email
- A project message thread with Update / Question / Decision tags
- Email and text alerts to the other side, with per-person settings
- Row level security so each person only sees their own projects
- The agreement: scope and price, allowances, timeline, payment schedule, standard terms. The contractor drafts it and
  sends it, the homeowner reviews and both sign with typed names. Editing a sent agreement clears signatures, and the
  second signature locks it. Download a plain-text copy.
- Change orders: either side proposes, the other side approves or declines, the proposer can withdraw. Approved ones
  update the contract total and the finish date.
- Texas pieces: the disclosure statement step before the homeowner signs, and a homestead checklist (spouse signature,
  filed with the county clerk). See the Texas notes below.

- Overview page: stage bar, what needs your attention, money summary, schedule, latest photos, closeout and complete.
- Photos: progress photos and "needs fixing" details (contractor marks fixed, homeowner confirms). Private storage, shrunk in the browser.
- Payments: per-milestone tracker. Contractor requests, homeowner marks paid, contractor confirms receipt and lien waiver. Jobfile does not move money.

- Price check (homeowner only, off by default): compares each priced agreement line with typical prices in the area using Claude.
  Turn on with `PRICE_CHECK_ENABLED=true` and `ANTHROPIC_API_KEY`; run `005_price_checks.sql`. Limited to 3 checks per project per day.
  To remove: set `PRICE_CHECK_ENABLED=false` (hides it), or delete `src/lib/pricecheck.ts`, `src/app/projects/[id]/price-check`,
  `src/components/PriceQuestions.tsx`, the tab flag in `ProjectTabs.tsx`/`layout.tsx`, and `drop table public.price_checks`.

Not built yet: schedule editing, subcontractor list, lien waivers and bills-paid affidavit, PDFs.

**Status: written but not yet run.** The workspace this was written in could not reach the npm registry, so
`npm install`, the type check and `next build` have not been run. Expect to fix a few small errors on first build.

## Setup

1. **Supabase.** Create a project at supabase.com. In the SQL editor, run `001_init.sql`, `002_agreements.sql`, then `003_photos_payments_stage.sql`, then `004_milestone_payments.sql` (all in `supabase/migrations/`).
2. **Sign-in email.** In Supabase go to Authentication > Email Templates > Magic Link. Replace the link with:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to Jobfile</a>
   ```

   Then set Authentication > URL Configuration > Site URL to your app address (`APP_URL`).
   This link style works even if the person opens the email on a different device than they signed in from.
3. **Resend (email alerts).** Create an account at resend.com, verify your sending domain, create an API key.
   For production also set up custom SMTP in Supabase so sign-in emails come from your domain and are not rate limited.
4. **Twilio (text alerts, optional).** Buy a number. US business texting needs A2P 10DLC registration with
   Twilio before carriers deliver reliably. Start it early because approval takes days. Leave the Twilio
   variables blank to run with email only.
5. **Environment.** Copy `.env.example` to `.env.local` and fill it in.
6. **Run it.**

   ```bash
   npm install
   npm run typecheck
   npm run dev
   ```

7. **Deploy.** Import the repo in Vercel, add the same environment variables, set `APP_URL` to the live address.

## Try it

1. Sign in as yourself, choose "I'm a contractor", create a company and a project. Use a second email address you control for the homeowner.
2. Open the invite email and sign in as the homeowner in a private window.
3. Send a message from each side. The other side should get an in-app alert and an email (and a text if turned on in Settings).
4. Send two casual messages in a row. The second should not send another email (5 minute grouping). Tagged Questions and Decisions always send.

## How the pieces fit

| Path | What it does |
| --- | --- |
| `supabase/migrations/001_init.sql` | Tables, access rules, and the sign-up trigger that attaches invited homeowners to their projects |
| `src/middleware.ts` | Keeps the session fresh and redirects signed-out visitors to `/login` |
| `src/lib/notify.ts` | Records alerts, sends email through Resend and texts through Twilio, groups rapid messages |
| `src/app/projects/actions.ts` | Create company, create project, invite homeowner |
| `src/app/projects/[id]/*` | Message thread, send message, notify the other side |
| `src/app/projects/[id]/agreement/*` | Draft, edit, send, sign, lock, text export, Texas homestead steps |
| `src/app/projects/[id]/changes/*` | Propose, approve, decline, withdraw change orders |
| `src/lib/agreement.ts`, `money.ts` | Totals, validation, milestone amounts (money is stored as whole cents) |
| `src/app/settings/*` | Name, phone, alert preferences, text consent |

Writes to companies, projects, memberships and alerts use the service role key on the server, after the code checks who is
asking. Reads go through row level security. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Known limits and decisions to revisit

- Text alerts do not include message content on purpose. They link back to the login.
- The message thread refreshes every 15 seconds. Supabase Realtime would make it instant.
- Times display in Central time. Add a per-person time zone setting before using outside Texas.
- Only the person who creates a company is a member. Adding staff (office manager, crew lead) is not built yet.
- There is no email address change, account deletion, or data export yet.
- Some corporate email scanners open links before the person does and use up the one-time sign-in link. If
  customers report "link already used", switch to a 6-digit code instead of a link.

## Before real use in Texas (required)

`src/lib/texas.ts` holds a placeholder where the statutory disclosure text goes. Your attorney must supply the current
wording of Texas Property Code s. 53.255(b), then set `TX_DISCLOSURE_IS_PLACEHOLDER` to `false`. Until then the signing
screen shows a red warning. Also have the attorney review the standard terms in `src/lib/agreement.ts` and the default
payment milestones. Jobfile does not file homestead contracts, sign for a spouse, or give legal advice.

## Try the agreement flow

1. As the contractor, open a project, then Agreement > Start the agreement. Add items and fill in the dates and milestones.
2. Save, then "Send to homeowner". The homeowner gets an alert.
3. As the homeowner, read it, tick the disclosure box, type your name and sign. Then sign as the contractor.
4. After both signatures the agreement locks and the Changes tab opens. Propose a change order from one side and approve it from the other.

## Texas items for the next phase (have a Texas construction attorney review)

Per the Texas Property Code (check current text before relying on any of this):

- Residential contracts: the contractor gives the owner the statutory disclosure statement before the owner signs (s. 53.255).
- A list of subcontractors and suppliers before work starts, updated as it changes, unless the owner waives it in writing.
- Homestead: written contract signed before work or materials, both spouses sign if married, contract filed with the county clerk (s. 53.254).
- The owner is told to hold back 10% of payments during the work and for 30 days after completion.
- Final payment: a bills-paid affidavit from the contractor, and lien releases (s. 53.259 and the statutory waiver forms).
