import type { Activity } from "./types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── the classic crossing ─────────────────────────────────────────

export function classicCrossing(concept: {
  name: string;
  prediction: string;
  predictionAnswer: string | number;
  predictionUnit?: string;
  strugglePrompt: string;
  revealText: string;
  reflectionPrompt: string;
  applicationPrompt: string;
}): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: `predict: ${concept.name}`,
      config: {
        type: "prediction",
        prediction: {
          question: concept.prediction,
          type: typeof concept.predictionAnswer === "number" ? "number" : "text",
          answer: concept.predictionAnswer,
          unit: concept.predictionUnit,
        },
      },
      timeLimit: 60,
    },
    {
      id: uid(),
      type: "open-response",
      phase: "struggle",
      label: `explore: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: {
          prompt: concept.strugglePrompt,
          responseType: "text",
          anonymous: false,
        },
      },
      timeLimit: 180,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: `reveal: ${concept.name}`,
      config: {
        type: "poll",
        poll: {
          question: concept.revealText,
          options: [
            { id: "shifted", label: "my thinking shifted" },
            { id: "confused", label: "i'm still confused" },
            { id: "knew-it", label: "i already knew this" },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: `reflect: ${concept.name}`,
      config: {
        type: "reflection",
        reflection: {
          prompt: concept.reflectionPrompt,
          minLength: 50,
          shareWithGroup: true,
        },
      },
      timeLimit: 180,
    },
    {
      id: uid(),
      type: "open-response",
      phase: "application",
      label: `apply: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: {
          prompt: concept.applicationPrompt,
          responseType: "text",
          anonymous: false,
        },
      },
      timeLimit: 240,
    },
  ];
}

// ── the detective ────────────────────────────────────────────────

export function detective(concept: {
  name: string;
  briefing: string;
  evidencePrompt: string;
  revealText: string;
  reflectionPrompt: string;
}): Activity[] {
  return [
    {
      id: uid(),
      type: "open-response",
      phase: "encounter",
      label: `briefing: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.briefing, responseType: "text", anonymous: false },
      },
      timeLimit: 120,
    },
    {
      id: uid(),
      type: "open-response",
      phase: "struggle",
      label: `investigate: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.evidencePrompt, responseType: "text", anonymous: false },
      },
      timeLimit: 300,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: `verdict: ${concept.name}`,
      config: {
        type: "poll",
        poll: {
          question: concept.revealText,
          options: [
            { id: "trusted", label: "i trusted the wrong source" },
            { id: "skeptical", label: "i caught the unreliable source" },
            { id: "unsure", label: "i'm not sure what to believe" },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: `debrief: ${concept.name}`,
      config: {
        type: "reflection",
        reflection: { prompt: concept.reflectionPrompt, minLength: 50, shareWithGroup: true },
      },
      timeLimit: 180,
    },
  ];
}

// ── the paradigm shift ──────────────────────────────────────────

export function paradigmShift(concept: {
  name: string;
  learnPrompt: string;
  predictionQuestion: string;
  predictionAnswer: string | number;
  breakReveal: string;
  reframePrompt: string;
  reflectionPrompt: string;
}): Activity[] {
  return [
    {
      id: uid(),
      type: "open-response",
      phase: "encounter",
      label: `learn: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.learnPrompt, responseType: "text", anonymous: false },
      },
      timeLimit: 180,
    },
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: `predict: ${concept.name}`,
      config: {
        type: "prediction",
        prediction: {
          question: concept.predictionQuestion,
          type: typeof concept.predictionAnswer === "number" ? "number" : "text",
          answer: concept.predictionAnswer,
        },
      },
      timeLimit: 60,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: `the break: ${concept.name}`,
      config: {
        type: "poll",
        poll: {
          question: concept.breakReveal,
          options: [
            { id: "broken", label: "my model is broken" },
            { id: "adapting", label: "i can patch my model" },
            { id: "fine", label: "this doesn't change anything" },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "open-response",
      phase: "struggle",
      label: `reframe: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.reframePrompt, responseType: "text", anonymous: false },
      },
      timeLimit: 240,
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: `reflect: ${concept.name}`,
      config: {
        type: "reflection",
        reflection: { prompt: concept.reflectionPrompt, minLength: 50, shareWithGroup: true },
      },
    },
  ];
}

// ── the empathy engine ──────────────────────────────────────────

