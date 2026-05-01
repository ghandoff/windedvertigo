import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── margin.call ─────────────────────────────────────────────────
// decide -> reveal -> survive | time-pressure
// rapid-fire binary financial decisions, game-show pacing

export function marginCall(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "in 2008, lehman brothers stock fell from $86 to $0.03 in 10 months. what percentage of professional fund managers saw it coming and shorted the stock before september 2008?",
          type: "number",
          answer: 3,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: who saw it coming",
      discussionPrompt: "only 3% — why does hindsight make financial collapses feel obvious? what does that mean for the next time someone says 'everyone can see this coming'?",
      timeLimit: 45,
      hints: [
        "most analysts had buy ratings on lehman into the summer of 2008",
        "hindsight bias makes collapses look obvious",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "rapid-fire",
      },
    },
    {
      id: uid(),
      type: "poll",
      config: {
        type: "poll",
        poll: {
          question:
            "flash round: the market just dropped 4% in one day. your portfolio is down $12,000. you have 15 seconds. what do you do?",
          options: [
            { id: "sell", label: "sell everything \u2014 cut losses now" },
            { id: "hold", label: "hold \u2014 don't panic" },
            { id: "buy", label: "buy more \u2014 stocks are on sale" },
            { id: "hedge", label: "hedge \u2014 buy put options to protect downside" },
          ],
        },
      },
      phase: "struggle",
      label: "decide: flash crash",
      discussionPrompt: "look at the spread — who sold, who bought? the 15-second pressure is the point. what does your gut reaction reveal about your risk tolerance?",
      timeLimit: 15,
      hints: [
        "historically, markets recover from single-day drops over 90% of the time within 12 months",
      ],
      mechanic: {
        interactionModel: "reveal",
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
            "sort each economic indicator by whether it leads, lags, or coincides with economic cycles. this matters for predicting recessions.",
          cards: [
            { id: "yield-curve", content: "yield curve (10yr - 2yr spread)", hint: "inverted before every recession since 1955" },
            { id: "unemployment", content: "unemployment rate", hint: "peaks after a recession has already started" },
            { id: "gdp", content: "GDP growth", hint: "measured quarterly, confirmed after the fact" },
            { id: "permits", content: "building permits", hint: "developers decide months before breaking ground" },
            { id: "consumer-conf", content: "consumer confidence index", hint: "surveys capture expectations about the future" },
            { id: "cpi", content: "consumer price index (inflation)", hint: "prices adjust with a delay" },
            { id: "sp500", content: "S&P 500 index", hint: "markets are forward-looking" },
            { id: "avg-hours", content: "average weekly hours worked", hint: "employers cut hours before cutting jobs" },
          ],
          categories: [
            { id: "leading", label: "leading indicator", description: "changes before the economy shifts" },
            { id: "lagging", label: "lagging indicator", description: "changes after the economy has shifted" },
            { id: "coincident", label: "coincident indicator", description: "changes at the same time as the economy" },
          ],
          solution: {
            "yield-curve": "leading",
            unemployment: "lagging",
            gdp: "coincident",
            permits: "leading",
            "consumer-conf": "leading",
            cpi: "lagging",
            sp500: "leading",
            "avg-hours": "leading",
          },
        },
      },
      phase: "threshold",
      label: "sort: reading the signals",
      discussionPrompt: "the yield curve has predicted every recession since 1955 — but the stock market gives false positives. why is a boring bond spread more reliable than the market?",
      timeLimit: 120,
      hints: [
        "leading indicators predict \u2014 lagging indicators confirm",
        "the stock market has predicted 9 of the last 5 recessions (it gives false positives)",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "map where each investment type falls on the risk-reward spectrum. place traditional and alternative assets on the canvas.",
          width: 800,
          height: 600,
          xLabel: "risk (volatility)",
          yLabel: "expected annual return",
          xLow: "low risk",
          xHigh: "high risk",
          yLow: "low return",
          yHigh: "high return",
          zones: [
            { id: "safe", label: "low risk, low return", x: 0, y: 400, width: 300, height: 200 },
            { id: "balanced", label: "moderate risk, moderate return", x: 200, y: 200, width: 300, height: 200 },
            { id: "aggressive", label: "high risk, high return", x: 450, y: 0, width: 350, height: 250 },
          ],
          multiPin: true,
          minPins: 3,
          pinCategories: [
            { id: "traditional", label: "traditional asset", color: "#3b82f6" },
            { id: "alternative", label: "alternative asset", color: "#f59e0b" },
          ],
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: risk-reward frontier",
      timeLimit: 150,
      discussionPrompt:
        "did the group place any assets in surprising positions? where do crypto, real estate, and index funds cluster \u2014 and does the pattern resemble the efficient frontier?",
      hints: [
        "treasury bonds are the classic low-risk anchor point",
        "the efficient frontier is a curve, not a straight line",
      ],
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
            "you just made decisions under time pressure with incomplete information. research shows professionals do no better than amateurs in this scenario. what does this tell you about financial advice? about your own investing behavior? about the role of emotion in markets?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: pressure and judgment",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── trade.winds ─────────────────────────────────────────────────
// propose -> counter -> settle | async
// async diplomacy via messages, trade negotiation

export function tradeWinds(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "portugal can produce both wine and cloth more efficiently than england. should england even bother trading with portugal, or just try to make everything itself?",
          type: "choice",
          options: [
            { id: "no-trade", label: "no \u2014 portugal is better at everything, england loses" },
            { id: "yes-trade", label: "yes \u2014 both countries benefit from specializing and trading" },
            { id: "one-way", label: "only portugal benefits from this trade" },
          ],
          answer: "yes-trade",
        },
      },
      phase: "encounter",
      label: "predict: the ricardo puzzle",
      discussionPrompt: "who picked 'portugal wins'? absolute advantage is intuitive but wrong here — what's the leap to comparative advantage?",
      timeLimit: 60,
      hints: [
        "this is david ricardo's classic example from 1817",
        "think about opportunity cost, not absolute efficiency",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
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
            "four countries need to negotiate trade agreements. each has different resources, labor costs, and domestic needs. you must propose at least one trade deal that benefits your citizens. remember: you can only export what you produce efficiently, and your citizens will revolt if essential goods become too expensive.",
          roles: [
            {
              id: "agriland",
              label: "agriland",
              info: "you produce wheat at $2/bushel and textiles at $15/yard. your population needs 1M yards of textiles annually. you have vast farmland but few factories. your comparative advantage is agriculture \u2014 you produce 3x more food per worker than any other country. your citizens expect cheap food and decent clothing.",
              question: "who do you want to trade with and what terms would you propose? what's your walk-away point?",
            },
            {
              id: "techton",
              label: "techton",
              info: "you produce electronics at $50/unit and wheat at $8/bushel. your soil is poor but your workforce is highly educated. you import 80% of your food. your comparative advantage is technology. you have patents other countries need but you can't feed your people without trade.",
              question: "who do you want to trade with and what terms would you propose? what leverage do your patents give you?",
            },
            {
              id: "mineralia",
              label: "mineralia",
              info: "you produce rare earth minerals at $30/kg and electronics at $200/unit. you have the only known deposits of neodymium, essential for all electronics. your comparative advantage is raw materials. you could restrict supply to drive up prices, but that might trigger trade wars.",
              question: "who do you want to trade with? would you use your mineral monopoly as leverage, and what are the risks?",
            },
            {
              id: "textilia",
              label: "textilia",
              info: "you produce textiles at $3/yard and food at $6/bushel. your labor costs are low and your workers are skilled with fabric. you want to industrialize but lack capital. your comparative advantage is manufacturing. you need technology imports to grow your economy beyond textiles.",
              question: "who do you want to trade with? how can you use trade to accelerate your economic development?",
            },
          ],
          discussionPrompt:
            "share your proposed deals. did any country try to exploit its monopoly? did the deals reflect comparative advantage? which deals created the most mutual benefit?",
          revealPrompt:
            "ricardo's insight: even if one country is better at everything in absolute terms, trade based on comparative advantage (lowest opportunity cost) benefits everyone. the key is specialization in what you're relatively best at, not absolutely best at.",
        },
      },
      phase: "struggle",
      label: "negotiate: four-country trade",
      timeLimit: 240,
      hints: [
        "compare opportunity costs, not absolute costs",
        "a country that can make everything cheaply should still specialize",
        "consider: what do you give up to produce each good?",
      ],
      mechanic: {
        interactionModel: "negotiation",
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
            "map each country's production possibility frontier. place them on the canvas to show who has comparative advantage in what. draw or note the trade flows that emerged from your negotiation.",
          width: 800,
          height: 600,
          xLabel: "agricultural / raw material output",
          yLabel: "manufactured / tech output",
          xLow: "low output",
          xHigh: "high output",
          yLow: "low output",
          yHigh: "high output",
          zones: [
            { id: "primary", label: "primary goods specialists", x: 500, y: 350, width: 300, height: 250 },
            { id: "industrial", label: "manufacturing specialists", x: 0, y: 0, width: 300, height: 250 },
            { id: "diversified", label: "diversified economies", x: 250, y: 200, width: 300, height: 200 },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: comparative advantage",
      timeLimit: 150,
      discussionPrompt:
        "which countries ended up closest together on the map? did the negotiation outcomes match what comparative advantage theory would predict?",
      mechanic: {
        interactionModel: "sandbox",
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
            "comparative advantage says everyone benefits from trade. but in the real world, trade creates winners and losers within each country \u2014 textile workers in techton lose their jobs when cheap imports arrive. how should a society balance the aggregate gains from trade with the real harm to displaced workers? is free trade always the right policy?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: winners and losers",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── commons.game ────────────────────────────────────────────────
// betray -> detect -> govern | turn-based
// social deduction -> constitution-writing, tragedy of the commons

export function commonsGame(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a shared pasture supports 100 cattle sustainably. 10 farmers each graze 10 cattle. if each farmer adds just 1 extra cow, what happens to total output over 5 years?",
          type: "choice",
          options: [
            { id: "increase", label: "output increases \u2014 110 cattle produce more than 100" },
            { id: "same", label: "output stays about the same \u2014 the pasture adjusts" },
            { id: "collapse", label: "output collapses \u2014 overgrazing destroys the pasture" },
          ],
          answer: "collapse",
        },
      },
      phase: "encounter",
      label: "predict: the pasture problem",
      timeLimit: 60,
      hints: [
        "garrett hardin wrote about this in 1968",
        "each farmer gets 100% of the benefit of adding a cow but shares only 10% of the cost",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
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
            "round 1: you share a fishery with the other players. it has 100 fish and regenerates 20% per year. you can take 0-30 fish this round. how many do you take? (if total harvest exceeds regeneration, the fishery shrinks)",
          options: [
            { id: "conservative", label: "0-5 fish (conserve heavily)" },
            { id: "sustainable", label: "6-10 fish (roughly sustainable share)" },
            { id: "greedy", label: "11-20 fish (take more than your share)" },
            { id: "max", label: "21-30 fish (maximize personal gain now)" },
          ],
        },
      },
      phase: "struggle",
      label: "decide: fish or conserve (round 1)",
      discussionPrompt: "show the results — how many people took more than their sustainable share? did anyone take the maximum? ask them why without judgment",
      timeLimit: 30,
      hints: [
        "if everyone takes their sustainable share (20 fish / N players), the fishery sustains forever",
        "but you don't know what others will take...",
      ],
      mechanic: {
        interactionModel: "competition",
        socialStructure: "competitive",
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
            "the fishery is now at 60% capacity after two rounds of overfishing. the community must decide what to do. each of you has a different stake in the outcome and a different proposal for governance.",
          roles: [
            {
              id: "farmer",
              label: "the small fisher",
              info: "you depend on this fishery for your family's food. you've been taking only your sustainable share (5 fish/round) but others haven't. you're furious. you want strict quotas enforced by fines \u2014 anyone taking more than 8 fish per round pays a penalty equal to double the excess. you can't afford to lose this fishery.",
              question: "propose your governance rule. why is your approach fair? what happens if the group rejects quotas?",
            },
            {
              id: "regulator",
              label: "the regulator",
              info: "you represent the government and can enforce rules, but enforcement costs money (taken from everyone as a tax). you propose a fishing license system: each person pays 5 fish/round for a license that allows them to catch 10 fish. unlicensed fishing is prohibited. the license fees fund monitoring and restocking.",
              question: "propose your governance rule. how do you handle those who fish without a license?",
            },
            {
              id: "freerider",
              label: "the opportunist",
              info: "you've been taking 25 fish per round and selling the excess. you've accumulated wealth. you oppose regulation because it hurts your business. you argue that the fishery will recover naturally and that government intervention creates bureaucracy. privately, you'd accept a tradeable quota system where you could buy others' quotas.",
              question: "make your case against regulation. or propose an alternative that protects your interests while appearing fair.",
            },
            {
              id: "activist",
              label: "the activist",
              info: "you want a 2-year moratorium: zero fishing while the stock recovers. you propose a community fund where everyone contributes during the moratorium, with shared payouts when fishing resumes. you believe the fishery can recover to 150% capacity if left alone, benefiting everyone long-term.",
              question: "propose your governance rule. how do you convince the others to accept short-term sacrifice?",
            },
          ],
          discussionPrompt:
            "debate the proposals. can you reach consensus? does the group choose quotas, licenses, moratorium, or free-market? what compromises emerge?",
          revealPrompt:
            "elinor ostrom won the 2009 nobel prize for showing that communities can self-govern commons without privatization or top-down regulation \u2014 but only with clear boundaries, graduated sanctions, and collective decision-making.",
        },
      },
      phase: "threshold",
      label: "govern: write the rules",
      timeLimit: 240,
      hints: [
        "ostrom's 8 principles include: clear group boundaries, rules fit local conditions, collective decision-making",
        "pure privatization and pure regulation both have failure modes",
      ],
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
            "write one governance rule for the fishery that you think would actually work. be specific: who does it apply to, what does it require, and what happens if someone breaks it?",
          responseType: "text",
          anonymous: false,
        },
      },
      phase: "integration",
      label: "draft: your governance rule",
      discussionPrompt: "read a few rules aloud — which ones would actually survive contact with human self-interest? ostrom's insight was that the community writes the rules, not outsiders",
      timeLimit: 180,
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
            "climate change is the ultimate commons problem \u2014 the atmosphere is shared, emissions are individual, and enforcement is nearly impossible across sovereign nations. based on what you learned about governing the fishery, what makes climate governance so much harder? what elements of ostrom's approach could still apply?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the global commons",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── scale.shift ─────────────────────────────────────────────────
