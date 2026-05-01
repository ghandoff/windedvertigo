import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── mirror.maze ─────────────────────────────────────────────────
// see -> compare -> reconcile | paced
// asymmetric perception co-op — social cognition

export function mirrorMaze(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "in 1999, simons & chabris showed participants a video of people passing a basketball and asked them to count passes. what percentage of participants failed to notice a gorilla walking through the scene?",
          type: "number",
          answer: 50,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: inattentional blindness",
      discussionPrompt: "50% miss a gorilla — and most people guess much lower. what does your own guess reveal about your confidence in your own attention?",
      timeLimit: 45_000,
      hints: [
        "the study is often called 'the invisible gorilla'",
        "it's higher than most people guess",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "asymmetric",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "a person sits alone at a crowded cafe, staring at their phone with a slight frown. their coffee is untouched and getting cold. there's an open notebook beside them with a few crossed-out lines.",
          roles: [
            {
              id: "empathizer",
              label: "empathizer",
              info: "you practice perspective-taking as described by batson's empathy-altruism hypothesis (1991). your job is to imagine what this person is feeling by simulating their emotional state. research shows empathic accuracy averages only 20-35% even among close friends (ickes, 1997). focus on emotional cues: the frown, the untouched coffee, the body language.",
              question:
                "what do you think this person is feeling, and what evidence from the scene supports your interpretation?",
            },
            {
              id: "mentalizer",
              label: "mentalizer",
              info: "you use theory of mind — the capacity to attribute mental states to others (premack & woodruff, 1978). rather than feeling what they feel, you reason about their beliefs, desires, and intentions. brain imaging shows mentalizing activates the temporo-parietal junction, distinct from emotional empathy circuits (saxe & kanwisher, 2003). focus on what this person might be thinking or planning.",
              question:
                "what do you think this person is thinking about, and what are their likely intentions?",
            },
            {
              id: "behaviorist",
              label: "behaviorist",
              info: "you observe only what is directly measurable, following skinner's radical behaviorism — internal states are irrelevant to explanation. you catalog observable behaviors without inferring mental states. research on thin-slice judgments (ambady & rosenthal, 1993) shows people form impressions in seconds, but those impressions often say more about the observer than the observed.",
              question:
                "describe only observable behaviors. what can you verify without any interpretation?",
            },
            {
              id: "narrator",
              label: "narrator",
              info: "you construct a story. bruner (1991) argued that narrative is a fundamental mode of knowing — we don't just observe the world, we story it. your interpretation will reveal the schemas and scripts you carry (schank & abelson, 1977). the story you tell about this stranger says as much about your life as theirs.",
              question:
                "tell the story of how this person ended up here. what happened before this moment, and what happens next?",
            },
          ],
          discussionPrompt:
            "share your interpretations. notice: you were all looking at the same scene. where do your readings converge and diverge? what does that tell you about the act of perception itself?",
          revealPrompt:
            "there is no correct answer. the scene was deliberately ambiguous. your interpretations are projections — revealing your own cognitive style, life experience, and habitual explanatory frameworks.",
        },
      },
      phase: "struggle",
      label: "perceive: four lenses on one scene",
      timeLimit: 240_000,
      hints: [
        "there is no wrong answer — that's the point",
        "pay attention to what you assumed vs. what you observed",
      ],
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "asymmetric",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "poll",
      config: {
        type: "poll",
        poll: {
          question:
            "after hearing all four interpretations, which approach felt most 'accurate' to you — and be honest about why",
          options: [
            { id: "empathizer", label: "empathizer — felt most human" },
            { id: "mentalizer", label: "mentalizer — most logically coherent" },
            {
              id: "behaviorist",
              label: "behaviorist — most honest about limits",
            },
            { id: "narrator", label: "narrator — most complete picture" },
          ],
        },
      },
      phase: "threshold",
      label: "vote: whose perception wins?",
      discussionPrompt: "the behaviorist usually gets the fewest votes — 'most honest about limits' doesn't feel satisfying. why do we prefer a compelling story over an accurate but incomplete observation?",
      timeLimit: 45_000,
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "place a pin where you fall. the x-axis is how you see yourself; the y-axis is how you think others see you. the gap between the two is what cooley (1902) called the 'looking-glass self' — we become what we think others think we are.",
          width: 600,
          height: 600,
          xLabel: "self-perception",
          yLabel: "perceived by others",
          xLow: "cold & analytical",
          xHigh: "warm & intuitive",
          yLow: "cold & analytical",
          yHigh: "warm & intuitive",
          zones: [
            {
              id: "aligned",
              label: "aligned self",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "hidden",
              label: "hidden self (johari blind spot)",
              x: 300,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "performed",
              label: "performed self (goffman)",
              x: 0,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "unknown",
              label: "unknown self",
              x: 300,
              y: 300,
              width: 300,
              height: 300,
            },
          ],
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: self vs. mirror",
      timeLimit: 120_000,
      discussionPrompt:
        "do most pins fall along the diagonal (self-perception matches perceived-by-others), or is there a gap? what does the cluster pattern reveal about the looking-glass self?",
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "kenny (1994) showed that we are systematically wrong about how others perceive us — and that this error is asymmetric: we overestimate negative judgments and underestimate positive ones. after this session, what did you learn about the gap between how you see and how you are seen? where in your daily life might you be projecting rather than perceiving?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the projection gap",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── anchor.drift ────────────────────────────────────────────────
// guess -> compare -> cringe | time-pressure
// live game show — anchoring bias and social comparison

