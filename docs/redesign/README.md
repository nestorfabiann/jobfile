# Jobfile redesign (approved-for-later mockup)

`mockup.html` is a standalone, tappable preview. Open it in any browser. It is NOT wired into the app.
Published copy: https://claude.ai/artifact/FxDiH2aV494LzvN4bNG3hP (private to the owner).

## Screens and what each needs in the real app
1. **Landing page** (`/` for signed-out visitors): new `src/app/page.tsx` marketing page, sign-in form moves to `/login`. Add Terms and Privacy pages first.
2. **First project checklist** (`/projects`): progress ring and 3 steps computed from existing data (project exists, agreement sent, homeowner joined). Job-type icon needs a `job_type` column on projects (new migration) and a picker in the new-project form.
3. **Project screen**: promote "Needs your attention" to the top with one orange button; add tab badges (unread messages, payments awaiting you); mobile bottom tab bar replacing the top tabs under ~700px; camera button linking to the photo uploader with `capture="environment"`.
4. **Messages**: avatars with initials, quick-reply chips (send through the existing sendMessage action), read receipts need a `read_at` per message and per user (new table or column).
5. **Help and empty states**: "?" tips are static text; empty states are pure UI.

Shared: Plus Jakarta Sans via `next/font/google`, 20-22px card radius, softer shadow, dark-mode toggle stored in a cookie.

## Suggested order
Landing page, then bottom tab bar and Needs-you card, then first-project checklist and job icons, then chat polish and read receipts.
Preview each in a branch deployment on Vercel before merging to main.
