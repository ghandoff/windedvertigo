import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── ought.machine ───────────────────────────────────────────────
// argue -> expose -> revise | paced
// socratic debate engine — moral reasoning

export function oughtMachine(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "the trolley problem was introduced by philippa foot (1967) and refined by judith jarvis thomson (1985). in surveys across 233 countries, awad et al. (2018) in the 'moral machine experiment' found cross-cultural variation in moral intuitions. what percentage of respondents across all cultures chose to divert the trolley (pulling the switch to save five, killing one)?",
          type: "number",
          answer: 81,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: universal moral intuitions",
      discussionPrompt: "81% pull the switch — but the footbridge version (pushing someone) drops to ~50%. same math, different action. what's the moral difference between pulling a lever and using your hands?",
      timeLimit: 60_000,
      hints: [
        "the switch version gets much higher agreement than the footbridge version (pushing someone)",
        "most cultures favor action, but the margin varies significantly",
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
            "a pharmaceutical company has developed a life-saving drug at enormous cost. they price it at $80,000 per treatment. a generic manufacturer in india can produce the same drug for $200. the company says the price funds future research. patients are dying who could afford the generic but not the branded version. should the patent be enforced?",
          roles: [
            {
              id: "utilitarian",
              label: "utilitarian",
              info: "you argue from the tradition of bentham and mill — the right action is the one that produces the greatest good for the greatest number. peter singer's effective altruism applies this rigorously: if the generic saves 10,000 lives at the cost of reduced future R&D that might save 2,000, the calculation is clear. but rule utilitarianism (mill) warns that breaking patents as a rule could collapse pharmaceutical investment entirely, causing far more harm long-term.",
              question:
                "argue for the position that maximizes total well-being. show your calculation — who benefits, who suffers, and what's the net?",
            },
            {
              id: "deontologist",
              label: "deontologist",
              info: "you argue from kant's categorical imperative: act only according to rules you could will to be universal laws. kant would ask: can we universalize patent violation? if everyone broke patents when lives were at stake, the institution of intellectual property collapses. but kant also insisted on treating people as ends in themselves, never merely as means. pricing a drug beyond reach treats patients as means to profit. you are caught between two kantian duties.",
              question:
                "which duty wins — respect for the system of rights, or respect for persons? argue from principle, not consequences.",
            },
            {
              id: "virtue-ethicist",
              label: "virtue ethicist",
              info: "you argue from aristotle's question: what would a virtuous person do? virtue ethics doesn't ask about rules or outcomes but about character. the virtuous pharmaceutical executive cultivates justice, temperance, and practical wisdom (phronesis). alasdair macintyre (1981) argued that modern capitalism makes virtue ethics nearly impossible because institutions optimize for profit, not flourishing. the question isn't what's right — it's what kind of person do you become by choosing?",
              question:
                "forget the rules and the numbers. what does a good person do here, and what character does each choice build?",
            },
            {
              id: "care-ethicist",
              label: "care ethicist",
              info: "you argue from the ethics of care, developed by carol gilligan (1982) and nel noddings (1984). moral reasoning isn't abstract — it's relational. the question isn't about rights or utility but about who is vulnerable and who has the power to respond. care ethics centers the concrete other, not the generalized other. a dying patient isn't a number in a utilitarian calculation — they're someone's parent, child, friend. the pharmaceutical company exists in a web of relationships it cannot abstract away from.",
              question:
                "who is vulnerable here? who has the power to care? what does responsibility look like when you see faces instead of numbers?",
            },
          ],
          discussionPrompt:
            "you were assigned a position you may not personally hold. did arguing from it change how you see it? kohlberg's stages of moral development suggest most adults reason at the 'conventional' level — following rules and social norms. post-conventional reasoning requires holding multiple frameworks simultaneously. can you?",
          revealPrompt:
            "there is no correct moral framework. rawls argued for justice as fairness; nozick argued for liberty as inviolable. the point isn't to win but to notice which framework you instinctively reached for — and what that reveals about your moral foundations.",
        },
      },
      phase: "struggle",
      label: "argue: the position you don't hold",
      timeLimit: 240_000,
      hints: [
        "argue as if you genuinely believe this position",
        "the strongest argument is the one that makes the other side uncomfortable",
      ],
      mechanic: {
        interactionModel: "negotiation",
        socialStructure: "asymmetric",
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
            "reconstruct this famous philosophical argument by arranging the premises in logical order. the argument is valid — each step follows from the previous. but is it sound? (validity = the logic works; soundness = the premises are also true.)",
          pieces: [
            {
              id: "p1",
              content: "if we can prevent suffering without sacrificing anything of comparable moral importance, we ought to do it",
              hint: "this is the foundational premise — peter singer's principle of preventing bad occurrences",
            },
            {
              id: "p2",
              content: "absolute poverty causes immense suffering",
              hint: "this is an empirical premise — verifiable by data",
            },
            {
              id: "p3",
              content: "donating a significant portion of income to effective charities prevents suffering caused by absolute poverty",
              hint: "this connects the empirical fact to the capacity for action",
            },
            {
              id: "p4",
              content: "for most people in affluent nations, donating a significant portion of income does not sacrifice anything of comparable moral importance",
              hint: "this is the most contested premise — what counts as 'comparable moral importance'?",
            },
            {
              id: "c",
              content: "therefore, most people in affluent nations ought to donate a significant portion of their income to effective charities",
              hint: "the conclusion follows necessarily if all premises are accepted",
            },
          ],
          solution: ["p1", "p2", "p3", "p4", "c"],
          revealOrder: true,
        },
      },
      phase: "threshold",
      label: "sequence: singer's argument",
      discussionPrompt: "the argument is logically valid — if you accept all premises, the conclusion follows. which premise do you reject, and why? that's where your moral philosophy lives",
      timeLimit: 150_000,
      hints: [
        "start with the most general principle, then add specifics",
        "the conclusion should be the last piece",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
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
            "now that you've argued a position you didn't choose and reconstructed a formal argument — which moral framework do you actually find most compelling for the pharmaceutical case?",
          options: [
            {
              id: "utilitarian",
              label: "utilitarian — maximize total well-being",
            },
            {
              id: "deontological",
              label: "deontological — respect rights and duties",
            },
            {
              id: "virtue",
              label: "virtue ethics — cultivate good character",
            },
            { id: "care", label: "care ethics — respond to vulnerability" },
            {
              id: "pluralist",
              label: "moral pluralism — no single framework is sufficient",
            },
          ],
        },
      },
      phase: "integration",
      label: "vote: where you actually stand",
      discussionPrompt: "did anyone's vote change from what they would have picked before the debate? if 'moral pluralism' won — is that wisdom or evasion?",
      timeLimit: 45_000,
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
            "haidt (2001) proposed the social intuitionist model: moral judgments are made by gut feeling first, and reasoning comes second as post-hoc justification. you just spent 20 minutes reasoning carefully about ethics. did it change your intuition, or did you find better arguments for what you already felt? be honest. and consider: if moral reasoning is mostly rationalization, does that make philosophy useless — or more important than ever?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: reason vs. intuition",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── circle.read ─────────────────────────────────────────────────
