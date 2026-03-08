# CLAUDE.md — winded.vertigo voice pipeline

> this file lives at the root of the repo. it is the source of truth for any developer or ai agent working on this project. keep it updated as the codebase evolves. claude code reads this automatically on every session.

---

## project identity

**internal name:** voice pipeline
**public-facing name:** tbd — see `## commercial potential` below
**status:** phase 1 in progress
**repo:** fresh vercel project (node.js)
**primary developer:** garrett jaeger (garrett@windedvertigo.com)
**collective members:** garrett, jamie, lamis, maria, payton
**model for this project:** claude opus — use `claude-opus-4-5` for all api calls within this codebase, including intent routing. sonnet is not appropriate for this project's complexity.

---

## what we're building

a hands-free voice command pipeline for the winded.vertigo collective. a user speaks a command with airpods in and phone in pocket. the system transcribes, detects intent via claude, routes the action to the right tool (notion, slack, or a build webhook), and reads a conversational response back aloud in their ears. no screen required.

**supported actions:**
- capture a note or idea → notion inbox database
- assign a task to a collective member → notion inbox database
- send or draft a slack message → slack api
- start a code conversation → primed slack dm to self
- approve a build → webhook (mechanism tbd, phase 3)

**platforms:** ios (apple shortcuts + siri) and android (pwa)
**auth:** per-user oauth — each collective member connects their own slack and notion identity

---

## repo structure

```
/
├── api/
│   ├── voice.js          # POST /voice — core intent routing endpoint
│   ├── auth.js           # POST /auth — oauth token exchange
│   └── setup.js          # GET /setup — onboarding page handler
├── lib/
│   ├── intent.js         # claude-powered intent detection
│   ├── notion.js         # notion api client + inbox helpers
│   ├── slack.js          # slack api client + message helpers
│   ├── tts.js            # spoken response formatting
│   └── users.js          # collective member name → id mappings
├── config/
│   ├── members.json      # collective member config (names, notion ids, slack ids)
│   └── intents.json      # intent patterns and routing rules
├── public/
│   └── setup/            # static onboarding page (html/css)
├── shortcuts/
│   └── voice-pipeline.shortcut  # apple shortcuts export (binary)
├── pwa/
│   ├── index.html        # android pwa entry
│   ├── manifest.json     # pwa manifest
│   └── sw.js             # service worker
├── CLAUDE.md             # this file
├── SYSTEM_PROMPT.md      # claude code system prompt (load this in claude code)
├── .env.example          # required environment variables
├── vercel.json           # vercel routing config
└── package.json
```

---

## environment variables

copy `.env.example` to `.env.local` before running locally. all secrets live in vercel environment variables in production.

```
# claude api
ANTHROPIC_API_KEY=

# notion
NOTION_INBOX_DATABASE_ID=7fdb708708e942f89e033de3690790c9
NOTION_OAUTH_CLIENT_ID=
NOTION_OAUTH_CLIENT_SECRET=
NOTION_OAUTH_REDIRECT_URI=https://voice.windedvertigo.com/auth/notion/callback

# slack
SLACK_OAUTH_CLIENT_ID=
SLACK_OAUTH_CLIENT_SECRET=
SLACK_OAUTH_REDIRECT_URI=https://voice.windedvertigo.com/auth/slack/callback
SLACK_TEAM_ID=T06QCSGDSTY

# build approval (phase 3)
BUILD_WEBHOOK_URL=

# token store (vercel kv or similar)
KV_URL=
KV_REST_API_TOKEN=
```

---

## core endpoint: `POST /voice`

this is the heart of the system. it receives a transcribed voice string, detects intent via claude opus, routes the action, and returns a spoken response.

**request:**
```json
{
  "text": "assign to lamis: review the assessment rubric draft by friday",
  "user_id": "garrett"
}
```

**response:**
```json
{
  "spoken_response": "done — i've assigned that to lamis with a friday due date.",
  "action_taken": "notion_task",
  "entry_url": "https://notion.so/..."
}
```

**intent routing table:**

| user says | detected intent | action |
|---|---|---|
| "note: ..." | `notion_note` | notion inbox, type: note |
| "idea: ..." | `notion_idea` | notion inbox, type: idea |
| "assign to [name]: ..." | `notion_task` | notion inbox, type: task |
| "slack [name]: ..." | `slack_message` | slack dm or channel message |
| "start code: ..." | `code_conversation` | primed slack dm to self |
| "ship it" / "approve the build" | `build_approval` | fires build webhook |

