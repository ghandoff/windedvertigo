export const COPY = {
  arrival: {
    heading: 'welcome. you’re about to play for what matters.',
    subheading: 'enter your name to join the session.',
    nameLabel: 'your name',
    joinButton: 'join',
    waitingForFacilitator: 'we’re waiting for the facilitator to start. stretch a little.',
    codeLabel: 'session code',
    hint: 'your name is all you need. the facilitator will kick things off.',
  },
  staging: {
    panels: [
      {
        step: '01',
        heading: 'you’re founding a company.',
        body: 'with your team, from nothing. not the product. not the logo. the thing underneath all of that — what it stands for, and what it refuses to.',
      },
      {
        step: '02',
        heading: 'you have 150 credos. that’s the whole budget.',
        body: 'values will come up for auction, one at a time. teams bid in real time. the highest offer wins the value. credos only leave your account when you win — losing bids return to your balance.',
      },
      {
        step: '03',
        heading: 'every win shapes who you become.',
        body: 'every loss is a trade-off you chose. when the credos run out, they’re gone. choose with intent.',
      },
      {
        step: '04',
        heading: 'these are the twenty values.',
        body: 'read them now. you won’t see them again until the auction begins.',
        showValues: true,
      },
    ] as const,
    next: 'continue',
    begin: 'i’m ready',
    progressLabel: (current: number, total: number) => `panel ${current} of ${total}`,
  },
  grouping: {
    heading: 'pick the strategy archetype that feels least like you.',
    subheading:
      'this is how teams are formed. picking the archetype that’s least like you means your team will mix four different styles — the people who think in ways you don’t. that tension is what shapes a stronger company.',
    why: 'you’ll feel it during the auction: a builder will push for speed, a diplomat for consensus, a rebel for risk, a steward for care. one team, four lenses.',
    options: [
      { key: 'builder', label: 'the builder — ship, measure, ship again.' },
      { key: 'diplomat', label: 'the diplomat — align everyone before a single move.' },
      { key: 'rebel', label: 'the rebel — burn the playbook and see what catches.' },
      { key: 'steward', label: 'the steward — protect what’s fragile, invest in what lasts.' },
    ] as const,
    confirm: 'team me up',
    assigned: (colour: string, others: number) =>
      `you’re with team ${colour}. ${others} ${others === 1 ? 'other is' : 'others are'} finding their seats.`,
    lateJoin:
      'the session has already started — you’ve been added to the smallest team to keep things moving.',
    waitingForFacilitator:
      'the session is in progress — ask your facilitator to add you to a team.',
    teamFormed: 'you’re in. your facilitator will move things along shortly.',
    teamRosterHeading: 'your team',
    teamRosterEmpty: 'you’re first in. teammates will show up here as they arrive.',
    teamChipHint: 'tap your team chip in the header any time to see who’s with you.',
    hint: 'pick the archetype that feels least like you — that’s how teams form.',
  },
  scene: {
    ready: 'i’ve read it. ready.',
    sectorLabel: 'sector',
    budgetLabel: 'your budget',
    valuesHeading: 'the twenty values',
    valuesIntro:
      'these are the values that will come up for auction. read them with your team and decide which matter most for your company before bidding starts.',
    hint: 'read your company profile and the value list. you’ll bid on these shortly.',
  },
  strategy: {
    prompt:
      'sort each value, then vote on how much to bid. your captain locks the final number.',
    zones: {
      must: 'must have',
      nice: 'would be nice',
      wont: 'won’t fight for',
    },
    deckLabel: 'the deck',
    budgetHint: 'set a soft ceiling. the auction will test it.',
    nudge30s: 'agree on your top three.',
    nudge90s: 'one minute to bidding. lock your strategy.',
    ceilingLabel: 'soft ceiling',
    ceilingHint: 'your team’s reminder — not enforced. you can still bid past it.',
    keyboardHint:
      'keyboard: focus a card, then press M (must), N (nice), W (won’t), or D (back to deck).',
    pollPrompt: 'how much should we bid on this?',
    pollLabels: {
      0: 'skip',
      20: 'low',
      40: 'mid',
      60: 'high',
      80: 'all-in',
    } as Record<number, string>,
    leaning: (amount: number) => `team leaning: ${amount} credos`,
    splitTeam: 'team split. talk it out — no consensus yet.',
    captainCta: 'tap to claim bid captain',
    captainSelf: 'you are the bid captain.',
    captainIs: (name: string) => `${name} is your bid captain.`,
    captainNoneYet: 'your team needs a bid captain — tap to claim the role.',
    captainPass: 'pass captain role',
    captainAutoAssigned:
      'no one claimed it — you’re the bid captain. you can pass the role to a teammate.',
    captainReassigned: (name: string) => `captain reassigned: ${name} took over.`,
    captainNextInLine: (current: string) =>
      `you’re next in line. if ${current} drops, the role will pass to you automatically.`,
    lockBid: 'lock bid',
    unlockBid: 'unlock',
    lockedAt: (amount: number) => `locked at ${amount} credos`,
    plannedSpend: (planned: number, budget: number) =>
      `planned spend: ${planned} / ${budget} credos.`,
    plannedSpendOver: 'adjust before the auction starts.',
    hint: 'sort values, vote on amounts. your captain locks the final bid.',
  },
  brainstorm: {
    heading: 'before the values are revealed.',
    prompt: 'what do you think your company should prioritize right now?',
    placeholder: 'one short answer — under 80 characters.',
    submit: 'send',
    submitted: 'in. read what the room is saying.',
    feedHeading: 'the room, so far',
    feedEmpty: 'first response coming through any second.',
    counter: (n: number, total: number) => `${n} / ${total} responded`,
    facilitatorHide: 'hide',
    facilitatorHideConfirm: 'hide this response from the wall?',
    wallHeading: 'what should our companies prioritize?',
    hint: 'one answer, anonymous. read the wall while you wait.',
  },
  practice: {
    label: 'practice round',
    badge: 'practice',
    dummyValueName: 'Free coffee in the office forever',
    dummyValueDescription:
      'a stand-in. no real values are spent. learn the bid mechanic before the real thing.',
    intro:
      'one round, dummy value, separate practice credits. losing here costs you nothing.',
    creditsLabel: 'practice credits',
    afterWin: (team: string, amount: number) =>
      `${team} won the practice round for ${amount} credits. those credits are gone — that’s how it’ll feel for real next.`,
    afterNoBid:
      'no bids came in. when the real auction opens, your team’s pre-agreed amount will auto-submit at the buzzer — so silence still places a bid.',
    startCta: 'start practice round',
    endCta: 'end practice and start real auction',
    hint: 'dry run. same mechanic, no real credits at stake.',
  },
  restrategize: {
    heading: 'half-time. regroup.',
    body:
      'you have real numbers now. update your votes, see what your competitors paid, and let your captain re-lock.',
    remainingCredos: 'remaining credos',
    wonHeading: 'you won',
    lostHeading: 'you bid and lost',
    competitionHeading: 'competition so far',
    pricePaid: (amount: number) => `${amount} credos`,
    notYetAuctioned: 'still coming',
    resumeCta: 'resume auction',
    facilitatorTriggerCta: 'trigger restrategize break',
    hint: 'see what others paid. update your votes before the auction resumes.',
  },
  auction: {
    live: 'live now.',
    bidCta: 'bid',
    bidPlaced: 'bid in.',
    won: 'locked in.',
    creditsHeldHint:
      'your bid reserves credos for this round. lose, and they return — only winning spends them.',
    betweenAuctions: 'between auctions. your facilitator will queue the next value.',
    restrategise: 'two minutes. regroup. adjust.',
    nextBidLabel: 'your bid',
    noBidsYet: 'no bids yet. open it up.',
    insufficientCredos:
      'that’s more than your team has in the bank — try a smaller number.',
    mustBeatHigh: 'your bid needs to top the current high. try a higher number.',
    outbid:
      'another team beat your bid. you can bid again if you want to stay in.',
    outOfCredos:
      'your credos are spent for this round. you can still watch and brief your team for the next one.',
    hint: 'watch for your value. your captain bids — be ready to advise.',
  },
  reflection: {
    prompts: [
      'which values did you secure that you didn’t intend to?',
      'which did you miss?',
      'what did this force you to trade off?',
      'what kind of company have you just become?',
    ],
    answerPlaceholder: 'jot a sentence or two for your team…',
    purpose: 'in one sentence, what does your company exist to do?',
    placeholder: 'we exist to...',
    next: 'next',
    submit: 'submit reflection',
    submittedHeading: 'submitted.',
    submittedBody:
      'your answers are saved with your identity card. wait for the facilitator to regather the room.',
    editAnswers: 'edit answers',
    ready: 'your identity card is ready. open it, share it, screenshot it.',
    hint: 'four questions, then one sentence about what your company exists to do.',
  },
  regather: {
    cta: 'share your identity card.',
    qr: 'scan to keep playing — windedvertigo.com/play',
    download: 'download identity card',
    hint: 'your identity card is the artifact of everything your team chose.',
  },
  facilitator: {
    startSession: 'start session',
    nextAct: 'next act',
    sessionComplete: 'session complete — share identity cards, then close the room.',
    extend: '+30 sec',
    goBack: '← go back',
    jumpConfirm:
      'you’re about to jump acts — this is irreversible for the session feel. continue?',
    continue: 'continue',
    cancel: 'cancel',
    broadcastLabel: 'broadcast a message',
    broadcastSend: 'send',
    startAuction: 'start auction',
    onTheBlock: 'on the block',
    liveSignal: 'live signal',
    tools: 'tools',
    resetBid: 'reset current bid',
    refundCredos: 'refund credos',
    muteTeam: 'mute team',
    deckLabel: 'value deck',
    deckStep1: 'pick a value from the list below.',
    deckStep2: 'advance to the auction act using the timeline on the left.',
    deckStep3: 'press start auction. teams have 60 seconds to bid.',
    deckNotInAuction:
      'value selected — advance the act to “auction” to enable bidding.',
    closeHeading: 'close the session.',
    closeBody:
      'every team’s identity card includes their reflections. download the full set as png files to share back with participants.',
    downloadAll: (n: number) =>
      `download all ${n} identity card${n === 1 ? '' : 's'}`,
  },
  wall: {
    joinAt: (code: string) => `join at windedvertigo.com/play · code ${code}`,
    waitingLabel: 'waiting for participants',
    betweenActs: 'between acts',
    regatherHeading: 'the room you built.',
    regatherSubheading:
      'every team shaped a different company. notice what was won, what was missed, and where the room agreed.',
    patternsHeading: 'patterns across the room',
  },
  errors: {
    sessionNotFound: 'session not found. check the code with your facilitator.',
    bidRejected:
      'the bid didn’t go through. try again, or adjust the amount if it’s too high.',
  },
  broadcast: {
    label: 'from your facilitator',
  },
} as const;
