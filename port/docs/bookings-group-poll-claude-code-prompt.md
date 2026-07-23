# Claude Code prompt — add a group availability poll (Doodle/When2meet-style) to /bookings

Add a group availability poll feature (Doodle / When2meet style) to the winded.vertigo port app's bookings page (port.windedvertigo.com/bookings). Match the existing design and voice exactly — do NOT introduce a new visual style.

## Context (verify in the repo before building)
- The port app is Next.js on Cloudflare. The /bookings page is a Calendly-style system with COLLECTIVE / ROUND-ROBIN / INDIVIDUAL event types, each at /book/[slug], pulling live from the "wv-booking" Supabase project. Booking language is playful: bookings are "playdates," copy is lowercase.
- Reuse the existing components, design tokens (slate palette, winded.vertigo wordmark), Supabase client, and calendar-connection plumbing already on this page. Confirm the wv-booking schema and the existing auth pattern first.

## What to build: a "group playdate" poll
A Doodle/When2meet-style poll for finding a time across a group of mostly-external invitees (who must NOT need an account to respond).

1. **Create flow (host, authenticated):** a "new group playdate" action on /bookings. Host sets a title, an optional description, and proposes a set of specific candidate date/time slots (Doodle-style discrete options — primary mode). Optional stretch: a When2meet-style "date range + daily window + timezone" grid mode; ship discrete-slots first. Generates a shareable public link, e.g. /book/poll/[slug].
2. **Respond flow (public, NO login):** invitee opens the link, enters a name (email optional), and marks each proposed slot yes / if-need-be / no. All times render in the VISITOR'S OWN timezone (store slots as UTC timestamps, display local). They can submit and edit their own response via a return token.
3. **Results view (host + participants):** per-slot tally (yes / if-need-be / no with names on hover), best slot(s) highlighted, and a clear "who's available when" grid.
4. **Converge:** host can "lock" the winning slot → optionally create the actual playdate/booking and a calendar event using the existing calendar connections, and mark the poll closed.
5. **Surface on /bookings:** a new section (voice-matched, e.g. "group playdates — propose a few times, let everyone mark what works") listing active polls with their share link (copy button, like the existing /book/[slug] rows), response count, and status (open / locked).

## Data (wv-booking Supabase project)
Add tables: `polls` (id, slug, title, description, host, status, created_at), `poll_options` (id, poll_id, starts_at timestamptz, duration_min), `poll_responses` (id, poll_id, name, email nullable, edit_token), `poll_response_choices` (response_id, option_id, choice enum: yes|maybe|no). RLS: anon can INSERT a response + choices and SELECT the poll, its options, and aggregate availability; a respondent can only edit their own response (via edit_token). Do not expose respondent emails publicly. Provide a migration; additive only.

## Branding / UX
- Lowercase, playful "playdate" voice consistent with the current page. Slate design system, existing components, winded.vertigo wordmark.
- Timezone-aware everywhere; never show an ambiguous time.
- Mobile-friendly respond page (invitees will open on phones).

## Acceptance criteria
- A host can create a group playdate poll from /bookings and get a shareable /book/poll/[slug] link.
- An anonymous visitor can respond without logging in, sees times in their own timezone, and can edit their response.
- Results show per-slot availability and the best slot; host can lock a slot and (optionally) spin up the booking + calendar event.
- Everything visually matches the existing bookings page. Migration runs additively against wv-booking.
- Include a short README of the feature + the data model, and tests for the availability tally + timezone conversion logic.

## Notes
- No new auth system — reuse the app's existing host auth; the respond flow is the only public/anon surface.
- Keep the poll link the access control for responding (like When2meet), but never expose PII in the public aggregate.
- Ship discrete-slot polls first; the range/grid mode can be a follow-up.