**ambiguous input:** if claude cannot confidently detect intent, return a clarifying question as the spoken response. do not act. example: `"i'm not sure if you want to note that or assign it — which did you mean?"`

---

## intent detection via claude opus

`lib/intent.js` calls the anthropic api with opus to classify intent and extract structured data. this is not simple keyword matching — claude reads the full utterance and reasons about what the user meant.

**system prompt for intent detection (inside `lib/intent.js`):**

```
you are the intent router for a voice command system used by a small learning design collective called winded.vertigo. your job is to read a transcribed voice command and return a structured json object identifying what the user wants to do and extracting the relevant details.

collective members: garrett, jamie, lamis, maria, payton.

respond ONLY with valid json. no preamble, no explanation.

schema:
{
  "intent": "notion_note" | "notion_idea" | "notion_task" | "slack_message" | "code_conversation" | "build_approval" | "unknown",
  "priority": "high" | "medium" | "low",
  "assignee": "[name or null]",
  "due_date": "[natural language date or null]",
  "content": "[the cleaned capture text, without the trigger phrase]",
  "slack_recipient": "[name, channel, or null]",
  "confidence": 0.0–1.0
}

if confidence is below 0.7, set intent to "unknown" and include a clarifying_question field.
```

---

## notion infrastructure

the **inbox** database is already live. do not recreate it.

**database id:** `7fdb708708e942f89e033de3690790c9`
**url:** https://www.notion.so/7fdb708708e942f89e033de3690790c9

**schema:**
| property | type | values |
|---|---|---|
| `capture` | title | the raw dictated text |
| `type` | select | note / task / idea / meet |
| `priority` | select | high / medium / low |
| `processed` | checkbox | false on creation |
| `captured time` | created_time | auto |
| `processed date` | date | set when reviewed |
| `attachment` | file | optional |
| `url` | url | optional |

**write pattern:** all captures land as `processed: false`. the existing processing workflow (documented in notion) handles review.

**⚠ important:** there is an existing **siri capture bot** notion integration. before writing any notion capture code, fetch its details and confirm we're not duplicating it. it may be a useful reference or may need to be deprecated.

---

## collective member config (`config/members.json`)

this file maps human names (as spoken) to their notion user ids and slack user ids. update when new members join.

```json
{
  "garrett": {
    "notion_user_id": "16ed872b-594c-8148-a446-000287a90f4c",
    "slack_user_id": "U06Q4UN4PKR",
    "email": "garrett@windedvertigo.com"
  },
  "jamie": {
    "notion_user_id": "215d872b-594c-814a-b6da-0002393cd347",
    "slack_user_id": null,
    "email": "jamie@windedvertigo.com"
  },
  "lamis": {
    "notion_user_id": "215d872b-594c-81c4-ba2e-0002fe89c370",
    "slack_user_id": null,
    "email": "lamis@windedvertigo.com"
  },
  "maria": {
    "notion_user_id": "219d872b-594c-8172-93c7-00025ed1751f",
    "slack_user_id": null,
    "email": "maria@windedvertigo.com"
  },
  "payton": {
    "notion_user_id": "219d872b-594c-81a0-b0e8-0002503fdf93",
    "slack_user_id": null,
    "email": "payton@windedvertigo.com"
  }
}
```

**note:** slack user ids for jamie, lamis, maria, payton are unknown — resolve during phase 4 auth setup or look up via slack api.

---

## coding conventions

