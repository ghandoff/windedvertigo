# Wave 7.3 — Login & Welcome: One Door, Many Rooms

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 7.x nav redesign; existing `useAuth` / `pcs-auth` role model.

---

## 1. Current state audit

### 1.1 The actual routes (verified 2026-04-21)

| What the brief assumed | What actually exists |
|---|---|
| `/login` | **Does not exist.** Login lives on the root page `src/app/page.js`. |
| `/register` | Exists at `src/app/register/page.js`. |
| Post-login `/dashboard` or `/pcs` | Confirmed. Bounce logic is inlined into the landing page. |

**Finding #1 — there is no dedicated auth route.** The home page is *both* the marketing landing *and* the login surface. For external reviewers, this reads acceptably. For internal users (Sharon, Adin, Garrett) it is a friction-free muscle-memory sign-in, but it conflates two very different jobs on one canvas.

### 1.2 The current login form

Found at `src/app/page.js` lines 99–121. The form asks for:

- **Reviewer Alias** (not email) — e.g. `reviewer_001`
- **Password** — 12-char minimum, enforced on register

Copy reads "Reviewer Login" / "Continue to Dashboard". The hero behind it brands the surface as **"Study Quality Rubric for RCTs"** under a Nordic Naturals header. This hero is squarely aimed at external reviewers; internal PCS users effectively ignore the marketing and sign in.

**Finding #2 — the identity token is alias, not email.** This is fine for anonymized reviews, but it's a wall for magic-link flows (magic links require a deliverable identifier, and aliases are by design not tied to a deliverable inbox in the UI). Email is already collected at registration (line 128–135 of register page), so the data is there — it's just not the login key.

### 1.3 The role-routed bounce

From `src/app/page.js` lines 17–27:

```js
function getRedirectPath(u) {
  const roles = u?.roles?.length > 0 ? u.roles
    : u?.isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct'];
  const hasSqr = roles.includes('sqr-rct');
  const hasPcs = roles.includes('pcs') || roles.includes('pcs-readonly') || roles.includes('admin');
  if (hasSqr) return '/dashboard';  // SQR-RCT (including dual) → dashboard
  if (hasPcs) return '/pcs';         // PCS-only → Command Center
  return '/dashboard';
}
```

**Finding #3 — the routing is pre-SUPPOSITIONAL.** A user with *both* SQR-RCT and PCS roles gets silently pushed to `/dashboard` regardless of what they actually came to do today. Garrett, who is all roles, is treated as a reviewer. There is no moment of "what do you want to do next?" — the system decides for you.

### 1.4 Dead-end routes

- `/register` exists but self-service registration is *not* the actual onboarding path for external reviewers — in practice reviewers are invited, not self-serving. The register form collects fields (alias, affiliation, discipline) that ought to come from an invite, not a stranger filling in a form.
- No magic-link endpoint. `src/app/api/auth/login/route.js` accepts alias+password only.
- No `/welcome` route. No shared front door exists.

---

## 2. The four user journeys

### Journey A — External reviewer, first time

**Today:** Receives an email from research lead (out-of-band), is told to visit the platform, is asked to "register" and invent an alias. Cold, transactional, very much an employee-portal vibe.

**Ideal:**
1. Email invite with a tokenized magic link: `https://nordic-research.com/invite/{token}`
2. Link lands them on a branded welcome: **"Nordic Research — Independent Reviewer Portal"**
3. Copy: *"Welcome, Dr. Smith. You've been invited by Lauren Bozzio to score 3 studies for the Omega-3 Cognitive Function review. Estimated time: 45 minutes per study."*
4. Primary CTA: **"Begin first review"**. Secondary: "About this study" (expand) / "Set a password (optional)".
5. Onboarding is 2 short screens: (a) how SQR scoring works with a sample rubric item; (b) time commitment + honorarium expectations. Then straight into review #1.
6. From this point forward their nav is reviewer-shaped only: **Queue · Completed · Profile**.

### Journey B — External reviewer, returning

Logs in via stored session, or via magic link, or password as fallback. Lands on **personal review queue**: *"3 studies waiting · 7 completed · 1 in draft"*. One primary button: **"Continue with [next study title]"**.