// zoom -> interact -> question | paced
// pinch between micro and macro economics

export function scaleShift(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "if every household in the country decides to save more money during a recession (individually rational), what happens to the overall economy?",
          type: "choice",
          options: [
            { id: "grows", label: "the economy grows \u2014 more savings means more investment" },
            { id: "shrinks", label: "the economy shrinks \u2014 less spending means less income for everyone" },
            { id: "neutral", label: "no effect \u2014 saving and spending balance out" },
          ],
          answer: "shrinks",
        },
      },
      phase: "encounter",
      label: "predict: the paradox of thrift",
      discussionPrompt: "saving money is individually rational — who picked 'the economy grows'? this is the composition fallacy in action. what felt wrong about the correct answer?",
      timeLimit: 60,
      hints: [
        "keynes identified this paradox in the 1930s",
        "your spending is someone else's income",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
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
            "the same economy is in recession. unemployment is 9%, inflation is 1.5%, GDP fell 2% last quarter. you each see the same data but through a different lens \u2014 and you reach different conclusions about what to do.",
          roles: [
            {
              id: "micro",
              label: "the microeconomist",
              info: "you study individual firms and consumers. you see that businesses are cutting costs rationally, workers are accepting lower wages to stay employed, and prices are falling toward equilibrium. you believe the recession is a healthy correction \u2014 inefficient firms should fail so resources flow to productive ones. government intervention distorts price signals and delays recovery.",
              question: "what policy do you recommend and why? what do you think the macroeconomist is getting wrong?",
            },
            {
              id: "macro",
              label: "the macroeconomist",
              info: "you study aggregate demand and the economy as a whole. you see a deflationary spiral: falling demand causes layoffs, which reduce spending further, which causes more layoffs. individual rationality (cutting costs, saving more) creates collective catastrophe. you believe government must increase spending to break the cycle, even if it means running a deficit.",
              question: "what policy do you recommend and why? what do you think the microeconomist is missing?",
            },
            {
              id: "central-bank",
              label: "the central banker",
              info: "you control interest rates and money supply. you've already cut rates to 0.25% and the economy hasn't recovered. you're considering quantitative easing (buying government bonds to inject money). you worry about inflation if you go too far, but deflation if you do too little. you must balance the micro view (don't distort markets) with the macro view (prevent collapse).",
              question: "what's your next move? whose analysis do you find more compelling \u2014 micro or macro?",
            },
          ],
          discussionPrompt:
            "present your analysis to the group. where do the micro and macro perspectives agree? where do they fundamentally conflict? can the central banker bridge the gap?",
          revealPrompt:
            "this is the core tension in economics: what's rational for individuals can be catastrophic in aggregate (fallacy of composition). modern economics tries to build 'microfoundations' for macro models, but the debate between intervention and laissez-faire continues.",
        },
      },
      phase: "struggle",
      label: "debate: micro vs macro",
      timeLimit: 240,
      hints: [
        "the fallacy of composition: what's true for the part isn't necessarily true for the whole",
        "both perspectives have real insights \u2014 the question is which matters more right now",
      ],
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "asymmetric",
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
            "sort each concept into whether it belongs to microeconomics or macroeconomics. some might surprise you.",
          cards: [
            { id: "supply-demand", content: "supply and demand curves", hint: "individual markets" },
            { id: "gdp", content: "gross domestic product (GDP)", hint: "total output of a country" },
            { id: "elasticity", content: "price elasticity of demand", hint: "how sensitive buyers are to price changes" },
            { id: "inflation", content: "inflation rate", hint: "economy-wide price level changes" },
            { id: "monopoly", content: "monopoly pricing power", hint: "a single firm's market behavior" },
            { id: "fiscal", content: "fiscal policy (government spending)", hint: "aggregate demand management" },
            { id: "externality", content: "externalities (pollution costs)", hint: "costs imposed on third parties" },
            { id: "money-supply", content: "money supply and interest rates", hint: "central bank territory" },
          ],
          categories: [
            { id: "micro", label: "microeconomics", description: "individual agents, firms, markets" },
            { id: "macro", label: "macroeconomics", description: "aggregate economy, national/global" },
          ],
          solution: {
            "supply-demand": "micro",
            gdp: "macro",
            elasticity: "micro",
            inflation: "macro",
            monopoly: "micro",
            fiscal: "macro",
            externality: "micro",
            "money-supply": "macro",
          },
        },
      },
      phase: "threshold",
      label: "sort: micro or macro?",
      discussionPrompt: "externalities trip everyone up — pollution is a micro concept about market failure, not a macro one. where does the boundary between micro and macro actually blur?",
      timeLimit: 120,
      hints: [
        "micro = decisions of individuals and firms",
        "macro = economy-wide aggregates and policy",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
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
            "place each economic phenomenon on the micro-macro spectrum. some phenomena exist at both scales \u2014 place them where you think they're most important.",
          width: 800,
          height: 600,
          xLabel: "scale: micro (individual) \u2192 macro (aggregate)",
          yLabel: "time horizon: short-run \u2192 long-run",
          zones: [
            { id: "micro-short", label: "micro + short-run", x: 0, y: 0, width: 400, height: 300 },
            { id: "micro-long", label: "micro + long-run", x: 0, y: 300, width: 400, height: 300 },
            { id: "macro-short", label: "macro + short-run", x: 400, y: 0, width: 400, height: 300 },
            { id: "macro-long", label: "macro + long-run", x: 400, y: 300, width: 400, height: 300 },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: the scale spectrum",
      timeLimit: 150,
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
            "the paradox of thrift shows that individual rationality can produce collective disaster. where else in life does this happen? think about traffic, social media, arms races, or any system where everyone doing the 'smart thing' makes everything worse. what's the pattern?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the composition fallacy",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── market.mind ─────────────────────────────────────────────────
// allocate -> trade -> compare | turn-based
// multiplayer resource allocation, behavioral economics

export function marketMind(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "you're given a coffee mug. how much would you sell it for? studies show people demand roughly 2x more to sell something they own than they'd pay to buy the same item. what is this effect called, and what's the typical selling price when the mug cost $5 to buy?",
          type: "number",
          answer: 10,
          unit: "$ (selling price)",
        },
      },
      phase: "encounter",
      label: "predict: the mug experiment",
      discussionPrompt: "the endowment effect is 2x — owning something doubles its value to you. where has this shown up in your own buying and selling decisions?",
      timeLimit: 60,
      hints: [
        "this is one of the most replicated findings in behavioral economics",
        "kahneman, knetsch, and thaler demonstrated this in 1990",
        "loss aversion makes giving something up feel twice as painful as gaining it feels good",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "explore how supply, demand, and price interact in a simple market. adjust the parameters to find equilibrium \u2014 the price where quantity supplied equals quantity demanded.",
          parameters: [
            { id: "price", label: "market price", min: 1, max: 100, step: 1, defaultValue: 50, unit: "$" },
            { id: "supply_shift", label: "supply shift (cost change)", min: -30, max: 30, step: 5, defaultValue: 0, unit: "$" },
            { id: "demand_shift", label: "demand shift (preference change)", min: -30, max: 30, step: 5, defaultValue: 0, unit: "$" },
            { id: "elasticity", label: "demand elasticity", min: 1, max: 5, step: 1, defaultValue: 2, unit: "sensitivity" },
          ],
          formula: "(100 - price * elasticity + demand_shift) - (price - 20 + supply_shift)",
          outputLabel: "excess demand (+ shortage, - surplus)",
          outputUnit: "units",
          reflectionPrompt:
            "at what price does excess demand hit zero? how does changing elasticity affect how quickly the market clears? what happens when you shock supply or demand?",
        },
      },
      phase: "struggle",
      label: "sandbox: find equilibrium",
      timeLimit: 180,
      hints: [
        "equilibrium is where excess demand = 0",
        "higher elasticity means demand is more sensitive to price",
        "a supply shock (like a drought) shifts the supply curve, changing equilibrium",
      ],
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
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
            "sort each cognitive bias by whether it causes people to buy too much (overvalue) or sell too much (undervalue) in financial markets.",
          cards: [
            { id: "anchoring", content: "anchoring: fixating on the first price you see", hint: "the initial number sets your reference point" },
            { id: "loss-aversion", content: "loss aversion: feeling losses 2x as much as gains", hint: "people hold losing stocks too long" },
            { id: "herd", content: "herding: following what everyone else is doing", hint: "creates bubbles and panics" },
            { id: "overconfidence", content: "overconfidence: believing you can beat the market", hint: "leads to excessive trading" },
            { id: "recency", content: "recency bias: weighting recent events too heavily", hint: "after a rally, everything looks like it'll keep going up" },
            { id: "sunk-cost", content: "sunk cost fallacy: throwing good money after bad", hint: "refusing to sell because you've 'invested too much'" },
            { id: "disposition", content: "disposition effect: selling winners too early, holding losers", hint: "locking in gains feels good, admitting losses hurts" },
          ],
          categories: [
            { id: "overvalue", label: "causes overbuying / holding too long", description: "biases that inflate prices or prevent selling" },
            { id: "undervalue", label: "causes overselling / panic exits", description: "biases that deflate prices or trigger premature selling" },
            { id: "both", label: "can go either direction", description: "biases that amplify whatever trend is already happening" },
          ],
          solution: {
            anchoring: "both",
            "loss-aversion": "overvalue",
            herd: "both",
            overconfidence: "overvalue",
            recency: "both",
            "sunk-cost": "overvalue",
            disposition: "undervalue",
          },
        },
      },
      phase: "threshold",
      label: "sort: biases in markets",
      timeLimit: 120,
      hints: [
        "loss aversion and sunk cost both make you reluctant to sell at a loss",
        "herding can drive bubbles (overbuying) or crashes (panic selling)",
      ],
      mechanic: {
        interactionModel: "construction",
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
            "honest self-assessment: which bias do you think affects YOUR financial decisions the most?",
          options: [
            { id: "loss-aversion", label: "loss aversion \u2014 i hold losers too long hoping they'll recover" },
            { id: "herd", label: "herding \u2014 i buy what's trending and panic when others sell" },
            { id: "overconfidence", label: "overconfidence \u2014 i think i can pick winners" },
            { id: "recency", label: "recency bias \u2014 i extrapolate recent trends into the future" },
            { id: "sunk-cost", label: "sunk cost \u2014 i can't let go of bad investments" },
          ],
        },
      },
      phase: "integration",
      label: "poll: know your bias",
      discussionPrompt: "which bias got the most votes? if it's loss aversion or herding — those are the two that drive market bubbles. does knowing your bias help you resist it?",
      timeLimit: 45,
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
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
            "the efficient markets hypothesis says prices reflect all available information, making it impossible to consistently beat the market. but behavioral economics shows people are predictably irrational. can both be true at the same time? if markets are mostly efficient but occasionally wildly wrong (bubbles, crashes), what does that mean for how you should invest?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: efficient or irrational?",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}