// discover -> reread -> reframe | paced
// detective noir — hermeneutic circle, iterative reinterpretation

export function circleRead(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "gadamer (1960) argued that we can never read a text without prejudice — our 'horizon of understanding' always shapes interpretation. he called the merging of the reader's horizon with the text's horizon a 'fusion of horizons.' fish (1980) went further: the meaning of a text is entirely created by its 'interpretive community.' what percentage of literary scholars today identify as some form of reader-response theorist (believing meaning is co-created by reader and text)?",
          type: "number",
          answer: 42,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: who makes meaning?",
      timeLimit: 60_000,
      hints: [
        "the field is roughly split between those who locate meaning in the text, the reader, or the interaction",
        "pure authorial intent ('what did the writer mean?') has been in decline since barthes declared the author dead in 1967",
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
            "the hermeneutic circle says: you can't understand the parts without the whole, and you can't understand the whole without the parts. arrange these layers of interpretation in the order you'd encounter them when reading a difficult text. there is no single correct order — but the sequence you choose reveals whether you read bottom-up (parts first) or top-down (whole first). schleiermacher (1838) called this the 'grammatical' vs. 'psychological' reading.",
          pieces: [
            {
              id: "surface",
              content: "surface reading — what do the words literally say?",
              hint: "the most basic layer, but even here you're already interpreting: word meanings shift over time",
            },
            {
              id: "structure",
              content: "structural reading — how is the text organized? what patterns emerge?",
              hint: "repetition, contrast, sequence — the architecture of the argument",
            },
            {
              id: "context",
              content: "contextual reading — when and where was this written? what was happening?",
              hint: "foucault's archaeology of knowledge: every text is embedded in power structures",
            },
            {
              id: "subtextual",
              content: "subtextual reading — what is not said? what is assumed or suppressed?",
              hint: "derrida's deconstruction: the absences in a text are as meaningful as the presences",
            },
            {
              id: "personal",
              content: "personal reading — what does this text mean to me, now, here?",
              hint: "rosenblatt's transactional theory (1978): every reading is a unique event between reader and text",
            },
          ],
          solution: ["surface", "structure", "context", "subtextual", "personal"],
          revealOrder: false,
        },
      },
      phase: "struggle",
      label: "arrange: layers of reading",
      discussionPrompt: "compare sequences — who started with surface reading and who jumped to personal? the order you chose reveals whether you read bottom-up or top-down",
      timeLimit: 120_000,
      hints: [
        "there's no wrong order — the point is to notice your sequence",
        "do you start with yourself or with the text?",
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
            "consider this passage: 'we hold these truths to be self-evident, that all men are created equal, that they are endowed by their creator with certain unalienable rights, that among these are life, liberty and the pursuit of happiness.' — declaration of independence, 1776. each of you reads this through a different philosophical lens.",
          roles: [
            {
              id: "historicist",
              label: "historicist",
              info: "you read with dilthey and gadamer: a text must be understood in its historical horizon. in 1776, 'all men' meant propertied white males. jefferson owned 600+ enslaved people. 'self-evident' was a rhetorical strategy borrowed from scottish common sense philosophy (reid, hutcheson). the text meant something specific to its authors, and reading our values back onto it is anachronistic. understanding requires entering the historical world of the text.",
              question:
                "what did these words mean in 1776? what could they not have meant? where does the historical horizon constrain interpretation?",
            },
            {
              id: "deconstructionist",
              label: "deconstructionist",
              info: "you read with derrida: every text contains the seeds of its own undoing. 'all men are created equal' is immediately undermined by who was excluded — enslaved people, women, indigenous peoples. the word 'self-evident' does the most work: it forecloses argument by declaring itself beyond question. derrida would call this a 'metaphysics of presence' — the text claims to contain a truth that was already there before language. but no truth is self-evident; everything is constructed.",
              question:
                "where does the text contradict itself? what does 'self-evident' conceal? what happens when you pull at the loose threads?",
            },
            {
              id: "pragmatist",
              label: "pragmatist",
              info: "you read with rorty and dewey: the meaning of a text is not what it originally meant or what it logically entails, but what it lets us do. rorty (1989) argued we should stop asking 'is it true?' and ask 'is it useful?' the declaration has been used to justify abolition, women's suffrage, civil rights, marriage equality — applications jefferson never imagined. the text is a tool, not a monument. its meaning is its use across time.",
              question:
                "forget what it meant then. what can it do now? how has this text been used, and what new uses remain available?",
            },
            {
              id: "phenomenologist",
              label: "phenomenologist",
              info: "you read with husserl and merleau-ponty: bracket everything you know about this text and encounter it as if for the first time. the phenomenological reduction (epoche) asks you to suspend all assumptions — historical context, authorial intent, political meaning. what is the lived experience of reading these words? what shows up when you strip away everything you've been told about them? ricoeur called this 'the second naivete' — a return to direct experience after critical analysis.",
              question:
                "read the words fresh. what do you experience? what resonates in your body? what shows up when you stop analyzing?",
            },
          ],
          discussionPrompt:
            "four readings of the same 35 words. each reveals something the others miss. each conceals something the others reveal. is any reading more valid than the others? or is the hermeneutic circle itself the point — that understanding is never finished, only deepened?",
          revealPrompt:
            "gadamer said: 'the task of hermeneutics is not to develop a procedure of understanding, but to clarify the conditions in which understanding takes place.' you just experienced those conditions.",
        },
      },
      phase: "threshold",
      label: "read: four lenses on thirty-five words",
      timeLimit: 240_000,
      hints: [
        "stay in your assigned lens, even if it feels limiting",
        "the constraints are the point — they reveal what each framework illuminates and obscures",
      ],
      mechanic: {
        interactionModel: "investigation",
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
            "after hearing all four readings, write your own interpretation of the passage. you now carry all four lenses — historicist, deconstructionist, pragmatist, phenomenologist. what do you see that you couldn't see before? this is the hermeneutic circle in action: you cannot un-read what you've read. your horizon has shifted.",
          responseType: "text",
          anonymous: false,
        },
      },
      phase: "integration",
      label: "reread: the fused horizon",
      timeLimit: 180_000,
      mechanic: {
        interactionModel: "framing",
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
            "ricoeur (1970) distinguished between the 'hermeneutics of faith' (reading to recover meaning) and the 'hermeneutics of suspicion' (reading to unmask hidden forces — marx, nietzsche, freud). most of us default to one mode. which do you default to — trust or suspicion? and here's the deeper question: when you read other people (not just texts), do you read for meaning or read for motive? is there a difference?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: faith or suspicion?",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── lens.shift ──────────────────────────────────────────────────
// swap -> see -> compare | paced
// camera filters — phenomenology and perception

export function lensShift(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "the sapir-whorf hypothesis (strong version) claims language determines thought. kay & kempton (1984) showed that speakers of languages with different color boundaries literally perceive colors differently. the hopi language controversy aside, boroditsky (2011) found that mandarin speakers (who use vertical metaphors for time) are faster at verifying temporal statements presented vertically. how many languages did boroditsky's team test across their body of perception research?",
          type: "number",
          answer: 14,
          unit: "languages",
        },
      },
      phase: "encounter",
      label: "predict: language shapes reality",
      timeLimit: 60_000,
      hints: [
        "boroditsky's lab at stanford has studied perception across many language families",
        "the research spans both indo-european and non-indo-european languages",
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
            "a student sits in a lecture hall. they haven't spoken in three weeks of class. today, the professor calls on them. they stand, say nothing for five seconds, then sit back down. the class goes quiet.",
          roles: [
            {
              id: "pragmatist",
              label: "pragmatist",
              info: "you see through william james and john dewey. pragmatism asks: what difference does this make in practice? truth is what works. james said 'the true is the name of whatever proves itself to be good in the way of belief.' the student's silence is only meaningful in terms of its consequences — what happened next? did it change anything? dewey would focus on the educational environment: what kind of classroom produces three weeks of silence?",
              question:
                "what are the practical consequences of this moment? what does it change? what system produced it?",
            },
            {
              id: "existentialist",
              label: "existentialist",
              info: "you see through sartre and beauvoir. existence precedes essence — the student is not defined by this moment unless they choose to be. sartre's radical freedom means even in this situation, the student chose: chose to stand, chose silence, chose to sit. beauvoir would add: freedom is always situated — what structures of power, gender, race, or class constrain this 'free' choice? bad faith is pretending you had no choice. authentic existence is owning the choice you made.",
              question:
                "was this an act of freedom or unfreedom? what did the student choose, and what chose them?",
            },
            {
              id: "rationalist",
              label: "rationalist",
              info: "you see through descartes and leibniz. knowledge comes from reason, not experience. the rationalist asks: what can we know with certainty about this situation? almost nothing. we cannot access the student's mental states (the problem of other minds). we cannot know their reasons (the underdetermination of behavior by intention). descartes' method of doubt: strip away everything uncertain. what remains? only that something happened, and we witnessed it.",
              question:
                "what can we know for certain here? what are we assuming? apply radical doubt to every interpretation.",
            },
            {
              id: "empiricist",
              label: "empiricist",
              info: "you see through hume and locke. all knowledge comes from sensory experience. hume's fork: we can know 'relations of ideas' (logic, math) or 'matters of fact' (observation). this situation gives us only matters of fact: behaviors observed in sequence. hume's problem of induction means we cannot generalize from this single event. and hume's is-ought gap means we cannot move from what happened to what should have happened. the empiricist catalogs observations and resists conclusions.",
              question:
                "describe only what was observed. what inferences are you tempted to make, and why can't you justify them?",
            },
          ],
          discussionPrompt:
            "four philosophical traditions, one five-second silence. the pragmatist asks 'so what?', the existentialist asks 'who chose?', the rationalist asks 'what do we know?', the empiricist asks 'what did we see?' these aren't just academic positions — they're the lenses you use every day without naming them.",
          revealPrompt:
            "nagel (1974) asked 'what is it like to be a bat?' we can't know. we also can't fully know what it was like to be that student. every philosophical lens reveals and conceals. the question is which concealment you can live with.",
        },
      },
      phase: "struggle",
      label: "view: four philosophies of silence",
      timeLimit: 240_000,
      hints: [
        "stay in your tradition — even if another lens feels more natural",
        "the constraints reveal what each tradition can and cannot see",
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
            "sort these philosophical claims into the tradition they belong to. each tradition has a characteristic way of framing questions about knowledge, reality, and meaning.",
          cards: [
            {
              id: "cogito",
              content: "'i think, therefore i am' — the only indubitable foundation for knowledge",
              hint: "descartes' methodological doubt arrives at the one thing that cannot be doubted",
            },
            {
              id: "utility",
              content: "'the truth of an idea is not a stagnant property. truth happens to an idea. it becomes true, is made true by events'",
              hint: "truth as something that works, not something found",
            },
            {
              id: "tabula-rasa",
              content: "'there is nothing in the intellect that was not first in the senses'",
              hint: "locke's blank slate — all knowledge derives from experience",
            },
            {
              id: "nausea",
              content: "'existence precedes essence — we are condemned to be free'",
              hint: "freedom as both gift and burden",
            },
            {
              id: "innate",
              content: "'the mind has innate ideas that experience merely occasions, not creates'",
              hint: "some knowledge is prior to experience — mathematical truths, logical principles",
            },
            {
              id: "cash-value",
              content: "'the practical difference a proposition makes is its entire meaning'",
              hint: "peirce's pragmatic maxim: meaning = practical consequences",
            },
            {
              id: "custom",
              content: "'custom is the great guide of human life — reason alone cannot establish causal connections'",
              hint: "hume's insight that our belief in cause and effect is habit, not logic",
            },
            {
              id: "absurd",
              content: "'one must imagine sisyphus happy'",
              hint: "camus on finding meaning through defiance of meaninglessness",
            },
          ],
          categories: [
            {
              id: "rationalism",
              label: "rationalism",
              description: "knowledge through reason; innate ideas; certainty through logic",
            },
            {
              id: "empiricism",
              label: "empiricism",
              description: "knowledge through experience; observation; skepticism about unobservables",
            },
            {
              id: "pragmatism",
              label: "pragmatism",
              description: "truth is what works; meaning is practical consequence",
            },
            {
              id: "existentialism",
              label: "existentialism",
              description: "radical freedom; authentic choice; meaning is made, not found",
            },
          ],
          solution: {
            cogito: "rationalism",
            utility: "pragmatism",
            "tabula-rasa": "empiricism",
            nausea: "existentialism",
            innate: "rationalism",
            "cash-value": "pragmatism",
            custom: "empiricism",
            absurd: "existentialism",
          },
        },
      },
      phase: "threshold",
      label: "sort: claims to traditions",
      discussionPrompt: "the camus quote — 'one must imagine sisyphus happy' — did anyone sort it wrong? existentialism and absurdism overlap but diverge on whether meaning is chosen or defied",
      timeLimit: 180_000,
      hints: [
        "ask yourself: where does this claim locate truth — in the mind, the senses, consequences, or choice?",
        "rationalism and empiricism disagree about where knowledge comes from; pragmatism and existentialism disagree about what it's for",
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
            "place a pin where your natural philosophical orientation falls. the x-axis ranges from 'knowledge comes from reason' to 'knowledge comes from experience.' the y-axis ranges from 'truth is discovered' to 'truth is constructed.' there are no wrong positions — but your position has consequences for how you live, decide, and relate to uncertainty.",
          width: 600,
          height: 600,
          xLabel: "source of knowledge (reason <-> experience)",
          yLabel: "nature of truth (discovered <-> constructed)",
          zones: [
            {
              id: "rationalist",
              label: "rationalist zone",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "empiricist",
              label: "empiricist zone",
              x: 300,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "idealist",
              label: "constructivist zone",
              x: 0,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "pragmatist",
              label: "pragmatist zone",
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
      label: "map: your epistemic home",
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
            "isaiah berlin (1953) distinguished between hedgehogs (who know one big thing) and foxes (who know many things). most people default to one philosophical lens — one way of cutting reality. but nagel (1986) argued in 'the view from nowhere' that objectivity requires recognizing the limits of every view, including your own. after seeing four lenses applied to the same moment, what is your default lens? what does it help you see clearly — and what does it systematically hide? can you name a moment in your life where switching lenses would have changed your understanding?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the cost of clarity",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── liminal.pass ────────────────────────────────────────────────
// puzzle -> cross -> name | paced
// mixed-mechanic meta-game about liminality and threshold concepts

export function liminalPass(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "meyer & land (2003) introduced the idea of 'threshold concepts' — ideas that, once understood, irreversibly transform how you think. they identified five characteristics: transformative, irreversible, integrative, bounded, and troublesome. in their survey of academics across disciplines, what percentage reported that their field had identifiable threshold concepts that students either 'get' or 'don't get' with very little middle ground?",
          type: "number",
          answer: 89,
          unit: "%",
        },
      },
      phase: "encounter",
      label: "predict: the threshold landscape",
      timeLimit: 60_000,
      hints: [
        "nearly every discipline has concepts that act as gateways to expert thinking",
        "examples: opportunity cost in economics, natural selection in biology, recursion in computer science",
      ],
      mechanic: {
        interactionModel: "reveal",
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
            "sort these concepts: which are genuine threshold concepts (transformative, irreversible, integrative) and which are important-but-not-threshold (learnable, forgettable, non-transformative)? meyer & land's criteria: once you understand a threshold concept, you can't go back to not understanding it, and it changes how you see everything else in the field.",
          cards: [
            {
              id: "opportunity-cost",
              content: "opportunity cost — every choice has a hidden price: the best alternative you gave up",
              hint: "economists think about this constantly; non-economists almost never do. once you see it, you can't unsee it.",
            },
            {
              id: "quadratic",
              content: "the quadratic formula — a procedure for solving ax² + bx + c = 0",
              hint: "useful but procedural — you can learn it, use it, and forget it without your worldview changing",
            },
            {
              id: "natural-selection",
              content: "natural selection — differential survival and reproduction based on heritable variation",
              hint: "darwin's 'dangerous idea' (dennett, 1995): once understood, it explains everything from antibiotic resistance to culture",
            },
            {
              id: "dates",
              content: "memorizing historical dates — 1066, 1492, 1776",
              hint: "important as scaffolding, but knowing dates doesn't transform historical thinking",
            },
            {
              id: "object-permanence",
              content: "object permanence — things continue to exist when you can't see them",
              hint: "piaget showed infants develop this around 8 months; once acquired, it restructures all spatial reasoning",
            },
            {
              id: "periodic-table",
              content: "memorizing the periodic table of elements",
              hint: "useful reference knowledge, but memorization ≠ understanding chemical periodicity",
            },
            {
              id: "entropy",
              content: "entropy — disorder always increases in closed systems; time has a direction",
              hint: "transforms understanding of physics, information theory, biology, and even economics",
            },
            {
              id: "grammar-rules",
              content: "grammar rules — subject-verb agreement, comma placement",
              hint: "important for writing, but procedural and not worldview-changing",
            },
          ],
          categories: [
            {
              id: "threshold",
              label: "threshold concepts",
              description: "transformative, irreversible, integrative — once crossed, no going back",
            },
            {
              id: "not-threshold",
              label: "important but not threshold",
              description: "useful knowledge that can be learned and forgotten without transformation",
            },
          ],
          solution: {
            "opportunity-cost": "threshold",
            quadratic: "not-threshold",
            "natural-selection": "threshold",
            dates: "not-threshold",
            "object-permanence": "threshold",
            "periodic-table": "not-threshold",
            entropy: "threshold",
            "grammar-rules": "not-threshold",
          },
        },
      },
      phase: "struggle",
      label: "sort: threshold or not?",
      discussionPrompt: "the quadratic formula vs opportunity cost — one is forgettable, one is irreversible. what makes the difference? ask who's been changed by a concept and can't go back",
      timeLimit: 180_000,
      hints: [
        "ask: can you un-learn this? does understanding it change how you see other things?",
        "threshold concepts are about transformation, not difficulty — some are easy to grasp but impossible to reverse",
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
            "van gennep (1909) identified three stages of passage: separation (leaving the old), liminality (the in-between), and incorporation (arriving in the new). turner (1969) showed that liminality is characterized by ambiguity, disorientation, and the dissolution of identity — 'betwixt and between.' place a pin for a liminal space you've inhabited: how disorienting was it, and how transformative was the crossing?",
          width: 600,
          height: 600,
          xLabel: "disorientation (comfortable <-> profoundly disorienting)",
          yLabel: "transformation (unchanged <-> fundamentally changed)",
          zones: [
            {
              id: "routine",
              label: "routine transition (new job, new city)",
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "crisis",
              label: "crisis without transformation",
              x: 300,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: "gradual",
              label: "gradual metamorphosis",
              x: 0,
              y: 300,
              width: 300,
              height: 300,
            },
            {
              id: "liminal",
              label: "true liminality (the threshold)",
              x: 300,
              y: 300,
              width: 300,
              height: 300,
            },
          ],
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: your liminal spaces",
      timeLimit: 120_000,
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
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
            "name one threshold you've crossed — a concept, experience, or realization that irreversibly changed how you understand something. meyer & land say threshold concepts are 'troublesome knowledge' — they feel wrong before they feel right, and the crossing is often marked by a period of confusion (the liminal state) before the new understanding consolidates. what was the liminal state like? what did the world look like on the other side?",
          responseType: "text",
          anonymous: false,
        },
      },
      phase: "integration",
      label: "name: a threshold crossed",
      discussionPrompt: "read a few responses aloud — look for the common thread. most thresholds involve a moment where the old way of seeing became impossible. what triggered the crossing?",
      timeLimit: 180_000,
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
            "here's the meta-threshold: the concept of threshold concepts is itself a threshold concept. once you see that learning is not gradual accumulation but a series of irreversible crossings, you can't go back to thinking of education as information transfer. kierkegaard called this a 'leap' — the gap between understanding something intellectually and being transformed by it. what threshold are you standing at right now — in your work, your thinking, your life — that you haven't yet crossed? what's holding you at the edge? and what might the world look like from the other side?",
          minLength: 120,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the edge you're standing on",
      timeLimit: 240_000,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}
