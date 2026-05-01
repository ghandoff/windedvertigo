import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── reader.ghost ────────────────────────────────────────────────
// type → react → adjust | real-time
// AI audience reacts as you type, rhetoric and audience awareness

export function readerGhost(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: audience effect",
      timeLimit: 60,
      config: {
        type: "prediction",
        prediction: {
          question:
            "aristotle identified three modes of persuasion: ethos (credibility), pathos (emotion), and logos (logic). modern research on audience awareness shows that writers who actively consider their reader produce text rated how much more persuasive than those who don't?",
          type: "choice",
          options: [
            { id: "10", label: "about 10% more persuasive" },
            { id: "25", label: "about 25% more persuasive" },
            { id: "40", label: "about 40% more persuasive" },
            { id: "60", label: "about 60% more persuasive" },
          ],
          answer: "40",
        },
      },
      hints: [
        "audience awareness is consistently one of the strongest predictors of writing quality",
        "the effect is larger than most writing interventions like grammar instruction",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "open-response",
      phase: "struggle",
      label: "write: for your audience",
      timeLimit: 240,
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "write a short paragraph (4-6 sentences) arguing that public libraries should receive more funding. your audience: a city council member who is skeptical about government spending. write directly to them. think about what they value, what they fear, what would move them. as peter elbow wrote, 'writing is not just getting things down on paper, it is getting things inside someone else's head.'",
          responseType: "text",
          anonymous: false,
        },
      },
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "threshold",
      label: "play: reader reactions",
      timeLimit: 240,
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "the facilitator will display one of the paragraphs from the previous round (anonymously). each of you is a different reader encountering this text. react from your character's perspective — what convinces you? what falls flat? what's missing?",
          roles: [
            {
              id: "skeptic",
              label: "the fiscal skeptic",
              info: "you believe government wastes money. you want hard numbers, ROI, and proof that this isn't just feel-good spending. you respect data and distrust emotion.",
              question: "what specific claim or evidence in this text would make you pause and reconsider?",
            },
            {
              id: "parent",
              label: "the working parent",
              info: "you rely on the library for free children's programs, wifi, and a safe after-school space. your concern is practical: what would your family lose? you respond to stories more than statistics.",
              question: "does this text speak to your lived experience? what's missing from your reality?",
            },
            {
              id: "entrepreneur",
              label: "the small business owner",
              info: "you see the library as competition for bookstores and cafes, but also as a space where people learn skills. you think in terms of economic ecosystem and market dynamics.",
              question: "does this argument account for the economic complexity you see? what angle would win you over?",
            },
            {
              id: "student",
              label: "the college student",
              info: "you use the library for research, study space, and digital resources you can't afford. you're idealistic but also drowning in debt. you respond to arguments about access and equity.",
              question: "does this text acknowledge the gap between those who can afford information and those who can't?",
            },
          ],
          discussionPrompt:
            "whose reaction surprised the writer most? what does it reveal about the gap between intended message and received meaning?",
          revealPrompt:
            "wayne booth called this 'the rhetoric of fiction' — every text implies a reader, and the real reader is never quite the one the writer imagined. the gap between intended and actual audience is where persuasion fails or transforms.",
        },
      },
      mechanic: {
        interactionModel: "negotiation",
        socialStructure: "asymmetric",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "poll",
      phase: "integration",
      label: "vote: most surprising reaction",
      discussionPrompt: "the writer assumed one audience but there were four. which gap between intended and received meaning was widest? that gap is where persuasion fails in the real world",
      timeLimit: 60,
      config: {
        type: "poll",
        poll: {
          question:
            "which reader's reaction was most surprising or challenging to the original writer's intent?",
          options: [
            { id: "skeptic", label: "the fiscal skeptic" },
            { id: "parent", label: "the working parent" },
            { id: "entrepreneur", label: "the small business owner" },
            { id: "student", label: "the college student" },
          ],
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "audience",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: writing and audience",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "every piece of writing carries an imagined reader — a ghost audience the writer performs for, consciously or not. toni morrison said she wrote for black women first, and everyone else was welcome to listen. who is the ghost reader in your own writing? how would your work change if you deliberately shifted who you were writing to?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "real-time",
      },
    },
  ];
}

// ── draft.loop ──────────────────────────────────────────────────
// rearrange → reveal → refine | paced
// structural x-ray, find the buried thesis

