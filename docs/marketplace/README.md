# Marketplace (approved design, NOT built)

Status: mockups approved by the owner on 2026-11-01. Build only when the owner says so.
Mockups: `mockup-marketplace.html` (landing, post, board, bids) and `mockup-handoff.html` (accept bid -> Jobfile project).
Published previews: https://claude.ai/artifact/9GQT1nxncYnf7u3JeoscnQ and https://claude.ai/artifact/CDd8spHDH49LiGpbq69cGL

## What it is
Homeowners post projects. Local contractors bid. An AI cost reference shows the homeowner the typical local price range for the scope. Accepting a bid creates a normal Jobfile project (price, scope, photos carried over) and both sides continue there: messages, translation, recorded payments, change orders, ratings.

## Decisions already made
- One app, not a separate site. Existing contractor-created projects keep working; a project can start from an accepted bid too.
- Landing stats stay blank until real. No invented numbers or testimonials.
- AI range is labeled a reference, not a quote. Reuse the Anthropic setup and daily-limit pattern from Price Check/translation.
- Contractor contact details and the homeowner's exact address stay private until a bid is accepted.
- Bids show the contractor's Jobfile rating. A bid far below the AI range gets a warning.
- Accepting never charges anything; Jobfile only records payments.
- Open question: keep the suggested 10% deposit and milestone split, or start payments empty.

## Build plan
1. Migration 009: `listings` (homeowner, category, scope, size, zip/city, budget min/max, photos, status open/awarded/closed, ai_low/ai_high/ai_breakdown), `bids` (listing, contractor, price, weeks, start date, inclusions, note, status). RLS: owner sees own listing and its bids; contractors see open listings (no address) and only their own bids.
2. Feature flag `MARKETPLACE_ENABLED` (default off); hide nav/landing links when off.
3. Pages: landing, post flow with AI reference, contractor board, bid form, bid comparison, accept action (service-role: create project from bid, notify winner and others, set listing awarded).
4. Admin: listing/bid moderation, ban applies to bidding, add to audit log.
5. Terms/privacy update before launch (AI estimate disclaimer, public ratings, admin access). Texas attorney review.
6. Test on a Vercel preview branch before merging.

## Update 2026-11-01: tap-to-pick scope
The Post step now shows suggested scope items per job type (kitchen, bathroom, painting, roofing, flooring, landscaping), grouped (e.g. Cabinets, Countertops). Homeowners tap items instead of writing a description. The picked list plus an optional note becomes the project scope, and the AI cost reference is built from the picked items and the size. Prices in the mockup are sample numbers. The same picker could also be added to the live "Start a project" invite form.
