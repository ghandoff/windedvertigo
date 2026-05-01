export const COPY = {
  arrival: {
    heading: 'welcome. you’re about to play for what matters.',
    subheading: 'enter your name to join the session.',
    nameLabel: 'your name',
    joinButton: 'join',
    waitingForFacilitator: 'we’re waiting for the facilitator to start. stretch a little.',
    codeLabel: 'session code',
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
        body: 'values will come up for auction, one at a time. teams bid in real time. the highest offer wins. losses are final — no second round, no refund.',
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
  },
  scene: {
    ready: 'i’ve read it. ready.',
    sectorLabel: 'sector',
    budgetLabel: 'your budget',
    valuesHeading: 'the twenty values',
    valuesIntro:
      'these are the values that will come up for auction. read them with your team and decide which matter most for your company before bidding starts.',
  },
  strategy: {
    prompt: 'drag each value into a zone. your team must agree before the auction.',
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
  },
  auction: {
    live: 'live now.',
    bidCta: 'bid',
    bidPlaced: 'bid in.',
    won: 'locked in.',
    refundNeverHappens: 'no refunds. once spent, gone.',
    restrategise: 'two minutes. regroup. adjust.',
    nextBidLabel: 'your bid',
    noBidsYet: 'no bids yet. open it up.',
    insufficientCredos: 'not enough credos for that bid.',
    mustBeatHigh: 'must beat the current high.',
    outbid: 'outbid! someone moved past you.',
    outOfCredos: 'no credos left. you’re out of this auction — watch and learn.',
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
  },
  regather: {
    cta: 'share your identity card.',
    qr: 'scan to keep playing — windedvertigo.com/play',
    download: 'download identity card',
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
    bidRejected: 'bid rejected.',
  },
  broadcast: {
    label: 'from your facilitator',
  },
} as const;