No hero image, no marketing. Just work.

### Journey C — Researcher (Sharon, Gina, Adin, Lauren), returning

Lands on PCS-flavored welcome (Command Center successor). Sees: open Requests assigned to them · PCS docs they own that have awaiting-reviewer-scores · recent edits made by other Researchers. This is the Research Lead's cockpit.

### Journey D — Super-user (Garrett), returning

Lands on a **meta dashboard**: system health (Vercel deploy status, last Notion sync) · open Requests across all teams · recent audit-log activity · recent user logins · DPO-sensitive counters (unresolved PII exports, consent expiries). Garrett's nav reveals every room in the house.

---

## 3. The shared front door — `/welcome`

Every authenticated user traverses **`/welcome`** exactly once per session (or by explicit nav). It replaces today's silent `router.push('/dashboard')`.

**What it shows:**

- **Brand band** at top: `NORDIC RESEARCH` mark, with a role-adaptive sub-line:
  - Reviewers: "Independent Reviewer Portal"
  - Researchers: "Research Workspace"
  - Super-users: "Research Workspace · Admin"
- **Greeting:** `Welcome back, Sharon.` — first-timers get `Welcome, Sharon. We're glad you're here.`
- **"What's waiting for you"** — up to 3 cards, role-filtered: next review · open Request · recent comment thread. Each card is a direct link to the thing itself, not a list.
- **"Where would you like to go?"** — only appears for multi-role users. One line each: `→ Your review queue (2 open)` · `→ PCS Command Center (5 open Requests)` · `→ Admin console`.
- **Footer hint:** "You can change your default landing page in Profile." Breaks the lock-in, gives power to the user.

The welcome is **deliberately sparse** — a threshold, not a destination. A user who knows where they're going should clear it in 2 seconds. A user who paused to think should find exactly the 3 things they needed.

---

## 4. Login flow redesign

### 4.1 Single `/login` (new route)

Extract the form out of `src/app/page.js`. The home page becomes marketing only. `/login` becomes the form only — no hero, no value props, no "how it works". Faster, calmer, no mode confusion.

### 4.2 Email-first, not alias-first

Switch the login identifier from `alias` to `email`. Alias remains the *display name in reviews* (anonymity preserved in the rubric surface) but is not the login key. This unlocks:

- **Magic links** (email is the target)
- **Password reset** that doesn't require a separate lookup step
- **Cross-role UX parity** — Sharon doesn't have to remember she's `researcher_sharon`, she just types her Nordic email.

Migration: a one-time prompt on next login for existing users — *"Confirm your email"* — captures any missing records, sends a verification link, flips the key. Rollback is trivial (alias still unique-indexed).

### 4.3 Magic link as default for reviewers

External reviewer login page:
```
┌──────────────────────────────────────┐
│  Sign in as a reviewer               │
│                                      │
│  Email  [ dr.smith@university.edu ]  │
│  [ Send sign-in link ]               │
│                                      │
│  — or —                              │
│  Use a password instead ▸            │
└──────────────────────────────────────┘
```

Password is the fallback, not the default. Reviewers shouldn't have to manage yet another credential.

### 4.4 Passwords required for internal users

Internal users (Researchers, Admin, Super-user) **must** set a password. Magic links are acceptable for secondary devices but the primary login path is password + eventual 2FA.

### 4.5 2FA required for super-users in production

Gated by `PROD_REQUIRE_2FA=true` env flag. Dev/preview scopes opt-out. Implementation: TOTP (authenticator app) — no SMS.

### 4.6 Invite-token flow

`/invite/{token}` is a one-time URL. First visit:
1. Validates the token server-side
2. Creates the user record (email, name, role = `sqr-rct` reviewer, linked study)
3. Issues a session cookie
4. Redirects to `/welcome` (first-time variant)

No password prompt on first visit. They can set one later from Profile. This is the 99th-percentile fastest path from invite email to first review.

---

## 5. Brand voice + visual notes

### 5.1 Naming

**Strong opinion: "Nordic Research Workspace" for internal, "Nordic Research Reviewer Portal" for external.** Reject "Hub" — overused, corporate-intranet-coded. Reject "Platform" — colourless. "Workspace" frames it as *a place you work*, which is what Sharon, Adin and Lauren actually do. "Reviewer Portal" respects that external reviewers are guests in the building, not members of the firm.

