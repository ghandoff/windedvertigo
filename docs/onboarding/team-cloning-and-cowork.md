# onboarding walkthrough — github + cowork in 30 minutes

> for lamis (tomorrow morning) and jamie (self-serve). designed for someone
> who's never touched terminal, doesn't necessarily know what a "repo" is,
> and just wants to start collaborating with the team's claude personas.

---

## the end state we're aiming for

by the time we close the laptop, lamis (or jamie) can:

1. see the team's code on their own computer (in a folder they can open in finder/explorer like any other folder)
2. open claude desktop, point it at that folder, and start a cowork conversation
3. have three pinned conversations ready — one with **pam**, one with **moe**, one with **carl**
4. have actually used one of them, so the next time they sit down it feels familiar

no terminal. no command-line. no jargon they don't need.

---

## before the meeting (you, garrett — solo, 3 minutes)

a quick pre-flight so we don't lose time hunting in the meeting:

- **confirm she accepted the github invitation.** run on your mac:
  ```
  gh api /repos/ghandoff/windedvertigo/collaborators --jq '.[] | .login'
  ```
  if her username shows up (without "pending"), we're good. if not, gently ask her to check her inbox before the call and click "accept invitation."
- **find her github username.** the verification command above will tell you. write it down — you'll need it.
- **have her mcp configs ready to share.** the pam, moe, and carl personas need their connectors set up on her claude desktop. decide ahead of time: are you screen-sharing yours into hers, sending her a config file, or installing them as cowork plugins? section 5 below picks this up.
- **screen-share ready.** zoom, google meet, or whatever you two use. she'll be following along on her end.

---

## the 30-minute walkthrough

### phase 1 — hello + which laptop? (2 minutes)

ask once, write it down:

- **mac or pc?** (most of the steps below have both paths)
- **claude desktop already installed?** if not, send her to https://claude.ai/download while you finish phase 2. it'll take a few minutes to download in the background.

reassure her: "this is mostly clicking buttons. if you can install zoom, you can do this."

---

### phase 2 — install github desktop (5 minutes)

we're skipping the terminal entirely. github desktop is a free app that does git visually. it's the friendliest way in.

**her steps:**

1. go to **https://desktop.github.com**
2. click the big purple "download for macOS" (or "download for Windows") button
3. **mac:** once it downloads, open it. drag the github desktop icon into the applications folder. open it from applications.
4. **pc:** once it downloads, double-click the installer. follow the prompts. it'll open automatically when done.
5. when github desktop opens for the first time, click **"sign in to github.com"** — it'll pop open her web browser. she signs in there with her github account (the same one you invited). browser will ask "authorize github desktop?" — click authorize. she'll get bounced back to the app, now signed in.
6. it'll ask for her name and email for "git config" — these get attached to her commits. her name and `lamis@windedvertigo.com` is fine.

**checkpoint:** she sees the github desktop welcome screen with her username top-right. ✓

---

### phase 3 — clone the two repos (8 minutes)

"clone" is just a fancy word for "download a copy that stays in sync."

**her steps:**

1. in github desktop, click **"clone a repository from the internet"** (or **file → clone repository**).
2. a window opens with three tabs: github.com, github enterprise, url. she's on the **github.com** tab.
3. she should see a list of repos she has access to. she's looking for two:
   - **ghandoff/windedvertigo**
   - **ghandoff/harbour-apps**
   - if she doesn't see them, she hasn't accepted the invitation yet. open https://github.com/ghandoff/windedvertigo/invitations in her browser, click accept, then come back to github desktop and hit the refresh icon.
4. click **ghandoff/windedvertigo** to highlight it.
5. **local path** — leave the default (`~/Documents/GitHub/windedvertigo` on mac, `C:\Users\lamis\Documents\GitHub\windedvertigo` on pc). this is where the files will live on her machine.
6. click **clone**. wait — there's a progress bar. it'll take 30 seconds to a couple of minutes depending on her wi-fi.
7. once done, the app shows a "no local changes" screen. **repeat steps 1–6 for `ghandoff/harbour-apps`.**

**show her where the files actually live:**

- **mac:** open finder → sidebar → documents → github → windedvertigo. it's just a folder, like any other folder. files inside are real files.
- **pc:** open file explorer → documents → github → windedvertigo. same thing.

reassure: "you don't need to understand what's in here. you just need to know this folder exists, because claude is going to read from it."

**checkpoint:** both folders exist in her github folder. she can open them in finder/explorer. ✓

---

### phase 4 — point claude desktop at the folder (3 minutes)

now the bridge from the code to claude.

**her steps:**

1. open **claude desktop** (the icon she installed earlier, or might already have).
2. on the left sidebar, near the top, look for **"cowork"** or **"folders"** — somewhere there's an option to add or select a folder.
3. click **"add folder"** (or whatever the wording is in current claude — varies slightly by version).
4. navigate to **documents → github → windedvertigo** and click select / open / choose.
5. claude desktop now sees the folder. she can switch between windedvertigo and harbour-apps from a dropdown or sidebar.

if she has multiple folders, the active one is the one whose name shows at the top of the chat.

**checkpoint:** the windedvertigo folder name shows in claude's interface, and a chat input is ready below. ✓

---

### phase 5 — meet pam, moe, and carl (7 minutes)

this is the moment.

**before lamis tries to chat with them**, you (garrett) need to make sure her claude desktop has the three persona connectors set up. one of three paths:

- **path a — you set them up live on her machine.** screen-share, go to claude desktop **settings → connectors** (or **mcp**, depending on version), and add the three: pam-memory, mo-memory, carl-memory. you know the urls / config from your own setup.
- **path b — you send her a config file.** if your personas are configured via a json file (cowork sometimes works this way), email it to her ahead of time and have her drop it in the right place. you walk her through where.
- **path c — they're packaged as cowork plugins.** if you've published them via `mcp__cowork-plugin-management__create-cowork-plugin`, she can install them from the plugins library inside claude desktop in two clicks.

pick the path before the call. budget ~5 minutes for this step — it's the trickiest part of the meeting.

**once the three connectors are live**, lamis tries them. one at a time:

1. **start a new chat** in claude desktop. in the message box, type:
   > hi pam — give me a quick briefing on what you've been working on.
2. claude calls the `pam_briefing` tool and pam responds with her current memory: active commitments, recent decisions, what she's tracking. read it together. lamis can ask follow-up questions to get a feel.
3. **pin the conversation.** in claude desktop, right-click (or click the ⋯ menu on) the chat in the sidebar → **"pin"** or the pin icon. it should move up to a pinned section at the top.
4. rename the chat to something obvious: **"pam"**.
5. **start a second new chat** for moe:
   > hi moe — what's on the marketing radar this week?
   pin it. rename to **"moe"**.
6. **third new chat** for carl:
   > hi carl — what's the curriculum picture look like right now?
   pin. rename to **"carl"**.

**checkpoint:** three pinned conversations in the sidebar, each named after a persona, each with at least one back-and-forth. ✓

---

### phase 6 — one real thing, so it sticks (5 minutes)

reading is one thing. using is another. pick one concrete task lamis actually has, and do it through one of the three personas. examples:

- **with pam:** "log a commitment from yesterday's whirlpool — i said i'd send the meredith follow-up by friday."
- **with moe:** "the substack post about learning to fly went up wednesday — log it in the content calendar and tell me what's queued next."
- **with carl:** "tell me what you remember about the prme pedagogy certificate system."

watch the response. confirm the persona "remembers" by closing the chat and reopening — the memory tool persists, so the new commitment / log / update should be there.

reassure: "you didn't break anything. you can talk to them like colleagues. they remember between conversations."

---

## end-of-meeting checklist

run through this together before hanging up. takes 30 seconds.

- [ ] github desktop is installed and signed in
- [ ] two folders exist: `documents/github/windedvertigo` and `documents/github/harbour-apps`
- [ ] she can open them in finder/explorer and see real files
- [ ] claude desktop opens with the windedvertigo folder selected
- [ ] three pinned conversations in the sidebar: pam, moe, carl
- [ ] she has done at least one real interaction (logged a commitment, asked a question, etc.)

if any of these are blank, decide together: finish now (under 30 min total) or schedule a 10-min follow-up.

---

## troubleshooting (likely gotchas, in order of frequency)

**"the repos aren't showing up in the clone list."**
she hasn't accepted the github invitations yet. open https://github.com/ghandoff/windedvertigo/invitations and https://github.com/ghandoff/harbour-apps/invitations in her browser. accept both. back to github desktop, hit the refresh icon next to the search bar.

**"github desktop says i don't have permission."**
her github desktop is signed in with the wrong account. **file → options → accounts → sign out** and sign back in with the account that owns her invited username.

**"claude desktop doesn't see my folder."**
she clicked "open" instead of "select folder" — make sure she's selecting the folder itself, not a file inside it.

**"pam (or moe, or carl) doesn't respond / says she has no tools."**
the persona's connector isn't configured on her machine. go back to phase 5 and pick a path a/b/c.

**"i pinned the wrong thing."**
right-click → unpin. start fresh.

**"can i break anything?"**
not really. she's a collaborator with write access on github, so technically she could push something messy — but the standard PR flow (covered in the handbook at `/handbook/collab-audit-2026-05/` once it's live) makes that hard by accident. with pam/moe/carl, the worst she can do is log a wrong commitment, which is editable.

---

## for jamie (self-serve version)

same six phases, no meeting. send jamie this doc and tell him:

> jamie — here's the playbook. all of it is clicking, no terminal needed. phases 1–4 you can do solo in about 15 minutes. phase 5 we should do together for 10 minutes so i can get pam, moe, and carl wired up on your machine. ping me when you've finished phases 1–4 and we'll grab 10 minutes for the rest.

he's more technical than lamis (writes substack pieces, comfortable with tools), so he won't need handholding on github desktop. the persona connectors are the only part that needs you live.

---

## why we're doing it this way

three things, briefly:

1. **github desktop, not terminal.** terminal is faster once you know it, but the learning curve is steep and intimidating. github desktop's visual model — "here are my repos, here are my changes, click commit" — maps to how non-engineers already think about files.
2. **cowork mode is the bridge.** claude desktop in cowork mode is what lets lamis collaborate with claude *on real files* without needing to understand the command line. the cloned folder is her "shared workspace."
3. **pam, moe, and carl have memory.** they're not generic chatbots — they're the team's institutional brain for project management (pam), marketing (moe), and curriculum/research (carl). once she's talking to them, she's plugged into how the collective tracks work, not a parallel universe of her own notes.

welcome aboard 🌀

> _no, really, no emojis. that one's a joke. they don't show up._

---

_doc maintained at `docs/onboarding/team-cloning-and-cowork.md`. last updated: 14 may 2026. tweak for the next person who joins._