export function draftLoop(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: revision",
      timeLimit: 45,
      config: {
        type: "prediction",
        prediction: {
          question:
            "studies of professional writers' revision habits show that experienced writers spend what percentage of their total writing time on revision (compared to first-draft generation)?",
          type: "number",
          answer: 65,
          unit: "percent",
        },
      },
      hints: [
        "hemingway rewrote the ending of 'a farewell to arms' 47 times",
        "most student writers spend far less time revising than professionals do",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: argument structure",
      discussionPrompt: "the 'turn' paragraph is where most people stumble — it's the thesis but it appears after the counterargument. who put it earlier? what does that say about when insight arrives in real writing?",
      timeLimit: 180,
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "these six paragraphs form an argument, but they've been shuffled. arrange them into the strongest possible order. think about the classical oration structure: exordium (hook), narratio (background), confirmatio (evidence), refutatio (counterargument), peroratio (conclusion). where does each piece belong?",
          pieces: [
            {
              id: "hook",
              content: "when the last bookstore in a small town closes, something invisible breaks. the town doesn't notice right away — it takes a generation to feel the full weight of the silence.",
              hint: "this grabs attention and establishes stakes",
            },
            {
              id: "context",
              content: "over the past decade, independent bookstores have declined by 40% in communities under 50,000 people. the causes are familiar: online retail, rising rents, shifting habits. but the effects are less obvious than empty storefronts.",
              hint: "this provides background data and frames the problem",
            },
            {
              id: "evidence",
              content: "research from the national endowment for the arts shows that communities with active literary gathering spaces report 23% higher civic participation rates. the bookstore isn't just a shop — it's infrastructure for public life.",
              hint: "this is the strongest supporting evidence",
            },
            {
              id: "counter",
              content: "critics argue that online platforms provide wider selection at lower cost, and that nostalgia shouldn't drive economic policy. they're not wrong about selection. but they're measuring the wrong thing.",
              hint: "this acknowledges and redirects the opposing view",
            },
            {
              id: "turn",
              content: "what a bookstore provides that no algorithm can replicate is the accident of discovery — the book you didn't know you needed, recommended by someone who read your face, not your browsing history.",
              hint: "this is the pivotal insight, the thesis revealed",
            },
            {
              id: "close",
              content: "the question isn't whether we can buy books without bookstores. we can. the question is whether we can sustain the kind of community that produces readers, thinkers, and citizens without the spaces that gather them.",
              hint: "this lands the argument and echoes the opening",
            },
          ],
          solution: ["hook", "context", "evidence", "counter", "turn", "close"],
          revealOrder: true,
        },
      },
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "sort: writing elements",
      discussionPrompt: "the analogy ('town without a bookstore is like a body without a nervous system') — is that evidence or rhetoric? where's the line between persuasion and proof?",
      timeLimit: 120,
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each excerpt by its rhetorical function. every sentence in an argument does a job — what job is each one doing?",
          cards: [
            {
              id: "claim",
              content: "bookstores are essential civic infrastructure, not luxury retail.",
              hint: "this is asserting a position",
            },
            {
              id: "evidence-card",
              content: "communities with literary spaces show 23% higher civic participation.",
              hint: "this is supporting with data",
            },
            {
              id: "counter-card",
              content: "online platforms do offer wider selection at lower prices — that's undeniable.",
              hint: "this is engaging with opposition",
            },
            {
              id: "transition",
              content: "but measuring selection misses the point entirely.",
              hint: "this is pivoting the argument's direction",
            },
            {
              id: "analogy",
              content: "a town without a bookstore is like a body without a nervous system — it still functions, but it can't feel.",
              hint: "this is making abstract concrete",
            },
            {
              id: "call",
              content: "if we want communities that think, we need to fund the spaces where thinking happens.",
              hint: "this is demanding action",
            },
          ],
          categories: [
            { id: "thesis", label: "thesis / claim", description: "states the argument's central position" },
            { id: "support", label: "evidence / support", description: "provides proof or illustration" },
            { id: "counter-cat", label: "counterargument / pivot", description: "engages with opposing views" },
            { id: "rhetoric", label: "rhetorical move", description: "persuades through technique rather than content" },
          ],
          solution: {
            claim: "thesis",
            "evidence-card": "support",
            "counter-card": "counter-cat",
            transition: "counter-cat",
            analogy: "rhetoric",
            call: "rhetoric",
          },
        },
      },
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "open-response",
      phase: "integration",
      label: "rewrite: sharpen the thesis",
      timeLimit: 180,
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "here's a weak thesis: 'bookstores are important and we should support them.' rewrite it into a sharp, arguable, specific thesis statement. a strong thesis, as joseph williams wrote in 'style: lessons in clarity and grace,' should be specific enough to disagree with. make someone want to argue back.",
          responseType: "text",
          anonymous: false,
        },
      },
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: drafting vs revising",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "anne lamott's advice to write 'shitty first drafts' has become gospel, but few writers talk about the equally important skill of structural revision — the ability to see your own work as a reader sees it. what's the difference between editing sentences and revising structure? think about a piece of your own writing. where might the real thesis be buried — not in the introduction where you put it, but somewhere in the middle where you finally figured out what you were actually trying to say?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "paced",
      },
    },
  ];
}

// ── genre.shift ─────────────────────────────────────────────────
// constrain → transform → compare | time-pressure
// mad libs meets rhetoric, genre conventions

