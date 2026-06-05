import type { Step } from './types';

export const STEPS: Step[] = [
  // ────────────────────────────────────────────────────────────────
  // 1. welcome
  // ────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    title: 'hi, and welcome aboard.',
    subtitle: "your pilot is ready. we just need to issue the passes, charts, and instruments.",
    meta: true,
    shared: {
      body: [
        {
          kind: 'paragraph',
          text: "claude code is your harbour pilot — a local expert who boards a foreign ship and guides it safely through tricky waters. that's exactly what it does when you arrive at a new repo. this docent walks you through getting connected to winded.vertigo's tools.",
        },
        { kind: 'heading', text: 'two paths through the harbour' },
        {
          kind: 'callout',
          tone: 'info',
          text: "**cloud-first (most team members):** you don't need to clone a repo or install anything. **claude code on web** (code.claude.com) pairs with the **github mobile app** to give you the full loop — describe the change in plain language, claude opens a PR, you review on your phone, garrett merges, it's live in ~90 seconds. this is the path payton, lamis, jamie, and maria are on. claude desktop / claude.ai with the github mcp is also great for reading, reviewing, and writing without the PR loop. **engineer path (garrett + maria for IDB work):** full local setup — cli tools, cloned repos, wrangler for cloudflare deployments. follow all steps.",
        },
        { kind: 'heading', text: 'the pattern (engineer path)' },
        {
          kind: 'paragraph',
          text: "each step below has one big prompt. click copy → switch to your Claude Code window → paste → press return. Claude narrates what it's doing and will ask you before doing anything risky.",
        },
        {
          kind: 'paragraph',
          text: "estimate: about 30 minutes, most of it waiting for installs and OAuth browsers.",
        },
        { kind: 'heading', text: 'before you start — avoiding collisions' },
        {
          kind: 'callout',
          tone: 'warn',
          text: "if Claude Cowork is running in the background right now, or if you have a second Claude Code conversation open on the same repo, either close one first or ask Claude to set up a git worktree for you. two sessions writing to the same files at the same time can silently overwrite each other.",
        },
        {
          kind: 'paragraph',
          text: 'to set up a worktree, you can paste this into Claude later if needed:',
        },
        {
          kind: 'claudePrompt',
          label: 'only if you need to run two sessions at once',
          prompt:
            "i'm about to do work on a repo while another Claude Code session is already active on it. set up a git worktree in a sibling folder so my edits don't collide with the other session. explain what you're doing as you go.",
        },
        { kind: 'heading', text: 'how we share memory with the team' },
        {
          kind: 'paragraph',
          text: "three kinds of markdown files travel with our repos. Claude Code reads them automatically — you won't usually need to edit them, but knowing they exist helps:",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "1) `CLAUDE.md` at the repo root = how Claude should work in THIS project (evolves with the repo). 2) `.claude/evergreen.md` = team-wide facts that never drift (brand voice, IP, accessibility). 3) your personal `~/.claude/CLAUDE.md` = your own preferences, private to your machine.",
        },
        {
          kind: 'paragraph',
          text: "you don't need to do anything with these now. if you're on the cloud-first path, Claude picks them up automatically via the github MCP when you point it at the repo.",
        },
      ],
      helpPrompt: "i'm on the welcome step of the docent — no help needed yet.",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 2. accounts
  // ────────────────────────────────────────────────────────────────
  {
    id: 'accounts',
    title: 'file your papers with each part of the harbour.',
    subtitle: 'a few sign-ups. the only part of the voyage your pilot can\'t handle for you.',
    shared: {
      intro:
        "think of each as a different window at the harbour office. the cloud-first path only needs github, notion, and anthropic console. the engineer path adds cloudflare and optionally vercel.",
      body: [
        {
          kind: 'paragraph',
          text: 'click each link (it opens in a new tab). when you see "needs invite", message garrett on slack after signing up — he has to add you to the team before you can use the service.',
        },
        {
          kind: 'accounts',
          items: [
            {
              label: 'github',
              href: 'https://github.com/signup',
              instruction: "the **shipyard** — keeps every version of every vessel on record, forever. **in practice:** github stores all our code and tracks every change. even without cloning anything, the github MCP lets claude read, comment, and open pull requests on your behalf directly from the claude app. **when you'll feel it:** every PR, every code review, every \"what changed in the last week\" question you ask claude. **next:** sign up, then ask garrett to invite you to the `ghandoff` organisation.",
              requiresInvite: true,
            },
            {
              label: 'notion',
              href: 'https://www.notion.so',
              instruction: "the **harbourmaster's logbook** — where humans write bulletins and knowledge that all systems share. **in practice:** project cards, team bios, campaign content, and strategic notes live here. supabase (our database) is now the source of truth for most operational data, but notion remains our long-form knowledge base and editorial layer. **when you'll feel it:** editing a team bio, writing a proposal, reviewing project status. **next:** you're probably already a workspace member. confirm you see \"wv // system stewardship\" in your sidebar.",
            },
            {
              label: 'cloudflare',
              href: 'https://dash.cloudflare.com/sign-up',
              instruction: "the **lighthouse, dock, and warehouse** — cloudflare now runs the port (crm), the main website, harbour apps, and all our background cron jobs via cf workers. it also handles dns (routing windedvertigo.com) and r2 storage (images, pdfs, exports). **when you'll feel it:** every time the port loads, every time a cron job runs, every r2 file read. **next (engineers):** sign up, then ask garrett to invite you to the gearbox account (dns + workers). **next (cloud-first):** skip this — you won't need a cloudflare account.",
              requiresInvite: true,
            },
            {
              label: 'vercel',
              href: 'https://vercel.com/signup',
              instruction: "still hosts a few non-port apps: creaseworks, vault, ops dashboard, and wv-claw (our slack bot). **in practice:** these are self-contained apps that haven't migrated to cloudflare yet. **when you'll feel it:** rarely — mostly when working on creaseworks or the ops dashboard. **next (engineers working on these apps):** sign up with your github account; ask garrett to invite you to the `ghandoffs-projects` team. **cloud-first path:** can skip vercel for now.",
              requiresInvite: true,
            },
            {
              label: 'anthropic console',
              href: 'https://console.anthropic.com',
              instruction: "the **pilot's guild** — trains and credentials the pilots. **in practice:** anthropic is the company behind claude. if you want to use the claude api directly (to write scripts or integrations), you need an account here. your claude code or claude desktop subscription is separate — this is api access. **when you'll feel it:** generating api keys for local tooling or integrations. **next:** sign up. add $5-10 to start; usage is pennies per minute at our scale.",
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "any anthropic api key (starts with `sk-ant-`) is a secret. treat it like a password. never paste it into a chat, slack, email, or commit it to github. if it ever leaks, rotate it from the console immediately.",
        },
      ],
      doneLooksLike:
        "you've signed up for the services on your path, messaged garrett about the ones marked 'needs invite', and have your accounts confirmed.",
      helpPrompt:
        "i'm on the accounts step. i signed up for [service name] but [describe what happened — didn't get an invite, can't find settings, sign-up failed]. what should i do?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 3. open your claude interface
  // ────────────────────────────────────────────────────────────────
  {
    id: 'open-claude',
    title: 'your pilot comes aboard.',
    subtitle: 'open claude. from now on, the pilot steers — you just describe where you want to go.',
    shared: {
      intro:
        "cloud-first team members: open claude desktop (download at claude.ai/download) or claude.ai in your browser — any device works, including mobile. engineers: use claude code in your terminal. both approaches work the same way once mcps are connected.",
      body: [
        { kind: 'heading', text: 'cloud-first: claude desktop or claude.ai' },
        {
          kind: 'callout',
          tone: 'tip',
          text: "claude desktop (mac/windows app) gives you full mcp support including github and notion integrations. claude.ai in a browser works for most things. the mobile app (iOS/Android) is great for reading, reviewing, and quick asks — mcp support is limited on mobile but grows with each update.",
        },
        {
          kind: 'paragraph',
          text: "open claude desktop or claude.ai and start a new conversation. you're ready for the next step.",
        },
        { kind: 'heading', text: 'engineer path: claude code in terminal' },
        {
          kind: 'paragraph',
          text: 'open your terminal app (Terminal on mac, Windows Terminal on windows) and run:',
        },
        {
          kind: 'commands',
          commands: [
            { command: 'claude', note: 'starts an interactive Claude Code session right there in the terminal.' },
          ],
        },
        {
          kind: 'paragraph',
          text: "you'll see a welcome banner and a prompt — Claude is now listening for natural-language instructions. keep this window open; you'll paste into it for every remaining step.",
        },
        { kind: 'heading', text: "quick sanity check (engineer path)" },
        {
          kind: 'claudePrompt',
          prompt: 'say hi and tell me what folder i\'m currently in (use pwd or Get-Location).',
        },
        {
          kind: 'paragraph',
          text: "you should see a friendly response plus a path like `/Users/your-name` or `C:\\Users\\your-name`. that's Claude confirming it can see your filesystem.",
        },
      ],
      doneLooksLike:
        "cloud-first: claude desktop or claude.ai is open and ready. engineer path: claude code is open, it greeted you, and showed your current folder.",
      helpPrompt:
        "i tried to start claude [desktop / code / on claude.ai] and [describe what happened — got an error, nothing happened, wrong thing opened]. what should i do?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 4. install CLIs (engineer path only)
  // ────────────────────────────────────────────────────────────────
  {
    id: 'install-clis',
    title: 'hand the pilot their instruments.',
    subtitle: "three tools the pilot uses to steer through specific parts of the harbour. engineers only.",
    shared: {
      intro:
        "**cloud-first path: skip this step entirely.** you don't need cli tools to read, review, and contribute via github mcp. engineers only: pnpm installs project dependencies, wrangler talks to cloudflare workers (our primary host), vercel cli is still needed for the few apps that haven't migrated yet.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please install three global npm packages for me: pnpm, wrangler, and vercel. after each install completes, run its version command (pnpm -v, wrangler -v, vercel -v) to confirm it works. if any fails with a permissions or execution-policy error, tell me exactly what to do next for my operating system. narrate what you're doing as you go.",
        },
        { kind: 'heading', text: "what you'll see" },
        {
          kind: 'paragraph',
          text: "Claude will ask for permission to run bash commands. approve each one. expect some yellow \"deprecated\" warnings — harmless. at the end, three version numbers printed in sequence.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "success: Claude reports three version numbers (e.g., `pnpm 9.15.2`, `wrangler 4.5.0`, `vercel 38.2.0`).",
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "on windows, if Claude hits \"running scripts is disabled on this system\", it will tell you to open an elevated PowerShell and run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`. accept the prompt, then paste the prompt above again.",
        },
      ],
      doneLooksLike:
        "Claude confirms all three tools installed and printed version numbers. cloud-first: done (skipped).",
      helpPrompt:
        "i ran the install prompt in Claude Code. Claude reported [paste Claude's response, especially anything red or anything about a failure]. what do i do next?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 5. sign in to CLIs (engineer path only)
  // ────────────────────────────────────────────────────────────────
  {
    id: 'signin',
    title: 'clear the port authority.',
    subtitle: 'the pilot\'s credentials get checked once per service, then carried forward.',
    shared: {
      intro:
        "**cloud-first path: skip this step.** engineers: Claude will run the sign-in commands for you. each opens your default browser for an OAuth sign-in. sign in with the matching account when each tab opens.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please sign me in to cloudflare and vercel. run `wrangler login` first (i'll sign in with my cloudflare account when the browser opens), then `vercel login` (i'll sign in with my github account). wait for each to confirm success before moving to the next. tell me when both are done.",
        },
        { kind: 'heading', text: 'what happens in your browser' },
        {
          kind: 'paragraph',
          text: "for each command, a browser tab opens with the service's sign-in page. sign in, approve the requested permissions, return to Claude Code. the terminal will print a success message.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "if you sign in with the wrong account by accident, just tell Claude: \"i signed in to the wrong cloudflare account — log me out and let me try again.\" Claude will run `wrangler logout` and re-trigger login.",
        },
      ],
      doneLooksLike: 'Claude reports `wrangler login` and `vercel login` both completed with success messages. cloud-first: done (skipped).',
      helpPrompt:
        "i'm on the sign-in step. Claude ran wrangler login / vercel login and [describe what happened — browser didn't open, wrong account, error]. how do i fix it?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 6. connect MCPs
  // ────────────────────────────────────────────────────────────────
  {
    id: 'mcp',
    title: 'issue the pilot\'s access passes.',
    subtitle: "MCP plugins let claude read and act in github, notion, slack — no local clone needed.",
    shared: {
      intro:
        "this step is for everyone — cloud-first and engineer alike. mcps (model context protocol) let claude do real work inside services instead of just describing commands. the github mcp alone means you can ask claude to read any file in any repo, review a pr, or check what changed last week — without cloning anything locally. anthropic maintains an official plugin marketplace with most of what we use.",
      body: [
        { kind: 'heading', text: 'cloud-first: install mcps in claude desktop' },
        {
          kind: 'callout',
          tone: 'info',
          text: "in claude desktop: go to **Settings → Integrations** (or paste the prompt below into a conversation). the github mcp is the most important one — it replaces the need to clone repos for most reading and reviewing tasks.",
        },
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Desktop or Claude Code',
          prompt:
            "please set up my MCP servers. run these plugin installs:\n\n- `claude plugin install github@claude-plugins-official`\n- `claude plugin install slack@claude-plugins-official`\n\nfor notion (not in the official marketplace yet), run:\n- `claude mcp add --transport http notion https://mcp.notion.com/mcp`\n\nafter all three, run `claude mcp list` so i can see the result. tell me which ones show \"needs authentication\" — those are normal; the browser OAuth triggers on first actual use, not now.",
        },
        { kind: 'heading', text: 'engineers: add vercel and cloudflare too' },
        {
          kind: 'claudePrompt',
          label: 'engineers only — paste into Claude Code',
          prompt:
            "please also install these additional MCP servers for the engineer toolchain:\n\n- `claude plugin install vercel@claude-plugins-official`\n- `claude plugin install cloudflare@claude-plugins-official` (if available)\n\nafter, run `claude mcp list` and confirm all servers are registered.",
        },
        { kind: 'heading', text: "what happens" },
        {
          kind: 'paragraph',
          text: "Claude runs the commands. each plugin install takes a few seconds. the final `mcp list` shows all servers — most will show \"needs authentication\" until first use. that's correct.",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "first-use OAuth: the first time you ask claude to do something real in github (like \"show me the last 5 commits on the port repo\"), your browser pops open for sign-in. happens once per service, then the token is remembered.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "cloud-first power move: once github mcp is connected, you can ask claude things like \"what changed in the port codebase this week\" or \"summarise the open PRs\" without having any code on your machine. github.com is always there too for direct browsing.",
        },
      ],
      doneLooksLike:
        "`claude mcp list` shows github, slack, and notion registered (probably \"needs authentication\" — that's fine). engineers also see vercel.",
      helpPrompt:
        "i ran the MCP setup prompt. Claude reported [paste `claude mcp list` output]. one or more servers is missing or failing — how do i fix it?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 7. clone + link a project (engineer path only)
  // ────────────────────────────────────────────────────────────────
  {
    id: 'clone-link',
    title: 'tow a vessel from the shipyard.',
    subtitle: "engineers: clone a repo locally. cloud-first: read the note and skip ahead.",
    shared: {
      intro:
        "**cloud-first path: skip this step.** the github mcp from the previous step already gives you access to all our repos without cloning. you can read any file, review prs, and contribute from anywhere. engineers who need to run code locally, deploy via wrangler, or do heavy builds: follow the prompt below.",
      body: [
        {
          kind: 'callout',
          tone: 'tip',
          text: "not sure if you need to clone? try working via github mcp first. if you find yourself needing to run `npm run dev` or `wrangler deploy`, come back and do this step.",
        },
        {
          kind: 'claudePrompt',
          label: 'engineers: paste into Claude Code, press return',
          prompt:
            "please set up the port (crm) project on my laptop. here's what i want:\n\n1. make a `Projects` folder in my home directory if one doesn't exist\n2. clone `git@github.com:ghandoff/windedvertigo.git` into that Projects folder\n3. cd into `windedvertigo/port`\n4. run `npm install` to install all dependencies\n5. run `wrangler whoami` to confirm cloudflare auth is working\n6. run `vercel link` if this project has a vercel fallback — when it asks, pick the `ghandoffs-projects` scope and the `wv-crm` project\n7. run `vercel env pull .env.local` to download the secrets\n\nnarrate each step. if the clone fails with a publickey error, walk me through setting up an SSH key for github (generate key → copy public key to clipboard → paste into github.com/settings/keys → retry the clone). at the end, confirm the final folder contents so i know it worked.",
        },
        { kind: 'heading', text: "what you'll see" },
        {
          kind: 'paragraph',
          text: "Claude will talk you through each step. npm install may take 2-3 minutes. wrangler whoami confirms you're logged into the right cloudflare account. env pull creates a `.env.local` file that git is configured to ignore.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "success: Claude reports a `.env.local` file exists in the port folder and that wrangler whoami shows the correct cloudflare account.",
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "never commit `.env.local`. git ignores it already. if you ever see it in `git status`, stop and tell garrett.",
        },
        { kind: 'heading', text: 'stack orientation' },
        {
          kind: 'callout',
          tone: 'info',
          text: "our hosting stack as of 2026: the port (crm), windedvertigo.com, harbour apps, and background cron jobs all run on **cloudflare workers** (deployed with `wrangler deploy`). vercel still hosts creaseworks, vault, and the ops dashboard. the primary database is **supabase** (postgres). notion is our editorial / knowledge layer, not the data source for most operational queries.",
        },
      ],
      doneLooksLike:
        "Claude confirms the port folder exists, dependencies are installed, wrangler is connected, and a `.env.local` file is present. cloud-first: done (skipped).",
      helpPrompt:
        "i ran the clone prompt. Claude got as far as [describe where it stopped] and reported [paste Claude's message]. what should i do next?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 8. verify
  // ────────────────────────────────────────────────────────────────
  {
    id: 'verify',
    title: 'a tour of the harbour.',
    subtitle: 'your pilot visits each building. if they can reach them, every pass works.',
    shared: {
      intro:
        "three quick checks. if claude can see your github repos, read the harbourmaster's logbook (notion), and confirm our live deployment — all the passes are working.",
      body: [
        { kind: 'heading', text: 'cloud-first verification' },
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Desktop or Claude.ai',
          prompt:
            "please do three things to verify my setup:\n\n1. using the github mcp, show me the 5 most recent commits on the `main` branch of the `windedvertigo` repo (just commit messages and dates — no code)\n2. fetch the most recent page titled \"welcome\" or similar from my notion workspace\n3. check the live port (crm) at https://port.windedvertigo.com and tell me the HTTP status code\n\nif any of these trigger a browser OAuth sign-in, tell me to check my browser. once all three are done, summarise what you can and can't see.",
        },
        { kind: 'heading', text: 'engineer verification' },
        {
          kind: 'claudePrompt',
          label: 'engineers: paste into Claude Code',
          prompt:
            "please do three things to verify my setup:\n\n1. run `wrangler deployments list --name wv-port` and show me the 3 most recent deployments with their dates and version IDs\n2. show me the NAMES of environment variables in `.env.local` (names only — never show values)\n3. fetch the most recent page titled \"welcome\" or similar from my notion workspace\n\nif any triggers a browser OAuth sign-in, tell me to check my browser. once all three are done, summarise what you can and can't see.",
        },
        { kind: 'heading', text: "what success looks like" },
        {
          kind: 'paragraph',
          text: "claude may trigger oauth for github or notion on first use — approve each in your browser when tabs open. after that, you should see real data from each service. no \"unauthenticated\" or \"not found\" errors.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "if claude answers all checks with real data — you're fully set up. 🎉",
        },
      ],
      doneLooksLike:
        "claude successfully responded to all three checks with real data — no auth errors.",
      helpPrompt:
        "i ran the verify prompt. claude responded with [paste response]. one or more of the three checks failed — how do i fix it?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 9. daily workflow
  // ────────────────────────────────────────────────────────────────
  {
    id: 'daily-workflow',
    title: 'find your sea legs.',
    subtitle: "the daily loop, the words that trigger it, and what to do when the PR pings your phone.",
    shared: {
      intro:
        "the papers are filed and your pilot's aboard. now, the rhythm — what every voyage actually looks like from here. this isn't more setup; this is how the team works every day.",
      body: [
        { kind: 'heading', text: 'the loop, in five sentences' },
        {
          kind: 'paragraph',
          text: "you describe what you want in plain language. claude works on a branch (its own, never yours). when claude pushes, a pull request opens on github. garrett reviews it on his phone or laptop and squash-merges. about 60–90 seconds later, the change is live at the public url.",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "the whole loop is designed so you never touch a terminal, never see a merge conflict, and never have to remember a git command. if claude or the harness hits something it can't resolve, it stops and asks — it won't guess and ship something wrong.",
        },
        { kind: 'heading', text: 'the trigger words' },
        {
          kind: 'paragraph',
          text: "any of these phrases tell claude to take the work it's been doing and push it toward production. they all mean the same thing — pick whichever feels natural:",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "**\"ship it\"** · **\"push it\"** · **\"deploy\"** · **\"make it live\"** · **\"send it up\"** · **\"open the PR\"**\n\nwhen you say any of these, claude commits the work on its branch, pushes to github, opens a pull request, and reports the PR url back to you. that's the signal that it's out of your hands and into the review queue.",
        },
        {
          kind: 'paragraph',
          text: "if you want claude to stop short of opening the PR — say \"just commit and push, don't open a PR yet\" or \"stage this but hold off on shipping.\" the language is loose; the harness reads intent.",
        },
        { kind: 'heading', text: 'reviewing on the go' },
        {
          kind: 'paragraph',
          text: "github has a free mobile app (iOS and android). install it, sign in once, and you'll get a notification every time a PR is opened or commented on. for most reviews you can read the diff, leave a comment, and approve — all from your phone in two minutes.",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "**how to read a diff:** green lines were added, red lines were removed. files are listed on the left. tap a line to comment on it. the \"files changed\" tab is where you'll spend 90% of review time; the \"conversation\" tab is for back-and-forth. don't worry about understanding every line — focus on whether the change does what was asked.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "stuck on a PR? open claude on your phone and paste the PR url. ask \"explain what this PR does in plain language\" or \"is there anything risky in this change?\" — you'll get a summary that's faster than reading the diff yourself.",
        },
        { kind: 'heading', text: 'two claudes, two jobs' },
        {
          kind: 'paragraph',
          text: "we use claude in two places, and it helps to know which is which:",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "**claude cowork** (desktop app, claude.ai) — for running the business. emails, calendar, invoices, notion, slack, proposals, decks. when you want to *think* with claude or move information between tools.\n\n**claude code** (code.claude.com on web, or terminal) — for changing the code. anything that touches a file in the windedvertigo repo, ships a deploy, or opens a PR. when you want to *build* with claude.\n\nrule of thumb: if the answer ends in \"save the file\" or \"deploy this,\" you want claude code. otherwise, cowork.",
        },
        { kind: 'heading', text: 'a word for each of you' },
        {
          kind: 'callout',
          tone: 'tip',
          text: "**maria** — you have the same ship authority as garrett. when you say \"ship it,\" claude pushes the PR and squash-merges immediately, no review gate. you're already on the engineer path for IDB Salvador work; for everything else you can stay cloud-first via code.claude.com and never touch a terminal.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "**payton** — cloud-first via code.claude.com. when you say \"ship it,\" claude opens a PR and garrett reviews it. you can keep iterating on the same branch — the PR updates automatically with each new push, so don't feel like you have to get it right in one shot. circulation and outreach changes that touch the website go through this loop.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "**lamis** — same loop as payton. start with something small (a typo fix on the harbour page, a date change on a campaign card) so the cadence feels natural by your second or third ship. the review wait stops feeling like a wait once you've done it a few times — it becomes the moment you switch tasks and let the PR cook.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "**jamie** — once your github account is set and garrett's added you to the repo, you're on the same cloud-first path as payton and lamis. you've spent more time with claude (cowork + chat) than they had at this point, so the natural-language side will feel like familiar ground. the new piece is reading a PR diff on your phone — github's mobile app makes that surprisingly nice, and the \"explain this PR\" claude trick works as a safety net while you build the muscle.",
        },
        { kind: 'heading', text: 'your first real ship' },
        {
          kind: 'paragraph',
          text: "the best way to feel the loop is to do it once. pick a tiny, harmless change — a date you want to update, a typo you noticed, a sentence you'd word differently on the home page. then paste the prompt below into claude code (code.claude.com) and watch it happen:",
        },
        {
          kind: 'claudePrompt',
          label: 'paste into claude code on web, press return',
          prompt:
            "i want to do my first real ship to learn the loop. here's the tiny change i want to make: [describe in one sentence — e.g., \"fix the typo 'recieve' to 'receive' on the harbour about page\" or \"change the year in the footer from 2025 to 2026\"]. please:\n\n1. find the file that needs the change\n2. make the edit\n3. commit it on this session's branch with a short, clear message\n4. push the branch and open a PR titled with what changed\n5. give me the PR url so i can review it on my phone\n\nnarrate as you go so i can follow along. don't squash-merge it yourself — leave that for review.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "what success feels like: claude reports a PR url within a minute or two. you open it on your phone via the github app, read the diff (one or two lines changed), and either approve or leave a comment. garrett merges. 60–90 seconds later, you reload the page and your change is live. that's the whole job.",
        },
        { kind: 'heading', text: 'what to do when something feels off' },
        {
          kind: 'callout',
          tone: 'info',
          text: "**claude proposes something risky** — it will stop and ask. say no, or ask it to do the smaller version. **a PR check fails** — paste the failure into claude and say \"this PR check failed; what does it mean and how do we fix it?\" **the live site doesn't show your change after a few minutes** — message garrett. it's almost always a cache or build delay, but worth flagging. **the wrong thing got merged** — message garrett immediately. nothing is unrecoverable; the worst case is reverting one commit, which takes 20 seconds.",
        },
      ],
      doneLooksLike:
        "you've shipped one tiny change end-to-end: described it to claude code, watched the PR open, reviewed the diff on your phone, and seen the change live at the public url. the loop now has a shape in your head.",
      helpPrompt:
        "i tried to ship my first change and [describe what happened — claude got stuck, the PR didn't open, the change didn't go live, the review felt confusing]. walk me through what to do next.",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 10. meet the agents (Mo, PaM, cARL)
  // ────────────────────────────────────────────────────────────────
  {
    id: 'agents',
    title: 'meet your agents.',
    subtitle: 'winded.vertigo has three AI teammates with long memories: Mo, PaM, and cARL.',
    shared: {
      intro:
        "the collective runs three persistent AI agents. unlike a fresh claude conversation, they remember decisions across sessions — because they read and write a shared memory api on the port. you talk to them in cowork (via plugins) or in claude code (by cd-ing into their brain folder).",
      body: [
        { kind: 'heading', text: 'the three agents' },
        {
          kind: 'paragraph',
          text: "**Mo** — chief marketing officer. strategy, brand, pipeline, campaigns. brain lives in `docs/cmo/`; dashboard at `/strategy` (see the \"Mo's log\" tab).",
        },
        {
          kind: 'paragraph',
          text: "**PaM** — project + momentum manager. tracks who committed to what, dependencies, and follow-ups. brain in `docs/pam/`; dashboard at `/pam` — a commitments board and an interactive timeline.",
        },
        {
          kind: 'paragraph',
          text: "**cARL** — cyber agent of research + learning. the living library of evidence, threshold concepts, and pedagogy. brain in `docs/carl/`; dashboard at `/carl`.",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "all three share one memory api on port.windedvertigo.com. their decisions are transparent — anything they log shows up on the dashboards, so the whole collective can see what was decided.",
        },
        { kind: 'heading', text: 'one-time setup: your agent token' },
        {
          kind: 'paragraph',
          text: "the plugins talk to the memory api using a shared token called `WV_AGENT_TOKEN`. **ask garrett for the value** (it isn't written down in the repo on purpose), then add it to your shell so every session can read it.",
        },
        {
          kind: 'commands',
          commands: [
            {
              label: 'mac / linux — add to your shell, then reload it',
              command: "echo 'export WV_AGENT_TOKEN=\"paste-the-token-from-garrett-here\"' >> ~/.zshrc && source ~/.zshrc",
              note: "replace the placeholder with the real token. if you use bash, swap ~/.zshrc for ~/.bashrc.",
            },
            {
              label: 'windows (powershell) — sets it for new terminals',
              command: 'setx WV_AGENT_TOKEN "paste-the-token-from-garrett-here"',
              note: "open a new terminal afterwards so the variable is picked up.",
            },
          ],
        },
        { kind: 'heading', text: 'install the cowork plugins' },
        {
          kind: 'paragraph',
          text: "the three plugins live in the repo at `docs/plugins/dist/` — `mo-cmo.plugin`, `pam-pm.plugin`, and `carl-research.plugin`. in cowork, open plugins → install from file → pick the `.plugin` you want, then start a session. the agent loads its memory automatically.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "prefer claude code? you don't need the plugins at all — just `cd docs/cmo` (or `docs/pam`, `docs/carl`) and start talking, or say \"i want to talk to PaM\" from anywhere in the monorepo.",
        },
        { kind: 'heading', text: 'say hello' },
        {
          kind: 'claudePrompt',
          label: 'paste into a cowork session with the pam-pm plugin installed',
          prompt:
            "hi PaM — what's on my plate this week, and is anything blocked or waiting on someone else? if you don't have any commitments logged for me yet, say so and ask me what i'm working on.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "if PaM answers with your commitments (or asks what you're working on), the token, plugin, and memory api are all wired correctly. the same pattern works for Mo (\"what's our pipeline looking like?\") and cARL (\"what does the research say about threshold concepts?\").",
        },
      ],
      doneLooksLike:
        "your WV_AGENT_TOKEN is in your shell, at least one agent plugin is installed in cowork, and you've had a first exchange where the agent clearly remembered (or asked to learn) your context.",
      helpPrompt:
        "i'm setting up the winded.vertigo agents (Mo / PaM / cARL). i added WV_AGENT_TOKEN and installed the [which one] plugin, but [describe what happened — the agent says the token isn't set, the plugin won't install, the briefing is empty]. walk me through fixing it.",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 11. celebration
  // ────────────────────────────────────────────────────────────────
  {
    id: 'done',
    title: "you can sail anywhere now. ⚓",
    subtitle: 'you have your pilot. you have your charts. you have your papers.',
    meta: true,
    shared: {
      body: [
        {
          kind: 'paragraph',
          text: "everything is wired: accounts exist, mcps connected, github and notion reachable. from now on, you can ask claude to look into any repo we invite you to, review work, catch up on what changed, or (if you're on the engineer path) clone and deploy.",
        },
        { kind: 'heading', text: 'good next prompts to try' },
        {
          kind: 'claudePrompt',
          label: 'cloud-first: a real task without cloning anything',
          prompt:
            "using the github mcp, show me the last 10 commits to the port repo and summarise what the team has been working on this week. then check if there are any open pull requests and describe what they're doing.",
        },
        {
          kind: 'claudePrompt',
          label: 'engineer: a full loop practice',
          prompt:
            "make me a tiny practice change in the port repo: create a new git branch called `practice/my-first-change`, add a harmless comment to the top of the README explaining you (by name) were here, commit it, push it, and tell me the github URL of the new branch. don't deploy — just the push.",
        },
        {
          kind: 'paragraph',
          text: "message garrett when you're done with your test and we'll do a quick review together.",
        },
        { kind: 'heading', text: 'working on the go' },
        {
          kind: 'callout',
          tone: 'tip',
          text: "the claude mobile app (iOS / Android) is a great companion for async reviews. you can ask it to summarise a PR, draft a response to a notion comment, or check project status — anywhere, any time. the github and notion mcps work on mobile too once connected.",
        },
        { kind: 'heading', text: 'if something breaks later' },
        {
          kind: 'callout',
          tone: 'info',
          text: "claude is your first line of defence. paste your error, describe what you were trying to do, and it will almost always diagnose. if claude and garrett are both stumped, we pair up. the only bad way to be stuck is in silence.",
        },
        { kind: 'heading', text: 'bookmark this page' },
        {
          kind: 'paragraph',
          text: "if you ever get a new device, or if someone new joins the team, this docent is still here. reset progress (top-right) to run through it fresh.",
        },
      ],
      helpPrompt: "i'm all set up. no help needed!",
    },
  },
];

export const firstContentStepIndex = 1; // accounts is the first non-meta step
