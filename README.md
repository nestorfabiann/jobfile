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

## Admin panel

Set `ADMIN_EMAILS` (comma separated) and run `supabase/migrations/006_admin.sql`. Admins get an **Admin** link in the header.

- **Overview / Activity**: counts and a merged feed of signups, projects, messages (metadata only), agreements, change orders, payments, photos and price checks.
- **Users / Projects**: search, details, timeline. Suspend or restore an account (blocks sign-in, stops existing sessions, skips alerts).
- **Conversation**: message text is visible only through a project's "View conversation", and each open is written to the audit log. Price check results are never shown.
- **Broadcast**: in-app alert plus email to everyone, all contractors, all homeowners, one project, or one person (200 per send, no texts).
- **Audit log**: every admin action.

Mention admin access in your terms and privacy policy.
To remove: delete `src/app/admin`, `src/app/banned`, `src/lib/admin*.ts`, `src/components/Admin*.tsx` and the Admin link in `src/app/layout.tsx`.

## Message translation (English and Spanish)

Set `TRANSLATE_ENABLED=true` (needs `ANTHROPIC_API_KEY`) and run `supabase/migrations/007_translation.sql`.
Each person picks English or Español in Settings. Incoming messages show a Translate button, and the newest ones translate automatically if that is on.
Translations are cached per message and language, limited to 150 new translations per person per day, and the model is `TRANSLATE_MODEL` (default claude-haiku-5-5).
Message text is sent to the Anthropic API to translate, so mention that in your privacy policy.
The agreement and emails are not translated. To remove: delete `src/lib/translate.ts`, `src/app/projects/[id]/translate.ts`, `src/components/TranslatedBody.tsx` and the language block in Settings.

## Ratings (both sides)

Run `supabase/migrations/008_reviews.sql`. No flag is needed. The Ratings tab appears on a project once the contractor marks it complete.
- Homeowners rate the contractor (5 categories), contractors rate the homeowner (4). One rating per side per project, editable until revealed.
- Ratings are hidden until both rate, or 14 days after completion.
- Public contractor profile at `/contractors/<company id>` (signed-in users only), with the contractor's single reply and a Report button.
- Homeowner ratings are private to Jobfile by default. Set `HOMEOWNER_RATINGS_VISIBLE=true` to show a contractor a score-only summary of a homeowner's past projects.
- Admin: `/admin/reviews` lists reported reviews. Hide (reason required) or dismiss. Everything is audit-logged.
To remove: delete `src/app/projects/[id]/rating`, `src/app/contractors`, `src/app/admin/reviews`, `src/lib/reviews.ts`, `src/components/{Stars,StarInput,AdminReviewActions}.tsx`, the Ratings tab flag and the review actions in `src/app/admin/actions.ts`.

## Contractor business profile

Run `supabase/migrations/009_contractor_profile.sql` once. Company owners edit it at Settings > Business profile (`/settings/business`): description, services, service area, languages, warranty, hours, payment methods, website and social links, logo, up to 24 work photos, and insurance certificates.
- Public page: `/contractors/[id]` (signed-in people only). Shows the Insurance verified badge only while an admin-approved certificate is unexpired.
- Certificates live in the private `company-docs` bucket. Only admins can open them (`/admin/verification`, each open is written to the audit log). They are never linked from public pages.
- Work photos live in the private `company-photos` bucket and are shown through one-hour signed links.
- To remove the feature: drop the three new tables and the added `companies` columns, delete the two buckets, and delete `src/app/settings/business`, `src/app/admin/verification`, `src/lib/companyProfile.ts` and the two components.
- Not built: automatic expiry reminder emails. The badge simply disappears on the expiry date.

## Homeowner-started projects (invite a contractor)

Run `supabase/migrations/010_project_invites.sql` once. A homeowner (anyone who is not a company member) taps "Start a project and invite a contractor" on the Projects page (`/invites/new`). The details wait in `project_invites` until the contractor accepts at `/invites/[id]`. Accepting creates the normal project (the contractor's company, both people as members, the homeowner's description as the first message) and tells the homeowner.
- Only the person who signs in with the invited email (confirmed) can see or accept the invite. Forwarded links do nothing for anyone else.
- Limits: 5 waiting invites per homeowner, 10 new invites per 24 hours, 3 sends per invite (resend once an hour apart), invites expire after 14 days.
- Contractors with no company type a company name when they accept; one is created for them.
- Photos can be added once the project is open. Pre-accept photo upload is not built.
- Not yet shown in the admin activity feed.
- To remove: drop `project_invites`, delete `src/app/invites`, `src/lib/invites.ts`, and the invitation blocks in `src/app/projects/page.tsx`.