export function genreShift(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: genre recognition",
      timeLimit: 45,
      config: {
        type: "prediction",
        prediction: {
          question:
            "how many words does it typically take for a reader to identify a genre (romance, thriller, academic paper, etc.) from a cold start?",
          type: "number",
          answer: 50,
          unit: "words",
        },
      },
      hints: [
        "genre signals are embedded in vocabulary, sentence structure, and pacing",
        "think about how quickly you know if something is a news article versus a poem",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "struggle",
      label: "transform: genre rewrite",
      timeLimit: 240,
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "here is a plain fact: 'the earth's average surface temperature has risen by approximately 1.1 degrees celsius since the pre-industrial era, primarily due to human activities.' each of you must rewrite this single fact in a completely different genre. commit fully to the conventions — voice, structure, vocabulary, emotional register.",
          roles: [
            {
              id: "noir",
              label: "hardboiled detective fiction",
              info: "write it like raymond chandler or dashiell hammett. short sentences. cynical narrator. metaphors drawn from the street. the temperature rise is a case that landed on your desk. 'the planet had a fever, and nobody was paying the doctor.'",
              question: "what did the noir voice let you say about climate change that factual language couldn't?",
            },
            {
              id: "fairy",
              label: "fairy tale / fable",
              info: "write it like the brothers grimm or ursula k. le guin's earthsea. once upon a time, a world grew warmer. use archetypes: the warning ignored, the curse, the quest. think about how oral traditions encoded ecological knowledge in story.",
              question: "how did the fairy tale form change who feels responsible — and who feels like the hero?",
            },
            {
              id: "academic",
              label: "academic abstract",
              info: "write it as the opening of a peer-reviewed paper. passive voice, hedging language, citations (invent them). 'this study examines...' think about how academic conventions create authority but also distance. who is included in this audience and who is excluded?",
              question: "did the academic register make the fact feel more or less urgent? why?",
            },
            {
              id: "poetry",
              label: "lyric poem",
              info: "write it as a poem — free verse or structured, your choice. think about how claudia rankine's 'citizen' or ross gay's 'catalog of unabashed gratitude' use poetic form to make political facts visceral. break lines intentionally. let white space carry meaning.",
              question: "what did the poem reveal about this fact that prose couldn't reach?",
            },
          ],
          discussionPrompt:
            "read all four versions aloud. the same fact, four genres, four completely different emotional and intellectual effects. which version would change the most minds? which would change the right minds?",
          revealPrompt:
            "mikhail bakhtin argued that every genre carries an ideology — a built-in way of seeing the world. the genre doesn't just deliver content, it shapes what content is possible.",
        },
      },
      mechanic: {
        interactionModel: "construction",
        socialStructure: "asymmetric",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "sort: genre conventions",
      discussionPrompt: "dialect in 'journalism' not 'fiction' — did that surprise anyone? journalistic voice varies hugely by outlet. what conventions signal 'this is trustworthy' vs 'this is literary'?",
      timeLimit: 120,
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each writing convention by the genre it most strongly belongs to. some may feel like they could fit multiple places — choose the genre where the convention is most essential, not just present.",
          cards: [
            { id: "passive", content: "passive voice and hedging ('it has been observed that...')", hint: "creates objectivity and distance" },
            { id: "cliffhanger", content: "chapter-ending cliffhangers", hint: "propels the reader forward urgently" },
            { id: "imagery", content: "extended sensory imagery and metaphor", hint: "makes the abstract visceral" },
            { id: "citation", content: "in-text citations and footnotes", hint: "builds credibility through reference" },
            { id: "dialect", content: "dialect and vernacular voice", hint: "establishes character and place" },
            { id: "inverted-pyramid", content: "most important information first, details later", hint: "respects the reader's time and scanning" },
            { id: "unreliable", content: "unreliable narrator with hidden motives", hint: "creates dramatic irony" },
            { id: "repetition", content: "rhythmic repetition and refrain", hint: "creates incantation and emphasis" },
          ],
          categories: [
            { id: "academic-cat", label: "academic writing", description: "research papers, dissertations, journals" },
            { id: "fiction", label: "literary fiction", description: "novels, short stories, creative nonfiction" },
            { id: "journalism", label: "journalism", description: "news, features, investigative reporting" },
            { id: "poetry-cat", label: "poetry", description: "verse, spoken word, lyric essay" },
          ],
          solution: {
            passive: "academic-cat",
            citation: "academic-cat",
            cliffhanger: "fiction",
            unreliable: "fiction",
            "inverted-pyramid": "journalism",
            dialect: "journalism",
            imagery: "poetry-cat",
            repetition: "poetry-cat",
          },
        },
      },
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "poll",
      phase: "integration",
      label: "vote: most effective transformation",
      discussionPrompt: "if the poem won — why does poetic form make a scientific fact feel more urgent? if the noir won — what does cynicism do that sincerity can't?",
      timeLimit: 60,
      config: {
        type: "poll",
        poll: {
          question:
            "which genre transformation was most effective at making the climate fact feel urgent and real?",
          options: [
            { id: "noir", label: "hardboiled detective fiction" },
            { id: "fairy", label: "fairy tale / fable" },
            { id: "academic", label: "academic abstract" },
            { id: "poetry", label: "lyric poem" },
          ],
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "audience",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: genre shapes meaning",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "the medium is the message, mcluhan said — but genre is also a message. when you choose to write something as an email versus a memo, a tweet versus an essay, a story versus a report, you're not just changing the packaging. you're changing what can be thought and felt. think about something you've written recently (or need to write). what genre did you default to? what would happen if you wrote it in a completely different form?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "timed",
      },
    },
  ];
}
