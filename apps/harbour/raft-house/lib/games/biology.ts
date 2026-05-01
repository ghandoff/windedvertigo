import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── selection.pressure ──────────────────────────────────────────
// shape → observe → adapt | real-time
// indirect control only — the frustration IS the lesson

export function selectionPressure(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "bacteria can develop antibiotic resistance. how many generations does it typically take for a population of E. coli to evolve significant resistance to a new antibiotic in lab conditions?",
          type: "choice",
          options: [
            { id: "ten", label: "~10 generations (a few hours)" },
            { id: "hundred", label: "~100 generations (a few days)" },
            { id: "thousand", label: "~1,000 generations (weeks)" },
            { id: "million", label: "~1,000,000 generations (years)" },
          ],
          answer: "hundred",
        },
      },
      phase: "encounter",
      label: "predict: evolution speed",
      discussionPrompt: "who guessed closest? ask why — did anyone reason from bacterial division rates or was it pure intuition?",
      timeLimit: 45,
      hints: [
        "E. coli divides every ~20 minutes",
        "resistance often comes from a single mutation",
        "natural selection works fast when selection pressure is strong",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "you control the environment, not the organisms. adjust selection pressures and watch the population respond over generations. notice: you cannot change the organisms directly — only the world they live in. the 'fitness score' shows how well-adapted the population is to current conditions.",
          parameters: [
            {
              id: "temp",
              label: "temperature",
              min: -10,
              max: 50,
              step: 5,
              defaultValue: 25,
              unit: "C",
            },
            {
              id: "predation",
              label: "predation pressure",
              min: 0,
              max: 100,
              step: 10,
              defaultValue: 30,
              unit: "%",
            },
            {
              id: "food",
              label: "food scarcity",
              min: 0,
              max: 100,
              step: 10,
              defaultValue: 50,
              unit: "%",
            },
            {
              id: "generations",
              label: "generations elapsed",
              min: 1,
              max: 500,
              step: 10,
              defaultValue: 50,
            },
          ],
          formula:
            "(generations * 0.15) + (predation * 0.3) + (food * 0.2) - ((temp - 25) * (temp - 25) * 0.02)",
          outputLabel: "population fitness",
          outputUnit: "adaptation index",
          reflectionPrompt:
            "try to make the population perfectly adapted (high fitness). now suddenly change the temperature by 20 degrees. what happens to fitness? why can't you just 'fix' the organisms?",
        },
      },
      phase: "struggle",
      label: "shape: environmental pressures",
      timeLimit: 180,
      hints: [
        "high predation pressure selects for speed, camouflage, or toxicity",
        "sudden environmental changes cause fitness to crash",
        "evolution has no foresight — it can't prepare for future conditions",
      ],
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "sorting",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort these traits by whether natural selection can directly act on them.",
          cards: [
            {
              id: "fur-color",
              content: "fur color in arctic foxes",
              hint: "visible to predators and affects heat absorption",
            },
            {
              id: "mutation-rate",
              content: "DNA mutation rate",
              hint: "this affects future variation but isn't directly 'seen' by selection",
            },
            {
              id: "running-speed",
              content: "running speed in gazelles",
            },
            {
              id: "recessive-gene",
              content: "a recessive allele hidden in a carrier",
              hint: "it's present in DNA but not expressed in the body",
            },
            {
              id: "flower-scent",
              content: "flower scent that attracts pollinators",
            },
            {
              id: "junk-dna",
              content: "non-coding DNA with no known function",
              hint: "if it doesn't affect the organism, can selection 'see' it?",
            },
            {
              id: "beak-shape",
              content: "beak shape in darwin's finches",
            },
            {
              id: "blood-type",
              content: "blood type (A, B, AB, O) in most environments",
              hint: "in the absence of malaria, does blood type affect survival?",
            },
          ],
          categories: [
            {
              id: "visible",
              label: "directly selected",
              description:
                "trait affects survival or reproduction in the current environment",
            },
            {
              id: "neutral",
              label: "selectively neutral",
              description:
                "trait exists but doesn't currently affect fitness",
            },
            {
              id: "hidden",
              label: "hidden from selection",
              description:
                "trait is present in genome but not expressed or functional",
            },
          ],
          solution: {
            "fur-color": "visible",
            "running-speed": "visible",
            "flower-scent": "visible",
            "beak-shape": "visible",
            "blood-type": "neutral",
            "mutation-rate": "neutral",
            "recessive-gene": "hidden",
            "junk-dna": "hidden",
          },
        },
      },
      phase: "threshold",
      label: "sort: visible to selection",
      discussionPrompt: "which card sparked the most disagreement? blood type is tricky — it's neutral now but not during malaria outbreaks",
      timeLimit: 150,
      hints: [
        "selection can only act on traits that affect the organism's phenotype",
        "a recessive allele in a carrier doesn't affect the body",
        "some traits matter in one environment but not another",
      ],
      mechanic: {
        interactionModel: "investigation",
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
            "map the adaptation landscape. place pins for traits you explored in the sandbox — where do they fall in terms of how quickly they can be selected for and how much they improve fitness?",
          width: 800,
          height: 600,
          xLabel: "speed of adaptation (slow to fast)",
          yLabel: "fitness advantage (low to high)",
          zones: [
            {
              id: "quick-wins",
              label: "quick wins (fast adaptation, high payoff)",
              x: 500,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "slow-burn",
              label: "slow burn (slow adaptation, high payoff)",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "drift",
              label: "genetic drift zone (low payoff either way)",
              x: 200,
              y: 350,
              width: 400,
              height: 250,
            },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "integration",
      label: "map: adaptation landscape",
      timeLimit: 150,
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
            "the hardest thing about natural selection is that nobody is in charge. there's no designer, no plan, no direction. organisms don't 'try' to evolve. they just live, reproduce, and die — and the environment does the editing. why is it so hard for humans to accept a process with no intentional agent? where else do we see patterns without planners?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: why you can't direct evolution",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── express.ion ─────────────────────────────────────────────────
// fit → test → express | turn-based
// lock-and-key transcription factors, gene expression

export function expressIon(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "every cell in your body contains the same DNA. a neuron and a skin cell have identical genomes. approximately what percentage of genes are active in any given cell type?",
          type: "choice",
          options: [
            { id: "all", label: "~100% — all genes are always active" },
            { id: "most", label: "~70% — most genes are active" },
            { id: "some", label: "~20-30% — less than a third" },
            { id: "few", label: "~5% — only a tiny fraction" },
          ],
          answer: "some",
        },
      },
      phase: "encounter",
      label: "predict: gene activation",
      discussionPrompt: "most people overestimate the percentage. why does 'same DNA, different cell' feel counterintuitive?",
      timeLimit: 45,
      hints: [
        "a liver cell doesn't need to produce melanin",
        "a skin cell doesn't need to produce insulin",
        "most of the genome is silenced in any given cell type",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "puzzle",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "arrange the steps of gene expression in the correct order — from the initial signal to the final protein. this is how a gene goes from silent DNA to a working molecule.",
          pieces: [
            {
              id: "signal",
              content: "a signaling molecule reaches the cell surface",
              hint: "everything starts with a message from outside",
            },
            {
              id: "tf-bind",
              content:
                "a transcription factor binds to the gene's promoter region",
              hint: "the lock-and-key moment — the TF fits the DNA sequence",
            },
            {
              id: "rna-pol",
              content:
                "RNA polymerase attaches and transcribes DNA into mRNA",
              hint: "transcription = DNA → mRNA",
            },
            {
              id: "splice",
              content: "introns are spliced out of the mRNA",
              hint: "the editing step — removing non-coding regions",
            },
            {
              id: "translate",
              content: "ribosomes translate mRNA into a chain of amino acids",
              hint: "translation = mRNA → protein",
            },
            {
              id: "fold",
              content:
                "the protein folds into its functional 3D shape",
              hint: "shape determines function in biology",
            },
          ],
          solution: [
            "signal",
            "tf-bind",
            "rna-pol",
            "splice",
            "translate",
            "fold",
          ],
          revealOrder: true,
        },
      },
      phase: "struggle",
      label: "sequence: gene to protein",
      discussionPrompt: "where did people get stuck? the splicing step often catches people — why does the cell bother editing its own messages?",
      timeLimit: 150,
      hints: [
        "the central dogma: DNA → RNA → protein",
        "transcription factors are the gatekeepers",
        "splicing happens before the mRNA leaves the nucleus",
      ],
      mechanic: {
        interactionModel: "construction",
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
            "sort these regulatory mechanisms by whether they turn genes ON or OFF.",
          cards: [
            {
              id: "activator",
              content: "an activator protein binds to an enhancer sequence",
            },
            {
              id: "methylation",
              content: "DNA methylation adds chemical tags to a promoter",
              hint: "methylation is like putting tape over a lock",
            },
            {
              id: "acetylation",
              content: "histone acetylation loosens chromatin structure",
              hint: "loose chromatin = accessible DNA",
            },
            {
              id: "repressor",
              content: "a repressor protein blocks the promoter",
            },
            {
              id: "mirna",
              content: "a microRNA binds to mRNA and triggers its degradation",
              hint: "destroys the message before it can be translated",
            },
            {
              id: "hormone",
              content:
                "a steroid hormone enters the nucleus and activates a transcription factor",
            },
          ],
          categories: [
            {
              id: "on",
              label: "turns gene ON",
              description: "increases gene expression",
            },
            {
              id: "off",
              label: "turns gene OFF",
              description: "decreases or silences gene expression",
            },
          ],
          solution: {
            activator: "on",
            acetylation: "on",
            hormone: "on",
            methylation: "off",
            repressor: "off",
            mirna: "off",
          },
        },
      },
      phase: "threshold",
      label: "sort: on/off switches",
      timeLimit: 120,
      hints: [
        "think about whether each mechanism makes DNA more or less accessible",
        "methylation = silencing in most contexts",
        "acetylation = opening up",
      ],
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "you have ~20,000 genes. so does a fruit fly (~14,000) and a rice plant (~32,000). the number of genes doesn't determine complexity — what matters is how they're regulated. gene expression is why a caterpillar becomes a butterfly using the same DNA. what does this tell you about the relationship between potential (DNA) and expression (what actually happens)?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: expression over possession",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── web.pulse ───────────────────────────────────────────────────
// pull → cascade → dread | turn-based
// jenga-style species removal from food web