export function anchorDrift(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "tversky & kahneman (1974) spun a rigged wheel landing on either 10 or 65, then asked participants to estimate the percentage of african countries in the UN. the group who saw 65 guessed 45%. what did the group who saw 10 guess?",
          type: "number",
          answer: 25,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: the original anchor",
      discussionPrompt: "a random wheel number shifted estimates by 20 points — and participants knew it was random. what does that say about the power of arbitrary first numbers in negotiations?",
      timeLimit: 45_000,
      hints: [
        "the wheel number was completely random — it shouldn't have mattered at all",
        "the difference between groups was roughly 20 percentage points",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "poll",
      config: {
        type: "poll",
        poll: {
          question:
            "rapid fire: the random anchor number is 4,200. how many books are in the library of congress?",
          options: [
            { id: "low", label: "fewer than 10 million" },
            { id: "mid-low", label: "10-20 million" },
            { id: "mid-high", label: "20-40 million" },
            { id: "high", label: "more than 40 million" },
          ],
        },
      },
      phase: "struggle",
      label: "estimate: anchored guessing",
      discussionPrompt: "the anchor was 4,200 and the real answer is 17 million. did the low anchor pull anyone toward 'fewer than 10 million'? raise your hand if you felt the pull",
      timeLimit: 15_000,
      hints: [
        "the real answer is about 17 million cataloged books and 170 million total items",
        "notice whether 4,200 pulled your estimate lower than it should be",
      ],
      mechanic: {
        interactionModel: "competition",
        socialStructure: "anonymous",
        tempo: "rapid-fire",
      },
    },
    {
      id: uid(),
      type: "sorting",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort these cognitive biases into their families. each bias distorts judgment differently — some warp what comes to mind, others warp how we weigh evidence, others warp how we see ourselves.",
          cards: [
            {
              id: "anchoring",
              content: "anchoring — over-relying on the first piece of information encountered",
              hint: "tversky & kahneman's wheel experiment",
            },
            {
              id: "availability",
              content: "availability heuristic — judging probability by how easily examples come to mind",
              hint: "after seeing news about plane crashes, people overestimate flight danger",
            },
            {
              id: "representativeness",
              content: "representativeness — judging probability by similarity to a stereotype",
              hint: "the 'linda problem' — linda is a bank teller vs. feminist bank teller",
            },
            {
              id: "confirmation",
              content: "confirmation bias — seeking evidence that confirms existing beliefs",
              hint: "wason's 2-4-6 task: people test their hypothesis but never try to falsify it",
            },
            {
              id: "dunning-kruger",
              content: "dunning-kruger effect — the least competent overestimate their ability the most",
              hint: "kruger & dunning (1999) found bottom-quartile performers estimated themselves at the 62nd percentile",
            },
            {
              id: "halo",
              content: "halo effect — one positive trait colors judgment of unrelated traits",
              hint: "thorndike (1920) found military officers rated soldiers as uniformly good or bad across all traits",
            },
            {
              id: "sunk-cost",
              content: "sunk cost fallacy — continuing because of past investment rather than future value",
              hint: "the concorde: britain and france kept funding it despite knowing it would never be profitable",
            },
            {
              id: "framing",
              content: "framing effect — decisions change based on how options are presented",
              hint: "'90% survival rate' vs. '10% mortality rate' — same data, different choices",
            },
          ],
          categories: [
            {
              id: "retrieval",
              label: "retrieval biases",
              description: "distort what information comes to mind",
            },
            {
              id: "evaluation",
              label: "evaluation biases",
              description: "distort how we weigh evidence and make judgments",
            },
            {
              id: "self",
              label: "self-perception biases",
              description: "distort how we see ourselves and our decisions",
            },
          ],
          solution: {
            anchoring: "evaluation",
            availability: "retrieval",
            representativeness: "evaluation",
            confirmation: "evaluation",
            "dunning-kruger": "self",
            halo: "evaluation",
            "sunk-cost": "self",
            framing: "retrieval",
          },
        },
      },
      phase: "threshold",
      label: "sort: the bias taxonomy",
      discussionPrompt: "framing as 'retrieval' surprises people — it's about which version of information comes to mind first, not about evaluating it. which categorization sparked the most debate?",
      timeLimit: 180_000,
      hints: [
        "retrieval biases affect what comes to mind first",
        "self-perception biases specifically distort how you evaluate yourself or your past choices",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "place a pin representing your experience during the anchored guessing round. how confident were you vs. how accurate were you? research by lichtenstein & fischhoff (1977) showed confidence and accuracy are often inversely correlated — the most confident people are frequently the most wrong.",
          width: 600,
          height: 600,
          xLabel: "confidence (low <-> high)",
          yLabel: "accuracy (low <-> high)",
          zones: [
            {
              id: "calibrated",
              label: "well-calibrated",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "overconfident",
              label: "overconfident (most common)",
              x: 300,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "underconfident",
              label: "underconfident",
              x: 0,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "lucky",
              label: "lucky and knew it",
              x: 300,
              y: 300,
              width: 300,
              height: 300,
            },
          ],
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: confidence vs. accuracy",
      timeLimit: 120_000,
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "anchoring doesn't just happen in labs. salary negotiations, real estate pricing, first impressions — ariely (2008) showed that even arbitrary anchors (the last two digits of your social security number) influence how much people will pay for wine. think about a recent decision you made. where was the anchor? who set it? and did you adjust away from it enough — or did you just drift?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: anchors in the wild",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── story.self ──────────────────────────────────────────────────
// draft -> arrange -> defend | turn-based
// card-game narrative identity — event card drafting

export function storySelf(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "mcadams (2001) found that people construct 'narrative identities' — internalized life stories that give meaning to experience. research shows that people who frame their life stories as 'redemption sequences' (bad events leading to good outcomes) report higher well-being than those who use 'contamination sequences' (good events turning bad). what percentage of american adults use predominantly redemption narratives?",
          type: "number",
          answer: 63,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: redemption vs. contamination",
      discussionPrompt: "63% use redemption narratives in the US — but this varies hugely across cultures. does your own default narrative feel chosen or inherited from your culture?",
      timeLimit: 60_000,
      hints: [
        "american culture heavily favors redemption narratives — 'what doesn't kill you makes you stronger'",
        "this number varies significantly across cultures",
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
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "these are moments from a single (fictional) person's life, presented out of order. arrange them into a coherent life narrative. but here's the catch — there is no single correct order. the sequence you choose reveals your own narrative schema: do you arrange by chronology? by emotional arc? by cause and effect? habermas & bluck (2000) showed that the ability to construct a coherent life narrative doesn't emerge until adolescence, and the way we sequence events changes throughout our lives.",
          pieces: [
            {
              id: "move",
              content: "moved to a new city where they knew no one",
              hint: "could be an escape, an adventure, or a fresh start — depending on where you place it",
            },
            {
              id: "loss",
              content: "lost someone close to them unexpectedly",
              hint: "does this come before or after the turning point?",
            },
            {
              id: "discovery",
              content: "discovered a passion that changed everything",
              hint: "is this the cause of change, or the result of it?",
            },
            {
              id: "failure",
              content: "failed publicly at something they cared about",
              hint: "failure can be a beginning or an ending",
            },
            {
              id: "connection",
              content: "formed a deep connection with an unlikely person",
              hint: "relationships often mark chapter boundaries",
            },
            {
              id: "choice",
              content: "made a choice that couldn't be undone",
              hint: "irreversibility is what makes a choice meaningful",
            },
          ],
          solution: ["loss", "move", "failure", "connection", "discovery", "choice"],
          revealOrder: false,
        },
      },
      phase: "struggle",
      label: "arrange: a life in six moments",
      timeLimit: 180_000,
      hints: [
        "there is no wrong order — your sequence is your interpretation",
        "notice whether you built a redemption arc or a contamination arc",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "asymmetric",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "you all arranged the same six life events. now each of you will interpret them through a different lens of narrative psychology.",
          roles: [
            {
              id: "redemptionist",
              label: "redemption narrator",
              info: "mcadams (2006) defines redemption sequences as narratives where negative events lead to positive outcomes. this is the dominant narrative form in american culture — the comeback story, the lesson learned, the phoenix from ashes. you see the failure and loss as necessary precursors to growth. research shows redemption narrators score higher on generativity (concern for future generations) and psychological well-being.",
              question:
                "retell this life story as a redemption narrative. where does suffering become meaningful? what was gained through loss?",
            },
            {
              id: "contaminator",
              label: "contamination narrator",
              info: "contamination sequences are the inverse: good events are spoiled or undermined by what follows. mcadams found these are more common in people experiencing depression, but they're also more realistic in many ways — not everything works out. in many non-western cultures, contamination narratives are not pathologized but seen as mature recognition of impermanence. you see the connections and discoveries as fragile things that will be tested or lost.",
              question:
                "retell this story as a contamination sequence. where do good things become fragile? what casts a shadow forward?",
            },
            {
              id: "absurdist",
              label: "absurdist narrator",
              info: "camus argued that the search for meaning in a meaningless universe is the fundamental human tension. frankl (1946) countered that meaning can be found even in suffering — but only if you choose it. the absurdist narrator doesn't impose arc or pattern. these events happened. they don't build toward anything. the absurd is not despair — it's freedom from the tyranny of narrative coherence.",
              question:
                "retell this story without imposing a pattern. resist the urge to connect cause to effect. what happens when you let events just be?",
            },
          ],
          discussionPrompt:
            "you had the same raw material but built different stories. which version felt most true? which felt most useful? are those the same thing?",
          revealPrompt:
            "the events were deliberately archetypal — loss, failure, connection, discovery. your narrative choices reveal which story you're currently telling about your own life.",
        },
      },
      phase: "threshold",
      label: "interpret: three readings of one life",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "negotiation",
        socialStructure: "asymmetric",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "open-response",
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "write the six-word memoir of this fictional person's life. hemingway supposedly wrote: 'for sale: baby shoes, never worn.' smith magazine collected thousands of these. in six words, you must choose what matters — and that choice is the narrative act.",
          responseType: "text",
          anonymous: false,
        },
      },
      phase: "integration",
      label: "craft: the six-word life",
      discussionPrompt: "read a few aloud without naming authors — which memoirs are redemption arcs and which are contamination sequences? the word choice reveals the narrator's framework",
      timeLimit: 120_000,
      mechanic: {
        interactionModel: "performance",
        socialStructure: "audience",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "adler (2012) found that people who revise their life narratives in therapy — literally re-storying their past — show measurable improvements in well-being, even when the facts don't change. the events of your life are fixed. the story is not. what narrative are you currently telling about your own life? is it serving you? and if you could re-sequence your own six moments, which event would you move?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: re-storying the self",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── bias.lens ───────────────────────────────────────────────────
// choose -> reveal -> reflect | paced
// scenario choices reveal hidden biases — implicit cognition

export function biasLens(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "the implicit association test (IAT), developed by greenwald, mcghee & schwartz (1998), measures automatic associations between concepts. project implicit has collected over 30 million tests. what percentage of white americans show an implicit preference for white faces over black faces on the race IAT?",
          type: "number",
          answer: 75,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: the implicit gap",
      timeLimit: 60_000,
      hints: [
        "the majority of test-takers show some implicit preference",
        "this includes many people who explicitly report egalitarian beliefs",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "poll",
      config: {
        type: "poll",
        poll: {
          question:
            "you're hiring for a senior role. two equally qualified candidates. alex has a traditional career path — elite university, Fortune 500 experience, linear progression. jordan has a nontraditional path — community college, started a failed company, career gaps, diverse roles. gut reaction — who do you call back first?",
          options: [
            { id: "alex", label: "alex — the proven track record" },
            { id: "jordan", label: "jordan — the unconventional path" },
            { id: "both", label: "both equally — no preference" },
            { id: "more-info", label: "i need more information" },
          ],
        },
      },
      phase: "struggle",
      label: "choose: the hiring gut-check",
      discussionPrompt: "show the results — if 'alex' dominated, ask what 'equally qualified' actually meant to people. the nontraditional path triggers status quo bias even when we know better",
      timeLimit: 30_000,
      hints: [
        "there is no right answer — but there is a revealing one",
        "notice what 'equally qualified' means to you",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "sorting",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort these biases by their mechanism. some operate through how we process social information (cognitive), some through group membership and identity (social), and some through motivated reasoning to protect existing beliefs (confirmatory).",
          cards: [
            {
              id: "status-quo",
              content: "status quo bias — preference for the current state of affairs",
              hint: "samuelson & zeckhauser (1988) showed people disproportionately choose the default option",
            },
            {
              id: "ingroup",
              content: "in-group favoritism — preferring members of your own group",
              hint: "tajfel's minimal group paradigm showed this emerges even with arbitrary group assignments",
            },
            {
              id: "fundamental-attribution",
              content: "fundamental attribution error — explaining others' behavior as character, your own as situation",
              hint: "ross (1977): 'he failed because he's lazy' vs. 'i failed because the test was unfair'",
            },
            {
              id: "just-world",
              content: "just-world hypothesis — believing people get what they deserve",
              hint: "lerner (1980) showed this leads to blaming victims of random misfortune",
            },
            {
              id: "backfire",
              content: "backfire effect — corrective information strengthens the original false belief",
              hint: "nyhan & reifler (2010) showed corrections can backfire when they threaten identity",
            },
            {
              id: "horn",
              content: "horn effect — one negative trait colors perception of all traits",
              hint: "the reverse of the halo effect — a single flaw contaminates the whole impression",
            },
            {
              id: "naive-realism",
              content: "naive realism — believing you see reality objectively while others are biased",
              hint: "ross & ward (1996): 'i see the world as it is; you see it through a lens'",
            },
            {
              id: "system-justification",
              content: "system justification — defending existing social arrangements even when they disadvantage you",
              hint: "jost & banaji (1994) found that low-status groups sometimes internalize their own inferiority",
            },
          ],
          categories: [
            {
              id: "cognitive",
              label: "cognitive biases",
              description: "distortions in how we process and interpret information",
            },
            {
              id: "social",
              label: "social biases",
              description: "distortions driven by group identity and interpersonal perception",
            },
            {
              id: "confirmatory",
              label: "confirmatory biases",
              description: "distortions that protect existing beliefs and systems",
            },
          ],
          solution: {
            "status-quo": "confirmatory",
            ingroup: "social",
            "fundamental-attribution": "cognitive",
            "just-world": "confirmatory",
            backfire: "confirmatory",
            horn: "cognitive",
            "naive-realism": "social",
            "system-justification": "social",
          },
        },
      },
      phase: "threshold",
      label: "sort: bias families",
      discussionPrompt: "naive realism as a 'social' bias surprises people — it's about believing your view is objective while others are biased. who felt personally called out?",
      timeLimit: 180_000,
      hints: [
        "cognitive biases are about information processing errors",
        "confirmatory biases specifically protect the status quo or existing beliefs",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "pronin, lin & ross (2002) found the 'bias blind spot' — people readily identify biases in others but not in themselves. on average, people rate themselves as less biased than 85% of their peers. place yourself honestly: how aware are you of your biases vs. how much do your biases actually affect your decisions?",
          width: 600,
          height: 600,
          xLabel: "bias awareness (unaware <-> highly aware)",
          yLabel: "bias influence on decisions (minimal <-> pervasive)",
          zones: [
            {
              id: "blind",
              label: "blind spot (unaware + high influence)",
              x: 0,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "vigilant",
              label: "vigilant (aware + high influence)",
              x: 300,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "naive",
              label: "naive optimist (unaware + low influence)",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "calibrated",
              label: "calibrated (aware + managed)",
              x: 300,
              y: 0,
              width: 300,
              height: 300,
            },
          ],
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: the blind spot",
      timeLimit: 120_000,
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "here's the uncomfortable finding: knowing about biases doesn't reliably reduce them. lilienfeld, ammirati & landfield (2009) found that bias training often increases awareness without changing behavior — and can even backfire by making people feel they've 'dealt with it.' the gap between intention and action is where bias lives. think about the hiring scenario earlier. what was your gut reaction, and what does it reveal about the gap between who you want to be and how you actually decide?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: intention vs. action",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── pale.blue ──────────────────────────────────────────────────
// perceive → dissolve → carry | paced
// the overview effect — altitude as cognitive threshold crossing

export function paleBlue(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "astronauts report a profound cognitive shift when first seeing earth from space. frank white named it the 'overview effect' in 1987. of the ~680 people who have been to space, roughly what percentage report experiencing it?",
          type: "number",
          answer: 90,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: who feels the shift",
      timeLimit: 60_000,
      discussionPrompt:
        "nearly everyone who goes to space reports the effect — the near-unanimity is itself remarkable. what does it mean that a single visual experience can rewrite a worldview in seconds?",
      hints: [
        "it's much higher than most people guess",
        "the effect is reported across nationalities, missions, and eras",
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
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "the ISS cupola window. you've been in orbit for 3 days. mission control says 'look out now — you're passing over your hometown.' you look down.",
          roles: [
            {
              id: "astronaut",
              label: "the astronaut",
              info: "you see your city from 400 km up. you can cover it with your thumb. your family is under that thumb. you feel your chest tighten — not from fear but from an emotion you don't have a word for. the borders between countries are invisible. the atmosphere is a tissue-thin blue line. you realize in your bones that everything you've ever known — every war, every love story, every city — exists in that fragile shell. describe what's happening to you right now.",
              question:
                "what is the physical sensation? where does it hit you?",
            },
            {
              id: "philosopher",
              label: "the philosopher",
              info: "you're reading real astronaut testimony. edgar mitchell (apollo 14) said: 'you develop an instant global consciousness, a people orientation, an intense dissatisfaction with the state of the world, and a compulsion to do something about it.' ron garan called the thin atmosphere 'the orbital perspective' and said it made borders look absurd. describe how seeing earth as a single system — not as nations — changes what 'home' means.",
              question:
                "if everyone could see this view, what political concept would become hardest to defend?",
            },
            {
              id: "poet",
              label: "the poet",
              info: "you're writing the entry in your crew journal that night. you've been trained in science and engineering. nothing in your training prepared you for this. the earth doesn't care about your mission objectives. it just glows. the sunrise takes 45 seconds and paints the atmosphere in colors you've never seen. you see 16 sunrises a day. each one rewrites something in you. write the journal entry.",
              question:
                "what word are you looking for that doesn't exist yet?",
            },
          ],
          discussionPrompt:
            "the astronaut felt it in the body. the philosopher understood it in the mind. the poet tried to capture it in language. which dimension would hit you hardest — and what's lost when we can only share the view through a screen?",
          revealPrompt:
            "all three are valid entry points to the same shift. the overview effect isn't just visual — it's somatic, cognitive, and linguistic simultaneously. that's what makes it a threshold crossing.",
        },
      },
      phase: "struggle",
      label: "inhabit: three windows on one earth",
      timeLimit: 300_000,
      hints: [
        "there is no wrong answer — the roles are lenses, not limits",
        "astronauts consistently report the experience as 'beyond words'",
        "pay attention to what your role makes visible and invisible",
      ],
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "asymmetric",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "map how the overview effect shifts priorities. place pins for concerns that move when you see earth from space. where does each concern sit BEFORE the shift, and where does it land AFTER? use the canvas to trace the migration.",
          width: 800,
          height: 600,
          xLow: "local / personal",
          xHigh: "global / planetary",
          yLow: "abstract idea",
          yHigh: "felt urgency",
          zones: [
            {
              id: "unchanged",
              label: "remains unchanged",
              x: 0,
              y: 0,
              width: 300,
              height: 250,
            },
            {
              id: "amplified",
              label: "becomes urgent",
              x: 500,
              y: 350,
              width: 300,
              height: 250,
            },
            {
              id: "dissolved",
              label: "dissolves entirely",
              x: 0,
              y: 400,
              width: 300,
              height: 200,
            },
          ],
          multiPin: true,
          minPins: 3,
          pinCategories: [
            { id: "before", label: "before the shift", color: "#94a3b8" },
            { id: "after", label: "after the shift", color: "#3b82f6" },
          ],
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: what moves when you zoom out",
      timeLimit: 180_000,
      discussionPrompt:
        "look at the group's map. what moved the most? what stayed still? is there anything that moved in a direction that surprised you?",
      hints: [
        "think about national identity, climate, daily routines, family",
        "some things might become MORE local after the shift, not less",
        "use the note field to name what each pin represents",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "sorting",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort these real astronaut quotes by the dimension of the overview effect they express.",
          cards: [
            {
              id: "shepard",
              content:
                "\"when I looked at the earth from space, I cried\" — alan shepard",
            },
            {
              id: "sagan",
              content:
                "\"the earth is a very small stage in a vast cosmic arena\" — carl sagan",
            },
            {
              id: "mitchell",
              content:
                "\"you develop an instant global consciousness\" — edgar mitchell",
            },
            {
              id: "hadfield",
              content:
                "\"borders are invisible from up here\" — chris hadfield",
            },
            {
              id: "garan-thin",
              content:
                "\"the atmosphere is paper thin — frighteningly thin\" — ron garan",
            },
            {
              id: "garan-return",
              content:
                "\"I left earth a fighter pilot. I returned a humanitarian\" — ron garan",
            },
            {
              id: "schweickart",
              content:
                "\"we are all riding on a spaceship together\" — rusty schweickart",
            },
            {
              id: "jemison",
              content:
                "\"the most beautiful thing I've ever seen and the most terrifying\" — mae jemison",
            },
          ],
          categories: [
            { id: "awe", label: "awe / wonder" },
            { id: "fragility", label: "fragility / fear" },
            { id: "unity", label: "unity / connection" },
            { id: "action", label: "call to action" },
          ],
          solution: {
            shepard: "awe",
            sagan: "awe",
            mitchell: "unity",
            hadfield: "unity",
            "garan-thin": "fragility",
            "garan-return": "action",
            schweickart: "unity",
            jemison: "awe",
          },
        },
      },
      phase: "integration",
      label: "sort: voices from orbit",
      timeLimit: 120_000,
      discussionPrompt:
        "some quotes could fit multiple categories — where did the group disagree? the ambiguity reveals that the overview effect isn't a single emotion but a constellation of responses. which dimension resonated most with you?",
      hints: [
        "some quotes genuinely fit more than one category",
        "the 'correct' sorting is debatable — that's the point",
        "notice which dimension you're drawn to first",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "you cannot go to space. but frank white argues the overview effect can be triggered by any experience that forces a radical shift in scale — seeing a city from a mountaintop, looking through a microscope for the first time, holding a newborn. write about a moment when your perspective shifted so completely that you couldn't un-see the new view. what did you do differently afterward?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: your own overview",
      timeLimit: 300_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}
