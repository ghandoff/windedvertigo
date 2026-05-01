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
          text: "claude code is your harbour pilot — a local expert who boards a foreign ship and guides it safely through tricky waters. that's exactly what it does when you arrive at a new repo. this docent walks you through getting a new winded.vertigo project running on your laptop. because your pilot is already aboard, you'll never have to type a raw terminal command yourself — you'll just copy a prompt, paste it into Claude Code, press return, and let the pilot steer.",
        },
        { kind: 'heading', text: 'the pattern' },
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
          text: "1) `CLAUDE.md` at the repo root = how Claude should work in THIS project (evolves with the repo). 2) `.claude/evergreen.md` = team-wide facts that never drift (brand voice, IP, accessibility). 3) your personal `~/.claude/CLAUDE.md` = your own preferences, private to your laptop.",
        },
        {
          kind: 'paragraph',
          text: "you don't need to do anything with these now. just know that when you clone a repo, you inherit its memory for free.",
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
    subtitle: 'five sign-ups. the only part of the voyage your pilot can\'t handle for you.',
    shared: {
      intro:
        "think of each as a different window at the harbour office. most are free tiers. anthropic is the only one that involves billing, and your Claude Code is already paid for — this is a separate api-key account for the MCP integration later.",
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
              instruction: "the **shipyard** — keeps every version of every vessel on record, forever. **in practice:** github stores your code and tracks every change you make, so nothing's ever lost and we can work in parallel without stepping on each other. **when you'll feel it:** every \"commit and push\" you run. **next:** sign up, then ask garrett to invite you to the `ghandoff` organisation.",
              requiresInvite: true,
            },
            {
              label: 'vercel',
              href: 'https://vercel.com/signup',
              instruction: "the **dock** — where a finished ship welcomes visitors aboard. **in practice:** when you push code to github, vercel reads it, builds a live website, and gives it a shareable URL. **when you'll feel it:** every change gets its own preview link before going fully live. **next:** sign up with your github account; ask garrett to invite you to the `ghandoffs-projects` team.",
              requiresInvite: true,
            },
            {
              label: 'cloudflare',
              href: 'https://dash.cloudflare.com/sign-up',
              instruction: "the **lighthouse + warehouse** — guides visitors to the right dock, and stores heavy cargo. **in practice:** lighthouse (dns) translates `windedvertigo.com` into the actual server that answers; warehouse (r2) holds big files (images, pdfs, exports) cheaply. **when you'll feel it:** rarely — only when DNS needs changing or an app reads/writes a large file. **next:** sign up, then ask garrett to invite you to the gearbox account (dns) and the garrett@ account (r2 storage).",
              requiresInvite: true,
            },
            {
              label: 'notion',
              href: 'https://www.notion.so',
              instruction: "the **harbourmaster's logbook** — where humans write bulletins for ships to consult. **in practice:** notion is where we write content (bios, page copy, project cards) that our public websites then READ automatically — update notion, the site updates within minutes. **when you'll feel it:** editing a team bio and watching `windedvertigo.com/we` update without touching code. **next:** you're probably already a workspace member. confirm you see \"wv // system stewardship\" in your sidebar.",
            },
            {
              label: 'anthropic console',
              href: 'https://console.anthropic.com',
              instruction: "the **pilot's guild** — trains and credentials the pilots. **in practice:** anthropic is the company behind claude. they run the API your personal claude code talks to. you pay per conversation (pennies per minute). **when you'll feel it:** you'll generate an api key here and keep it sealed — claude uses it on your behalf for every request. **next:** sign up. this is a separate account from your Claude Code subscription — it's for API access. add $5-10 to start; you'll burn through it slowly.",
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "the anthropic api key (you'll generate it in a moment) starts with `sk-ant-`. treat it like your toothbrush. never paste it into a chat, slack, email. never commit it to github. if it ever leaks, rotate it from the console.",
        },
      ],
      doneLooksLike:
        "you've signed up for all five, messaged garrett about the three \"needs invite\" ones, and generated (but not pasted anywhere yet) an anthropic api key.",
      helpPrompt:
        "i'm on the accounts step. i signed up for [service name] but [describe what happened — didn't get an invite, can't find settings, sign-up failed]. what should i do?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 3. open Claude Code
  // ────────────────────────────────────────────────────────────────
  {
    id: 'open-claude',
    title: 'your pilot comes aboard.',
    subtitle: 'start claude code. from now on, the pilot steers — you just describe where you want to go.',
    shared: {
      intro:
        "Claude Code is already installed on your laptop — you can verify by running the command below in the terminal app (your helm). everything after this step happens inside Claude Code.",
      body: [
        { kind: 'heading', text: 'start Claude Code' },
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
        {
          kind: 'callout',
          tone: 'tip',
          text: "prefer a visual interface? Claude Code also runs inside VS Code, Cursor, and the Claude Desktop app. if you already use one of those with Claude Code, just open the chat there instead — the prompts work identically.",
        },
        { kind: 'heading', text: "quick sanity check" },
        {
          kind: 'paragraph',
          text: "paste this into Claude to confirm it's working and has access to your filesystem:",
        },
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
        "Claude Code is open, it greeted you, and it told you your current folder.",
      helpPrompt:
        "i tried to start Claude Code with the `claude` command and [describe what happened — got an error, nothing happened, wrong thing opened]. what should i do?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 4. install CLIs
  // ────────────────────────────────────────────────────────────────
  {
    id: 'install-clis',
    title: 'hand the pilot their instruments.',
    subtitle: "three tools the pilot uses to steer through specific parts of the harbour.",
    shared: {
      intro:
        "the pilot's instruments — tools that work specific parts of the harbour. **pnpm** installs the code a project depends on (the cargo a ship carries). **vercel cli** talks to the dock — telling vercel what to build, which project to link. **wrangler** talks to the lighthouse and warehouse — configuring cloudflare dns and r2. **in practice:** you install them once; claude uses them forever on your behalf. **when you'll feel it:** rarely directly — claude runs them in the background while narrating what's happening.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please install three global npm packages for me: pnpm, vercel, and wrangler. after each install completes, run its version command (pnpm -v, vercel -v, wrangler -v) to confirm it works. if any fails with a permissions or execution-policy error, tell me exactly what to do next for my operating system. narrate what you're doing as you go.",
        },
        { kind: 'heading', text: "what you'll see" },
        {
          kind: 'paragraph',
          text: "Claude will ask for permission to run bash commands. approve each one. expect some yellow \"deprecated\" warnings — harmless. at the end, three version numbers printed in sequence.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "success: Claude reports three version numbers printed (e.g., `pnpm 9.15.2`, `vercel 38.2.0`, `wrangler 3.80.0`).",
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "on windows, if Claude hits \"running scripts is disabled on this system\", it will tell you to open an elevated PowerShell and run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`. accept the prompt, then paste the prompt above again.",
        },
      ],
      doneLooksLike:
        "Claude confirms all three tools installed and printed version numbers.",
      helpPrompt:
        "i ran the install prompt in Claude Code. Claude reported [paste Claude's response, especially anything red or anything about a failure]. what do i do next?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 5. sign in to CLIs
  // ────────────────────────────────────────────────────────────────
  {
    id: 'signin',
    title: 'clear the port authority.',
    subtitle: 'the pilot\'s credentials get checked once per service, then carried forward.',
    shared: {
      intro:
        "Claude will run the sign-in commands for you. each opens your default browser for an OAuth sign-in — the port authority checking papers. sign in with the matching account when each tab opens.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please sign me in to vercel and cloudflare. run `vercel login` first (i'll sign in with my github account when the browser opens), then `wrangler login` (i'll sign in with my cloudflare account). wait for each to confirm success before moving to the next. tell me when both are done.",
        },
        { kind: 'heading', text: 'what happens in your browser' },
        {
          kind: 'paragraph',
          text: "for each command, a browser tab opens with the service's sign-in page. sign in, approve the requested permissions, return to Claude Code. the terminal will print a success message.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "if you sign in with the wrong account by accident, just tell Claude: \"i signed in to the wrong vercel account — log me out and let me try again.\" Claude will run `vercel logout` and re-trigger login.",
        },
      ],
      doneLooksLike: 'Claude reports both `vercel login` and `wrangler login` completed with success messages.',
      helpPrompt:
        "i'm on the sign-in step. Claude ran `vercel login` / `wrangler login` and [describe what happened — browser didn't open, wrong account, error]. how do i fix it?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 6. clone + link a project
  // ────────────────────────────────────────────────────────────────
  {
    id: 'clone-link',
    title: 'your first voyage.',
    subtitle: "tow a vessel from the shipyard, tie it to its dock, open the sealed orders.",
    shared: {
      intro:
        "three things happen in one prompt: (1) tow from the shipyard — fetch the code from github, (2) tie to the dock — tell vercel this folder is this app's home berth, (3) open sealed orders — download the secret .env.local file with passwords and api keys. we'll set up `harbour-apps/apps/creaseworks` as your starter project.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please set up the creaseworks project on my laptop. here's what i want:\n\n1. make a `Projects` folder in my home directory if one doesn't exist\n2. clone `git@github.com:ghandoff/harbour-apps.git` into that Projects folder\n3. cd into `harbour-apps/apps/creaseworks`\n4. run `pnpm install` to install all dependencies\n5. run `vercel link` — when it asks, pick the `ghandoffs-projects` scope and the existing `creaseworks` project\n6. run `vercel env pull .env.local` to download the secrets\n\nnarrate each step. if the clone fails with a publickey error, walk me through setting up an SSH key for github (generate key → copy public key to clipboard → paste into github.com/settings/keys → retry the clone). at the end, confirm the final folder contents so i know it worked.",
        },
        { kind: 'heading', text: "what you'll see" },
        {
          kind: 'paragraph',
          text: "Claude will talk you through each step. pnpm install may take 2-3 minutes. vercel link prompts for the team and project — Claude will tell you which to pick. env pull creates a `.env.local` file that git is configured to ignore.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "success: Claude reports a `.env.local` file exists in the creaseworks folder and that everything completed without errors.",
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "if the clone fails and Claude walks you through setting up an SSH key, you'll go through a brief browser detour to paste your public key into github.com/settings/keys — Claude will give you exact wording. after pasting, Claude retries the clone automatically.",
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: "never commit `.env.local`. git ignores it already. if you ever see it in `git status`, stop and tell garrett.",
        },
      ],
      doneLooksLike:
        "Claude confirms the creaseworks folder exists, has dependencies installed, is linked to vercel, and contains a `.env.local` file.",
      helpPrompt:
        "i ran the clone + link prompt. Claude got as far as [describe where it stopped] and reported [paste Claude's message]. what should i do next?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 7. connect MCPs
  // ────────────────────────────────────────────────────────────────
  {
    id: 'mcp',
    title: 'issue the pilot\'s access passes.',
    subtitle: "MCP plugins let your pilot enter the shipyard, dock, lighthouse, and harbourmaster's office.",
    shared: {
      intro:
        "you already registered with each part of the harbour (step 2). now you issue your pilot the passes that let them actually walk into those buildings and do work. MCP (Model Context Protocol) lets Claude DO things in services instead of just telling you commands. anthropic maintains an official plugin marketplace with most of what we use.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please set up my MCP servers. run these plugin installs:\n\n- `claude plugin install vercel@claude-plugins-official`\n- `claude plugin install github@claude-plugins-official`\n- `claude plugin install slack@claude-plugins-official`\n\nfor notion (not in the official marketplace yet), run:\n- `claude mcp add --transport http notion https://mcp.notion.com/mcp`\n\nafter all four, run `claude mcp list` so i can see the result. tell me which ones show \"needs authentication\" — those are normal; the browser OAuth triggers on first actual use, not now.",
        },
        { kind: 'heading', text: "what happens" },
        {
          kind: 'paragraph',
          text: "Claude runs four commands. each plugin install takes a few seconds. the final `mcp list` shows all four servers in their \"needs authentication\" state — that's correct.",
        },
        {
          kind: 'callout',
          tone: 'info',
          text: "first-use OAuth: the first time you ask Claude to do something real with vercel (like \"list my deployments\"), your browser pops open for sign-in. happens once per service. don't be surprised.",
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: "skip slack if you don't need it yet. you can always add it later with the same plugin install command.",
        },
      ],
      doneLooksLike:
        "`claude mcp list` shows vercel, github, slack, and notion all registered (probably as \"needs authentication\" — that's fine).",
      helpPrompt:
        "i ran the MCP setup prompt. Claude reported [paste `claude mcp list` output]. one or more servers is missing or failing — how do i fix it?",
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
        "three quick checks. if your pilot can (a) see recent work at the dock, (b) read the sealed orders on your ship, and (c) fetch a page from the harbourmaster's logbook — all the passes are working. still in the same Claude Code session (inside the creaseworks folder). paste the prompt below.",
      body: [
        {
          kind: 'claudePrompt',
          label: 'paste into Claude Code, press return',
          prompt:
            "please do three things to verify my setup:\n\n1. list my 3 most recent vercel deployments for this project (creaseworks) with their dates and URLs\n2. show me the NAMES of environment variables in `.env.local` (names only — never show values)\n3. fetch the most recent page titled \"welcome\" or similar from my notion workspace\n\nif any of these triggers a browser OAuth sign-in, tell me to check my browser. once all three are done, summarise what you can and can't see so i know the setup works.",
        },
        { kind: 'heading', text: "what success looks like" },
        {
          kind: 'paragraph',
          text: "Claude will probably trigger OAuth for vercel and notion the first time — approve each in your browser when tabs open. after that, Claude lists 3 deployment URLs, a list of env var names (things like `DATABASE_URL`, `NEXT_PUBLIC_API_BASE`), and one Notion page title.",
        },
        {
          kind: 'callout',
          tone: 'success',
          text: "if Claude answers all three with real data (no \"unauthenticated\" or \"not found\" errors) — you're fully set up. 🎉",
        },
      ],
      doneLooksLike:
        "Claude successfully listed deployments, env var names, and a Notion page — no auth errors.",
      helpPrompt:
        "i ran the verify prompt. Claude responded with [paste response]. one or more of the three checks failed — how do i fix it?",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // 9. celebration
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
          text: "everything is wired: accounts exist, tools installed, project cloned and linked, MCP connected. from now on, you can ask Claude to clone any repo we invite you to, pull its secrets, and help you ship.",
        },
        { kind: 'heading', text: 'good next prompts to try' },
        {
          kind: 'claudePrompt',
          label: 'when you\'re ready for a real task',
          prompt:
            "make me a tiny practice change in creaseworks: create a new git branch called `practice/my-first-change`, add a harmless comment to the top of the README explaining you (by name) were here, commit it, push it, and tell me the URL of the preview deployment that vercel creates.",
        },
        {
          kind: 'paragraph',
          text: "this gives you the whole loop — branch, edit, commit, push, preview. message garrett when you're done and we'll merge it together as a practice run.",
        },
        { kind: 'heading', text: 'if something breaks later' },
        {
          kind: 'callout',
          tone: 'info',
          text: "Claude Code is your first line of defence. paste your error, describe what you were trying to do, and it will almost always diagnose. if Claude and garrett are both stumped, we pair up. the only bad way to be stuck is in silence.",
        },
        { kind: 'heading', text: 'bookmark this page' },
        {
          kind: 'paragraph',
          text: "if you ever get a new laptop, or if someone new joins the team, this docent is still here. reset progress (top-right) to run through it fresh.",
        },
      ],
      helpPrompt: "i'm all set up. no help needed!",
    },
  },
];

export const firstContentStepIndex = 1; // accounts is the first non-meta step