export function webPulse(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "in 1995, wolves were reintroduced to yellowstone after a 70-year absence. besides reducing elk populations, what unexpected large-scale change did the wolves cause?",
          type: "choice",
          options: [
            {
              id: "rivers",
              label: "rivers changed course and became more stable",
            },
            { id: "temp", label: "average temperature in the park dropped" },
            { id: "soil", label: "soil pH became more acidic" },
            { id: "nothing", label: "no changes beyond prey populations" },
          ],
          answer: "rivers",
        },
      },
      phase: "encounter",
      label: "predict: trophic cascades",
      discussionPrompt: "wolves changing rivers — who found that believable? what does it reveal about how far indirect effects can travel?",
      timeLimit: 60,
      hints: [
        "elk had been overgrazing riverbanks for decades without wolves",
        "plants stabilize riverbanks with their root systems",
        "this is called a 'trophic cascade' — effects that ripple down the food chain",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "puzzle",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "arrange the cascade events in order. the sea otters are removed from a kelp forest ecosystem. what happens step by step?",
          pieces: [
            {
              id: "hunt",
              content: "fur traders hunt sea otters to near-extinction",
              hint: "this is the triggering event",
            },
            {
              id: "urchin-boom",
              content:
                "sea urchin populations explode without their main predator",
              hint: "otters eat urchins — remove predator, prey booms",
            },
            {
              id: "kelp-die",
              content:
                "urchins devour kelp forests, creating 'urchin barrens'",
              hint: "urchins graze kelp — too many urchins = no kelp",
            },
            {
              id: "fish-leave",
              content:
                "fish and invertebrates that depended on kelp habitat disappear",
              hint: "kelp forests are nurseries for hundreds of species",
            },
            {
              id: "coast-erode",
              content:
                "without kelp to dampen waves, coastal erosion accelerates",
              hint: "kelp forests break wave energy before it hits shore",
            },
          ],
          solution: [
            "hunt",
            "urchin-boom",
            "kelp-die",
            "fish-leave",
            "coast-erode",
          ],
          revealOrder: true,
        },
      },
      phase: "struggle",
      label: "sequence: cascade effects",
      timeLimit: 150,
      hints: [
        "start with the removal event and follow the chain",
        "each step removes something that the next species depends on",
        "the final effect is geological, not biological",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
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
            "each of you is a different species in a coral reef food web. you don't know the full web — only your own connections. you'll discover how connected you are when the facilitator removes one species.",
          roles: [
            {
              id: "coral",
              label: "coral polyp",
              info: "you are a coral colony. you depend on symbiotic algae (zooxanthellae) for 90% of your energy through photosynthesis. you provide habitat structure for over 25% of all marine species. parrotfish graze algae off your surface, keeping you healthy. without parrotfish, algae overgrows and smothers you.",
              question:
                "if parrotfish are removed, how long do you survive? what happens to everyone who lives in you?",
            },
            {
              id: "parrotfish",
              label: "parrotfish",
              info: "you eat algae off coral surfaces and excrete sand — you literally create beaches. a single parrotfish produces ~100 kg of sand per year. you depend on coral for shelter at night (you sleep in mucus cocoons in coral crevices). groupers prey on you, keeping your population in check.",
              question:
                "if groupers are removed, your population booms — sounds good, right? what's the catch?",
            },
            {
              id: "grouper",
              label: "nassau grouper",
              info: "you are an apex predator of the reef. you eat parrotfish, wrasses, and smaller fish. you keep herbivore populations balanced. humans have overfished your species by 80% — you are critically endangered. your spawning aggregations happen once per year at specific reef sites.",
              question:
                "if your species goes extinct, how does the reef change in 5 years? in 50 years?",
            },
            {
              id: "cleaner",
              label: "cleaner wrasse",
              info: "you run a 'cleaning station' on the reef. larger fish visit you to have parasites removed — you eat the parasites. over 100 species depend on your cleaning service. experiments show that when you're removed from a reef, fish diversity drops by 50% within 18 months because parasites spread unchecked.",
              question:
                "you're a tiny fish that eats parasites. why would your removal be more devastating than removing a large predator?",
            },
          ],
          discussionPrompt:
            "the facilitator removes the cleaner wrasse. go around and explain what happens to your species. how far does the cascade reach? who dies last?",
          revealPrompt:
            "keystone species are not always the biggest or most obvious. the cleaner wrasse is tiny but its removal collapses the entire reef. in ecology, importance is about connections, not size.",
        },
      },
      phase: "threshold",
      label: "inhabit: the web",
      timeLimit: 240,
      hints: [
        "think about your dependencies — what do you need to survive?",
        "think about your dependents — who needs you?",
        "the most connected species is the most critical",
      ],
      mechanic: {
        interactionModel: "negotiation",
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
            "which species should we protect first if we can only save one?",
          options: [
            {
              id: "coral",
              label: "coral — the habitat foundation",
            },
            {
              id: "parrotfish",
              label: "parrotfish — the algae controllers",
            },
            {
              id: "grouper",
              label: "grouper — the apex regulator",
            },
            {
              id: "cleaner",
              label: "cleaner wrasse — the network hub",
            },
          ],
        },
      },
      phase: "integration",
      label: "vote: who to save",
      discussionPrompt: "look at the vote split — did the asymmetric role exercise change who people wanted to protect? anyone vote for their own species?",
      timeLimit: 60,
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "ecosystems are networks, not hierarchies. removing one node can collapse the whole structure — or nothing happens at all, depending on how connected that node is. in your own life, what relationships or systems are more interconnected than they appear? what 'cleaner wrasse' is quietly holding something together?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: interconnectedness",
      timeLimit: 210,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── emerge.box ──────────────────────────────────────────────────