export function empathyEngine(concept: {
  name: string;
  scenario: string;
  decisionPrompt: string;
  consequenceReveal: string;
  reflectionPrompt: string;
}): Activity[] {
  return [
    {
      id: uid(),
      type: "open-response",
      phase: "encounter",
      label: `your role: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.scenario, responseType: "text", anonymous: false },
      },
      timeLimit: 120,
    },
    {
      id: uid(),
      type: "open-response",
      phase: "struggle",
      label: `decide: ${concept.name}`,
      config: {
        type: "open-response",
        openResponse: { prompt: concept.decisionPrompt, responseType: "text", anonymous: false },
      },
      timeLimit: 180,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: `consequences: ${concept.name}`,
      config: {
        type: "poll",
        poll: {
          question: concept.consequenceReveal,
          options: [
            { id: "surprised", label: "i didn't expect that" },
            { id: "predicted", label: "i saw that coming" },
            { id: "conflicted", label: "i feel conflicted" },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: `debrief: ${concept.name}`,
      config: {
        type: "reflection",
        reflection: { prompt: concept.reflectionPrompt, minLength: 50, shareWithGroup: true },
      },
      timeLimit: 240,
    },
  ];
}

// ── whirlpool: play as pedagogy ────────────────────────────────

export function playAsPedagogy(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: gamification vs play",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a school adds points, badges, and leaderboards to math class. test scores rise 15% in month one. predict: what happens to intrinsic motivation after 6 months?",
          type: "text",
          answer: "it drops — external rewards crowd out intrinsic motivation (overjustification effect)",
        },
      },
      timeLimit: 60,
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "struggle",
      label: "perspectives: what is play?",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "four learning designers walk into a room. each has a radically different definition of play. read your perspective, then answer your question.",
          roles: [
            {
              id: "huizinga",
              label: "the anthropologist (huizinga)",
              info: "play is a voluntary activity standing outside 'ordinary life.' it is free, never imposed. the moment you make play mandatory, it ceases to be play. play creates its own sacred space — the 'magic circle' — where different rules apply.",
              question:
                "if play must be voluntary, can a facilitator ever truly design a 'play experience'? or does the act of designing it destroy it?",
            },
            {
              id: "vygotsky",
              label: "the developmental psychologist (vygotsky)",
              info: "play is the leading activity of childhood development. in play, the child always behaves beyond their average age — they stretch into their zone of proximal development. play creates the conditions for learning, not the other way around.",
              question:
                "if play IS the mechanism of development (not just a context for it), what changes about how we design learning experiences?",
            },
            {
              id: "papert",
              label: "the constructionist (papert)",
              info: "the best learning happens when people are building things that matter to them. play is construction. the logo turtle taught children geometry not by explaining angles but by letting them play with movement. the learning was a side effect of the play.",
              question:
                "what's an example from your own life where you learned something profound as a 'side effect' of playing or making?",
            },
            {
              id: "mcgonigal",
              label: "the game designer (mcgonigal)",
              info: "games are unnecessary obstacles we voluntarily overcome. the key insight: we CHOOSE difficulty in play, but resist it in learning. games produce 'blissful productivity' — hard work that feels like fun. gamification fails because it adds game elements without game spirit.",
              question:
                "why do people voluntarily grind for hours in video games but resist 20 minutes of homework? what's the real difference?",
            },
          ],
          discussionPrompt:
            "each of you had a different thinker's perspective. share what you read — and notice where they agree and where they clash.",
          revealPrompt:
            "the threshold concept: play is not a delivery mechanism for learning. play IS the cognitive process through which development happens. gamification fails because it treats play as wrapping paper. real play IS the gift.",
        },
      },
      timeLimit: 240,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: "the crossing: play ≠ gamification",
      config: {
        type: "poll",
        poll: {
          question:
            "after hearing all four perspectives — which statement is closest to crossing for you?",
          options: [
            {
              id: "shifted",
              label:
                "i used to think play was a vehicle for learning. now i think play IS learning.",
            },
            {
              id: "deepened",
              label:
                "i already felt this, but now i can articulate why gamification doesn't work.",
            },
            {
              id: "resisting",
              label:
                "i'm not sure i buy it — points and badges DO motivate people.",
            },
            {
              id: "liminal",
              label:
                "i'm in between — i can see both sides and feel genuinely unsettled.",
            },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: what we build differently now",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "think about a learning experience you've designed (or are designing). where did you accidentally treat play as wrapping paper? what would change if you designed play as the core cognitive mechanism instead?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
    },
    {
      id: uid(),
      type: "open-response",
      phase: "application",
      label: "apply: redesign one thing",
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "pick one specific thing in a current w.v project. describe it in one sentence, then describe how you'd redesign it so play IS the learning mechanism (not decoration). be concrete.",
          responseType: "text",
          anonymous: false,
        },
      },
      timeLimit: 300,
    },
  ];
}

// ── whirlpool: sunk cost trap ──────────────────────────────────

export function sunkCostTrap(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: the ticket dilemma",
      config: {
        type: "prediction",
        prediction: {
          question:
            "you paid $120 for a ski trip ticket. on the day of the trip, you feel sick and there's a blizzard. a friend offers a cozy movie night instead. what percentage of people still go skiing?",
          type: "number",
          answer: 54,
          unit: "%",
        },
      },
      timeLimit: 45,
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: the escalation",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "a startup spends $2M building a product nobody wants. put these real responses in the order they typically happen (the escalation trap):",
          pieces: [
            {
              id: "invest",
              content: "\"we've already invested so much — let's keep going\"",
            },
            {
              id: "pivot",
              content: "\"just one more feature and users will come\"",
            },
            {
              id: "double",
              content: "\"we need to double our marketing budget\"",
            },
            {
              id: "blame",
              content: "\"the market isn't ready yet — we're ahead of our time\"",
            },
            {
              id: "finally",
              content: "\"we should have stopped 18 months ago\"",
            },
          ],
          solution: ["invest", "pivot", "double", "blame", "finally"],
        },
      },
      timeLimit: 120,
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "struggle",
      label: "perspectives: should we keep going?",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "winded.vertigo has spent 6 months and $30k on a product. engagement is low. you each have different information about the situation.",
          roles: [
            {
              id: "founder",
              label: "the founder",
              info: "you personally pitched this product to 3 major clients. your reputation is tied to it. you've told the board it will be ready by Q3. the team has worked nights and weekends. user interviews show people like the concept but don't use it regularly.",
              question:
                "what's your gut reaction? continue, pivot, or stop? be honest about WHY.",
            },
            {
              id: "advisor",
              label: "the outside advisor",
              info: "you have no emotional investment. you see the numbers: $30k spent, 12 active users, 3% retention after week one. you've seen this pattern in 20 other startups. the concept is strong but execution may be wrong. a competitor just raised $5M for a similar idea.",
              question:
                "what would you tell the founder? and why is it hard to say?",
            },
            {
              id: "user",
              label: "the target user",
              info: "you tried the product. the onboarding took 15 minutes and you gave up. the core idea is brilliant but you couldn't figure out how to use it in your actual workflow. you'd pay for what it promises but not what it currently delivers.",
              question:
                "what would you actually need to become a daily user? be specific.",
            },
            {
              id: "team",
              label: "the lead engineer",
              info: "you've built 70% of this product. the architecture is sound but the scope keeps growing. you secretly think the MVP should have been 1/3 the size. morale is dropping because the team feels like nothing ships. you could rebuild the core in 2 weeks if you started fresh.",
              question:
                "would you rather keep building on the current foundation or start over? what's really driving your answer?",
            },
          ],
          discussionPrompt:
            "each of you had different information. the founder, advisor, user, and engineer all see different things. share what you learned — where do the perspectives conflict?",
          revealPrompt:
            "the threshold: sunk costs are irrelevant to future decisions. the $30k is gone whether you continue or stop. the only question that matters is: 'knowing what we know now, would we start this project today?' if the answer is no, the rational choice is to stop — regardless of what's been spent.",
        },
      },
      timeLimit: 240,
    },
    {
      id: uid(),
      type: "poll",
      phase: "threshold",
      label: "the crossing: would you start it today?",
      config: {
        type: "poll",
        poll: {
          question:
            "now that you've seen all perspectives — apply the 'would we start this today?' test to something real in your work or life. did it change your answer?",
          options: [
            {
              id: "yes-stop",
              label: "yes — i realized i should stop something i've been holding onto",
            },
            {
              id: "yes-continue",
              label: "yes — i confirmed something is worth continuing, but for better reasons now",
            },
            {
              id: "hard",
              label: "i know the rational answer but it still feels wrong to 'waste' the investment",
            },
            {
              id: "complicated",
              label: "it's more complicated than just sunk costs — reputation, relationships, and identity are real",
            },
          ],
        },
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: what are you holding onto?",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "name one thing — a project, habit, tool, or commitment — that you suspect you're continuing because of sunk costs rather than future value. what would it look like to let it go? what's actually stopping you?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
    },
  ];
}

// ── whirlpool: systems thinking ──────────────────────────────────

export function systemsThinking(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: the paper clip factory",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a factory makes 100 paper clips per hour. the owner doubles the workers. how many paper clips per hour does the factory make now?",
          type: "number",
          answer: 150,
          unit: "clips/hr",
        },
      },
      timeLimit: 45,
    },
    {
      id: uid(),
      type: "rule-sandbox",
      phase: "struggle",
      label: "explore: diminishing returns",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "adjust the parameters to understand how production actually works. watch what happens as you add more workers to a fixed-size factory floor.",
          parameters: [
            {
              id: "workers",
              label: "workers",
              min: 1,
              max: 50,
              step: 1,
              defaultValue: 10,
            },
            {
              id: "floorSize",
              label: "floor size",
              min: 100,
              max: 1000,
              step: 50,
              defaultValue: 500,
              unit: "sqft",
            },
            {
              id: "machineCount",
              label: "machines",
              min: 1,
              max: 20,
              step: 1,
              defaultValue: 5,
            },
          ],
          formula:
            "machineCount * 20 * (1 - (workers / (floorSize / 10)) * (workers / (floorSize / 10)) * 0.3)",
          outputLabel: "output",
          outputUnit: "clips/hr",
          reflectionPrompt:
            "what happened when you kept adding workers without changing floor size or machines? describe the pattern you noticed.",
        },
      },
      timeLimit: 180,
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "categorize: linear vs systemic",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each statement into 'linear thinking' (simple cause → effect) or 'systems thinking' (feedback loops, emergence, non-linearity):",
          cards: [
            {
              id: "more-teachers",
              content: "more teachers = better student outcomes",
            },
            {
              id: "feedback",
              content:
                "teacher burnout reduces quality, which increases class sizes, which increases burnout",
            },
            {
              id: "double-budget",
              content: "double the marketing budget = double the sales",
            },
            {
              id: "network",
              content:
                "each new user makes the platform more valuable for all existing users",
            },
            {
              id: "overtime",
              content: "more hours worked = more output",
            },
            {
              id: "complexity",
              content:
                "adding a feature makes the product harder to learn, which reduces adoption, which reduces revenue for more features",
            },
          ],
          categories: [
            {
              id: "linear",
              label: "linear thinking",
              description: "assumes simple, proportional cause → effect",
            },
            {
              id: "systems",
              label: "systems thinking",
              description: "recognizes feedback loops, emergence, or non-linearity",
            },
          ],
          solution: {
            "more-teachers": "linear",
            feedback: "systems",
            "double-budget": "linear",
            network: "systems",
            overtime: "linear",
            complexity: "systems",
          },
        },
      },
      timeLimit: 120,
    },
    {
      id: uid(),
      type: "canvas",
      phase: "integration",
      label: "map: where do you operate?",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "place your pin on the map. where does your current project sit? be honest about where you ARE, not where you want to be.",
          width: 100,
          height: 100,
          xLabel: "simple → complex",
          yLabel: "predictable → emergent",
          zones: [
            { id: "obvious", label: "obvious", x: 0, y: 50, width: 25, height: 50 },
            { id: "complicated", label: "complicated", x: 25, y: 50, width: 25, height: 50 },
            { id: "complex", label: "complex", x: 50, y: 0, width: 25, height: 50 },
            { id: "chaotic", label: "chaotic", x: 75, y: 0, width: 25, height: 50 },
          ],
          allowNote: true,
        },
      },
      timeLimit: 90,
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: what changes?",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "if your project sits in the 'complex' or 'chaotic' zone, linear planning won't work. what's one practice you'd change — meetings, roadmaps, metrics, hiring — if you truly accepted that your work is non-linear?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
    },
  ];
}

// ── demo session ─────────────────────────────────────────────────

export const DEMO_SESSION = classicCrossing({
  name: "opportunity cost",
  prediction:
    "you win a free ticket to a concert tonight (worth $50 to you). a friend offers to pay you $80 to help them move instead. what is the opportunity cost of going to the concert?",
  predictionAnswer: 80,
  predictionUnit: "$",
  strugglePrompt:
    "many people say $0 because the ticket was free. explain in your own words: why is the opportunity cost not $0? what are you giving up by choosing the concert?",
  revealText:
    "the opportunity cost of the concert is $80 — the value of the best alternative you gave up. the ticket's price ($0) is irrelevant. every choice has a hidden cost: the road not taken. did this shift your thinking?",
  reflectionPrompt:
    "think of a recent decision you made. what was the opportunity cost you didn't consider at the time? what would you tell your past self?",
  applicationPrompt:
    "your company can invest in project A (expected return: $100k, risk: low) or project B (expected return: $200k, risk: high). what is the opportunity cost of choosing project A? how does thinking in opportunity costs change the decision?",
});