- **language:** javascript (node.js). no typescript for now — keep it simple.
- **style:** lowercase variable names, concise functions, no unnecessary abstraction.
- **error handling:** all api calls wrapped in try/catch. errors return a spoken fallback: `"something went wrong — try again in a moment."`
- **logging:** console.log for vercel function logs. prefix with `[voice]`, `[notion]`, `[slack]` for clarity.
- **no database:** this backend is stateless. user tokens are stored in vercel kv (key-value store). no postgres, no mongo.
- **no orm:** direct api calls via `@notionhq/client` and slack's `@slack/web-api`.
- **dependencies to use:** `@anthropic-ai/sdk`, `@notionhq/client`, `@slack/web-api`, `@vercel/kv`
- **dependencies to avoid:** express (use vercel's built-in routing), any heavy frameworks

---

## spoken response design

responses are read aloud by tts. design them accordingly.

- **conversational, not robotic.** sound like a thoughtful colleague, not a system alert.
- **one to two sentences max.** the user is on a bike or playing with kids.
- **confirm the action taken.** always tell the user what happened.
- **use names.** "assigned to lamis" not "assigned to user."
- **never read urls aloud.** include them in the json response but not the spoken text.

**good:** `"noted — i've added that to your inbox as a medium-priority idea."`
**bad:** `"success. entry created at https://notion.so/abc123."`

---

## build sequence

### phase 1 — backbone ✳ current phase
- [ ] scaffold vercel project + repo
- [ ] `POST /voice` endpoint with hardcoded test user
- [ ] `lib/intent.js` — claude opus intent detection
- [ ] `lib/notion.js` — write to inbox database
- [ ] note and idea capture working end-to-end
- [ ] ios shortcut — captures voice, posts to `/voice`, speaks response
- [ ] shortcut distributable via icloud share link

### phase 2 — actions
- [ ] notion task assignment with named assignee
- [ ] slack dm and channel message
- [ ] code conversation starter (primed slack dm to self)
- [ ] `config/members.json` populated with slack ids

### phase 3 — approvals + android
- [ ] build approval webhook (confirm mechanism first)
- [ ] android pwa (`/pwa`) with web speech api
- [ ] pwa installable on android home screen
- [ ] back-tap shortcut instructions documented

### phase 4 — polish + distribution
- [ ] `POST /auth` and `GET /setup` — oauth onboarding flow
- [ ] vercel kv token storage
- [ ] setup guide written for collective (winded.vertigo voice)
- [ ] ios shortcut link + android pwa link published
- [ ] siri capture bot reconciled

---

## commercial potential

> this section is here so any future developer or collaborator understands that this tool may become a product. build with that in mind — clean apis, good separation of concerns, configurable member lists.

### the gap

no elegant, hands-free, voice-first command layer exists that talks back conversationally and routes actions into the tools small teams already use. existing options are too technical (zapier), too closed (native siri), or too shallow (transcription-only apps).

### what this could become

a one-tap mobile companion — speak, hear a response, done. target users: founders, operators, creative studio leads, parents, cyclists, educators. anyone whose hands and eyes are occupied but brain isn't.

**working name ideas:** flow / murmur / drift / relay / pocket *(tbd)*

### distribution paths (in order of effort)

1. **producthunt / indie launch** — hosted version, waitlist, early access pricing. lowest barrier, best for initial signal.
2. **notion integrations directory** — notion-first framing: "the voice layer for notion teams." our inbox schema maps cleanly.
3. **slack app directory** — slack-first framing: "speak to your workspace." curated but high-traffic.
4. **ios app store** — wrap shortcut + backend in native app (react native). monthly subscription ($5–12/user).
5. **google play** — pwa → native wrapper via capacitor. lower polish perception but achievable.

### pricing model

| tier | price | seats | features |
|---|---|---|---|
| personal | $6/mo | 1 | captures, notion + slack |
| collective | $24/mo | up to 6 | team routing, shared config |
| studio | $79/mo | unlimited | custom intents, priority support |

the collective tier anchors on our own use case. we are the case study.

### moat

the claude opus routing layer is what makes this different from transcription. intent detection + conversational confirmation + tool routing is the product. anyone can record voice; very few can do what this does.

### what we'd need before selling

- [ ] hosted multi-tenant backend (not just our vercel project)
- [ ] stripe billing (already connected to winded.vertigo)
- [ ] landing page (windedvertigo.com design system ready)
- [ ] 3+ beta users outside collective with real testimonials
- [ ] product name + brand identity
- [ ] decision: winded.vertigo product, spinout, or open source?

### the winded.vertigo angle

alternatively: this never goes mass-market. instead it becomes a **signature tool** winded.vertigo offers to client organizations as part of learning ecosystem engagements. "we don't just design learning experiences — we build the infrastructure that makes them stick." that framing has independent strategic value.

---

## related resources

- slack canvas (architecture): https://windedvertigogo.slack.com/docs/T06QCSGDSTY/F0AJNP6E371
- notion inbox database: https://www.notion.so/7fdb708708e942f89e033de3690790c9
- notion dictation guide: https://www.notion.so/b8c0973223a243ad84be5a1715ab3a94
- winded.vertigo slack: windedvertigogo.slack.com

---

*last updated: 2026-03-06 — maintained by garrett + claude*