// define → observe → emerge | real-time
// toggle cells, cellular automata emergence

export function emergeBox(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "conway's game of life has only 4 rules: a live cell with 2-3 neighbors survives, a dead cell with exactly 3 neighbors comes alive, all other cells die. from these 4 simple rules, what is the most complex thing that has been built?",
          type: "choice",
          options: [
            { id: "shapes", label: "repeating geometric patterns" },
            {
              id: "computer",
              label: "a fully functional digital computer",
            },
            { id: "gliders", label: "objects that move across the grid" },
            { id: "random", label: "only random-looking noise" },
          ],
          answer: "computer",
        },
      },
      phase: "encounter",
      label: "predict: emergent complexity",
      discussionPrompt: "a computer from four rules — who believed it before the reveal? what's the gap between 'simple rules' and 'complex output' in your mental model?",
      timeLimit: 45,
      hints: [
        "people have been studying the game of life since 1970",
        "turing completeness means 'can compute anything a real computer can'",
        "gliders were discovered first, but they're just the beginning",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "explore how simple automata rules create different behaviors. adjust the birth and survival thresholds to discover different 'worlds.' some rules create chaos, some create order, and some create the edge between them — where emergence lives.",
          parameters: [
            {
              id: "birth",
              label: "birth threshold (neighbors needed to spawn)",
              min: 1,
              max: 8,
              step: 1,
              defaultValue: 3,
            },
            {
              id: "surviveMin",
              label: "minimum neighbors to survive",
              min: 0,
              max: 8,
              step: 1,
              defaultValue: 2,
            },
            {
              id: "surviveMax",
              label: "maximum neighbors to survive",
              min: 0,
              max: 8,
              step: 1,
              defaultValue: 3,
            },
            {
              id: "density",
              label: "initial population density",
              min: 5,
              max: 95,
              step: 5,
              defaultValue: 50,
              unit: "%",
            },
          ],
          formula:
            "(birth * 10) + ((surviveMax - surviveMin) * 15) + (density * 0.3)",
          outputLabel: "complexity index",
          outputUnit: "bits",
          reflectionPrompt:
            "find the settings where the complexity index is highest. these are the 'edge of chaos' rules — not too stable, not too chaotic. why might emergence require this balance?",
        },
      },
      phase: "struggle",
      label: "toggle: automata rules",
      timeLimit: 180,
      hints: [
        "conway's original rules are birth=3, survive=2-3",
        "try birth=1, survive=0-8 — what happens? (everything stays alive)",
        "the 'edge of chaos' is where interesting behavior happens",
      ],
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "canvas",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "map the rule-space you explored. place a pin for each rule combination you tried. was the behavior dead (everything dies), chaotic (random noise), periodic (repeating), or complex (structured but unpredictable)?",
          width: 800,
          height: 600,
          xLabel: "order (stable/dead) to chaos (random/explosive)",
          yLabel: "complexity (simple to structured)",
          zones: [
            {
              id: "dead",
              label: "dead zone (everything dies quickly)",
              x: 0,
              y: 400,
              width: 250,
              height: 200,
            },
            {
              id: "edge",
              label: "edge of chaos (emergence happens here)",
              x: 275,
              y: 0,
              width: 250,
              height: 250,
            },
            {
              id: "chaos",
              label: "chaos (random noise, no structure)",
              x: 550,
              y: 400,
              width: 250,
              height: 200,
            },
            {
              id: "periodic",
              label: "periodic (stable repeating patterns)",
              x: 0,
              y: 0,
              width: 250,
              height: 200,
            },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: emergence zones",
      timeLimit: 150,
      hints: [
        "conway's rules live at the edge of chaos",
        "too few survival neighbors = death, too many = chaos",
        "the most interesting behavior is neither orderly nor random",
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
            "four rules. that's all it takes to produce something as complex as a computer. your brain has ~86 billion neurons, each following simple electrochemical rules — yet consciousness emerges. ant colonies, economies, languages, and weather all emerge from simple local interactions with no central controller. what's something in your life that seems intentionally designed but might actually be emergent — arising from simple rules with no one in charge?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: simple rules, complex worlds",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}