One company, two doors into one workspace.

### 5.2 Tone

| Avoid | Prefer |
|---|---|
| "Login successful." | "Welcome back, Sharon." |
| "Credentials invalid." | "We couldn't find that email. Try again, or request a sign-in link." |
| "Please complete all required fields." | "We need your email to send your sign-in link." |
| "Session terminated." | "You've been signed out. Come back anytime." |

Warmer, second-person, never scolding. Never emoji. Never "SuperCharge Your Research!" marketing-speak.

### 5.3 Typography

- **Inter** at 400/600/800 (already loaded in root layout).
- Welcome heading: `text-4xl sm:text-5xl font-extrabold text-pacific` (one step up from today's `text-3xl`).
- Body: `text-base text-gray-700 leading-relaxed`.

### 5.4 Color

Stay with pacific tokens. No rebrand. Add a single accent on the welcome heading — the existing `text-pacific` on `bg-white` with a thin 4-px `bg-nordic-500` rule below the heading. No gradient washes on the welcome screen itself; the marketing hero keeps its `nordic-hq.jpg` background, the welcome screen does not.

### 5.5 Visual (the one illustration)

**Recommendation: no illustration.** The welcome screen earns its warmth through copy and spacing, not through a stock-photo pill-bottle-on-a-lab-bench. A single, quiet Nordic wordmark at top-left and generous whitespace conveys "serious science, human-scale" more honestly than any hero image.

If an illustration is eventually wanted, propose a subtle abstract — a topographic contour pattern in 4% pacific, bleeding off the top-right. Not literal. Not stock.

---

## 6. Edge cases

- **Multi-role users (Garrett).** First-paint shows the highest-privilege surface they have (Admin). The "Where would you like to go?" list offers the one-click switch. Their choice is remembered via `localStorage['preferredHome']`.
- **Reviewer completes their last review.** Welcome becomes: *"All done — thank you, Dr. Smith. Your scores are submitted. We'll email you when the next study is ready."* CTA: "View completed reviews" / "Update your profile for future invitations". Not a dead-end — an invitation to stay enlisted.
- **External reviewer who's also a Nordic researcher.** Rare but real. Welcome shows an explicit role switcher: `You are signed in as [Reviewer ▾]. Switch to Researcher?` One click, no re-auth.
- **Session expired mid-task.** Middleware catches 401, stashes `returnTo=/score/study-42/q3`, routes to `/login?reason=expired`. Login page shows a small banner: *"Your session timed out. Sign in to return to where you were."* After auth, resume at exact URL.
- **Invite token expired or already used.** Friendly dead-end: *"This invitation link has expired. [Request a new one from your research lead]."* Never a raw 401.

---

## 7. Migration / rollout

1. **Ship `/welcome` behind `NEXT_PUBLIC_WELCOME_SCREEN=true`.** Internal team (Garrett, Sharon, Adin, Lauren, Gina) opts in via env var on preview first.
2. **Week 1:** Internal dogfood. Collect friction notes.
3. **Week 2:** Enable for `pcs` role in production. External reviewers still go to `/dashboard` via legacy path.
4. **Week 3:** Enable for `sqr-rct` role in production. Monitor sign-in-to-first-action time (should drop).
5. **Week 4:** Remove the legacy bounce in `src/app/page.js`. Marketing landing survives; the inline login form is extracted to `/login`. Flag removed.

Rollback is the flag flip.

---

## 8. Wireframes (ASCII)

### 8.1 Journey A — first-time reviewer

```
┌────────────────────────────────────────────────────────────────┐
│  NORDIC RESEARCH                           Independent Reviewer│
│  ────────────                                           Portal │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│       Welcome, Dr. Smith. We're glad you're here.              │
│                                                                │
│       You've been invited by Lauren Bozzio                     │
│       to score 3 studies for                                   │
│       Omega-3 Cognitive Function (Adults 55+).                 │
│                                                                │
│       Estimated time: 45 min per study                         │
│       Honorarium: $[x] on completion                           │
│                                                                │
│       [  Begin first review  ]                                 │
│                                                                │
│       › What is SQR scoring?                                   │
│       › Set a password (optional)                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 8.2 Journey B — returning reviewer

```
┌────────────────────────────────────────────────────────────────┐
│  NORDIC RESEARCH                     Reviewer Portal | Profile │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Welcome back, Dr. Smith.                                     │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │
│   │  3 studies waiting    · 7 completed  · 1 in draft    │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   Up next:                                                     │
│   ┌──────────────────────────────────────────────────────┐    │
│   │  Vitamin D supplementation in postmenopausal women    │    │
│   │  Arnold et al. 2024 · 12 min remaining                │    │
│   │  [  Continue  ]                                       │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 8.3 Journey C — returning researcher

```
┌────────────────────────────────────────────────────────────────┐
│  NORDIC RESEARCH                  Research Workspace | Sharon ▾│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Welcome back, Sharon.                                        │
│                                                                │
│   What's waiting for you                                       │
│   ┌──────────────────────────────────────────────────────┐    │
│   │  ● 4 open Requests assigned to you                   │    │
│   │    → "Magnesium glycinate dose re-eval" · 2 days old  │    │
│   │                                                       │    │
│   │  ● 2 PCS docs awaiting reviewer scores (Omega-3 CF)  │    │
│   │                                                       │    │
│   │  ● Adin commented on Calcium-AK2 claims · 1h ago     │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   [  Go to Command Center  ]                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 8.4 Journey D — super-user

```
┌────────────────────────────────────────────────────────────────┐
│  NORDIC RESEARCH         Research Workspace · Admin | Garrett ▾│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Welcome back, Garrett.                                       │
│                                                                │
│   System                                                       │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ Prod deploy: e7af53d · 2h ago · ✓ healthy            │    │
│   │ Notion sync: last run 12 min ago · 0 errors           │    │
│   │ Active sessions: 4 reviewers · 2 researchers          │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   Across teams                                                 │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ 11 open Requests · 3 PII exports pending review      │    │
│   │ 2 reviewer invitations unredeemed >7d                 │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   Where would you like to go?                                  │
│   → Command Center   → Dashboard   → Admin   → Audit log       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Open questions for Garrett

1. **Email infrastructure.** Is there anything wired up for outbound mail? Resend is the natural Vercel fit; SendGrid/Postmark/SES are all viable. Magic links require *something*. What's the current story?
2. **Branding name — confirm.** Recommendation is **"Nordic Research Workspace"** (internal) + **"Nordic Research Reviewer Portal"** (external). Acceptable? Alternatives heard: "Nordic Research Hub" (rejected here), "SQR-RCT Platform" (current, too narrow).
3. **Reviewer compensation.** Is there a payment/tracking layer, or is that out of scope for 7.3? If out of scope, we keep the honorarium line in Journey A copy generic.
4. **Per-study welcome wrappers?** Should each PCS-led review be able to *override* the welcome copy ("Welcome to the Omega-3 Cognitive Function study — here's what's unique about this one")? Or is one universal welcome sufficient?
5. **Reviewer self-service profile.** Can reviewers update their own email/affiliation/password/discipline without admin intervention? Today the register page collects this at sign-up but there's no evident edit surface post-auth.
6. **Does "Reviewer Alias" survive?** Proposed: yes, but as display-name-in-rubric only, not the login key. Confirm.
7. **First-time onboarding depth.** Two screens (rubric explainer + time/pay) before first review, or straight to the rubric with a side-rail tooltip? Opinionated default: two screens — reviewers who skip tutorials skip *quality* too.

---

## 10. Summary of strong opinions

- **One door, many rooms.** `/welcome` is the shared threshold; every role passes through it, briefly.
- **Name it right:** *Nordic Research Workspace* and *Nordic Research Reviewer Portal*. Reject "Hub".
- **Email is the login key.** Alias survives only as a display name.
- **Magic links default for reviewers.** Passwords default for internal. TOTP 2FA for super-users in prod.
- **No illustration on the welcome.** Warmth comes from copy and whitespace.
- **The bounce is opinionated but not silent** — the user always sees the threshold, and multi-role users always see the switch.
