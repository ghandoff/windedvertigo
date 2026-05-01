import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── fold.space ──────────────────────────────────────────────────
// gestural origami — topology through folding
// fold → crease → reveal, paced

export function foldSpace(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: fold geometry",
      discussionPrompt: "most people guess more than 2 pieces — why does folding make us overestimate? what does the symmetry of the fold do to the cut?",
      config: {
        type: "prediction",
        prediction: {
          question:
            "take a square piece of paper and fold it in half, then in half again, then cut a single straight line through the folded corner. when you unfold, how many separate pieces do you have?",
          type: "number",
          answer: 2,
          unit: "pieces",
        },
      },
      timeLimit: 60,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: origami crane",
      discussionPrompt: "the petal fold is where most people get lost — it's a 3D operation described in 2D words. what does that say about the limits of verbal instructions for spatial tasks?",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "the traditional origami crane has a precise fold sequence. each fold creates geometric structure the next fold depends on. put these folds in the correct order:",
          pieces: [
            {
              id: "square-diagonal",
              content: "fold the square diagonally to form a triangle",
              hint: "every origami base starts with orientation",
            },
            {
              id: "preliminary",
              content: "collapse into a preliminary base (square with open end down)",
              hint: "this is the foundation — four flaps meeting at a point",
            },
            {
              id: "petal-fold",
              content: "petal fold both sides — lift the top flap and flatten along creases",
              hint: "this creates the long diamond shape",
            },
            {
              id: "narrow",
              content: "fold the lower edges of the diamond to the center crease",
              hint: "this narrows the form for the neck and tail",
            },
            {
              id: "reverse-fold",
              content: "reverse fold two legs upward to form neck and tail",
              hint: "the legs invert inside themselves",
            },
            {
              id: "head",
              content: "reverse fold the tip of the neck to form the head",
              hint: "one more inversion creates the beak",
            },
          ],
          solution: ["square-diagonal", "preliminary", "petal-fold", "narrow", "reverse-fold", "head"],
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "canvas",
      phase: "threshold",
      label: "map: symmetry axes",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "you're looking at a flattened crane crease pattern — a square covered in fold lines. place pins where you see axes of symmetry. how many distinct axes does a crane crease pattern have? mark each one you find.",
          width: 100,
          height: 100,
          xLabel: "← left edge — right edge →",
          yLabel: "↑ top edge — bottom edge ↓",
          zones: [
            { id: "vertical", label: "vertical axis", x: 48, y: 0, width: 4, height: 100 },
            { id: "horizontal", label: "horizontal axis", x: 0, y: 48, width: 100, height: 4 },
            { id: "diagonal-1", label: "diagonal /", x: 0, y: 0, width: 100, height: 100 },
            { id: "diagonal-2", label: "diagonal \\", x: 0, y: 0, width: 100, height: 100 },
          ],
          multiPin: true,
          minPins: 4,
          allowNote: true,
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: paper as proof",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "the flat-fold theorem says any crease pattern that folds flat must have an even number of creases meeting at each vertex, alternating mountain and valley. folding paper is literally doing topology with your hands — every fold is a transformation that preserves certain properties and destroys others. what does it mean that a physical object can 'prove' a mathematical theorem? how is this different from a symbolic proof?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── infinity.hotel ──────────────────────────────────────────────
// hilbert's hotel — comedy logistics with infinite sets
// assign → overflow → rearrange, time-pressure

export function infinityHotel(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: infinite vacancy",
      discussionPrompt: "all infinitely many guests must move — who said 'that's impossible'? what finite intuition did infinity just break for you?",
      config: {
        type: "prediction",
        prediction: {
          question:
            "hilbert's hotel has infinitely many rooms, all occupied. a new guest arrives. can you fit them in? if so, how many guests need to move rooms?",
          type: "text",
          answer:
            "yes — move every guest from room n to room n+1. all infinitely many guests must move, but everyone gets a room.",
        },
      },
      timeLimit: 60,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "timed" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: infinite bus arrives",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "an infinitely long bus arrives at hilbert's fully-booked hotel. every seat on the bus has a passenger. put the hotel manager's strategy in the correct order:",
          pieces: [
            {
              id: "announce",
              content: "announce to all current guests: 'please pack your bags'",
            },
            {
              id: "double",
              content: "ask each guest in room n to move to room 2n (doubling their room number)",
            },
            {
              id: "odd-free",
              content: "observe that all odd-numbered rooms (1, 3, 5, 7...) are now empty",
            },
            {
              id: "assign-bus",
              content: "assign bus passenger k to odd room 2k - 1",
            },
            {
              id: "verify",
              content: "verify: every room has exactly one guest, no one is left out",
            },
          ],
          solution: ["announce", "double", "odd-free", "assign-bus", "verify"],
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "timed" },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "categorize: countable vs uncountable",
      discussionPrompt: "rationals are countable but reals aren't — both are infinite but one is 'bigger.' which placement caused the most debate?",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "cantor proved some infinities are bigger than others. sort each set into 'countable infinity' (can be listed 1, 2, 3...) or 'uncountable infinity' (cannot be listed, no matter what):",
          cards: [
            { id: "naturals", content: "natural numbers (1, 2, 3, ...)" },
            { id: "reals", content: "real numbers between 0 and 1" },
            { id: "rationals", content: "all fractions (rational numbers)" },
            { id: "irrationals", content: "all irrational numbers (pi, sqrt(2), ...)" },
            { id: "integers", content: "all integers (..., -2, -1, 0, 1, 2, ...)" },
            { id: "powerSet", content: "all subsets of natural numbers" },
            { id: "primes", content: "all prime numbers" },
            { id: "points", content: "all points on a line segment" },
          ],
          categories: [
            {
              id: "countable",
              label: "countable infinity",
              description: "can be put in 1-to-1 correspondence with the natural numbers",
            },
            {
              id: "uncountable",
              label: "uncountable infinity",
              description: "provably too large to list — cantor's diagonal argument applies",
            },
          ],
          solution: {
            naturals: "countable",
            reals: "uncountable",
            rationals: "countable",
            irrationals: "uncountable",
            integers: "countable",
            powerSet: "uncountable",
            primes: "countable",
            points: "uncountable",
          },
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "timed" },
    },
    {
      id: uid(),
      type: "poll",
      phase: "integration",
      label: "vote: what makes infinity strange",
      discussionPrompt: "look at the vote distribution — which property got the fewest votes? that might be the one people haven't fully absorbed yet",
      config: {
        type: "poll",
        poll: {
          question:
            "which property of infinity is most counterintuitive to you?",
          options: [
            { id: "same-size", label: "a set and its proper subset can be the same size (naturals = evens)" },
            { id: "bigger", label: "some infinities are genuinely bigger than others" },
            { id: "hotel", label: "you can always fit more into a full infinity" },
            { id: "diagonal", label: "a list of all real numbers is provably impossible" },
          ],
        },
      },
      mechanic: { interactionModel: "framing", socialStructure: "audience", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: infinity and intuition",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "our intuitions about size, containment, and 'more' were built for finite collections. hilbert's hotel shows these intuitions break at infinity — a full hotel has room for infinitely more guests. where else might your finite intuitions be misleading you? think about a domain you work in where scale changes the rules.",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── variable.engine ─────────────────────────────────────────────
// rube goldberg algebra — chain reactions with operations
// chain → trigger → observe, paced

export function variableEngine(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: operation chains",
      config: {
        type: "prediction",
        prediction: {
          question:
            "you start with x = 3. you apply these operations in order: double it, add 5, square the result, subtract 100. what is the final value?",
          type: "number",
          answer: 21,
        },
      },
      timeLimit: 60,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      phase: "struggle",
      label: "explore: algebraic machine",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "this is a three-stage algebraic machine. adjust the input and coefficients to understand how operations compose. try to predict the output before you move each slider. notice: changing an early parameter has cascading effects downstream.",
          parameters: [
            {
              id: "x",
              label: "input (x)",
              min: -10,
              max: 10,
              step: 1,
              defaultValue: 3,
            },
            {
              id: "a",
              label: "stage 1 multiplier (a)",
              min: -5,
              max: 5,
              step: 1,
              defaultValue: 2,
            },
            {
              id: "b",
              label: "stage 2 addend (b)",
              min: -20,
              max: 20,
              step: 1,
              defaultValue: 5,
            },
            {
              id: "c",
              label: "stage 3 exponent base multiplier (c)",
              min: 1,
              max: 5,
              step: 1,
              defaultValue: 1,
            },
          ],
          formula: "c * (a * x + b) * (a * x + b) - 100",
          outputLabel: "final output",
          reflectionPrompt:
            "what happens to the output when you change the multiplier (a) versus the addend (b)? which parameter has the most dramatic effect, and why?",
        },
      },
      timeLimit: 180,
      mechanic: { interactionModel: "sandbox", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "categorize: expression types",
      discussionPrompt: "logarithmic growth is technically 'grows steadily' at the slow end — but it decelerates. did anyone want a fourth category for 'growth that slows down'?",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "algebraic expressions have different structures that determine their behavior. sort each expression by its fundamental type:",
          cards: [
            { id: "linear", content: "3x + 7" },
            { id: "quadratic", content: "x^2 - 4x + 4" },
            { id: "exponential", content: "2^x" },
            { id: "rational", content: "(x + 1) / (x - 2)" },
            { id: "polynomial", content: "x^3 - 2x^2 + x" },
            { id: "logarithmic", content: "log(x + 1)" },
          ],
          categories: [
            {
              id: "grows-steadily",
              label: "grows at a constant rate",
              description: "output changes by the same amount for each unit change in input",
            },
            {
              id: "grows-faster",
              label: "growth accelerates",
              description: "output changes faster and faster as input increases",
            },
            {
              id: "grows-explosively",
              label: "explosive growth",
              description: "output doubles (or more) for each unit change in input",
            },
          ],
          solution: {
            linear: "grows-steadily",
            quadratic: "grows-faster",
            exponential: "grows-explosively",
            rational: "grows-steadily",
            polynomial: "grows-faster",
            logarithmic: "grows-steadily",
          },
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: composition as thinking tool",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "algebra is really about composition — combining simple operations into complex machines. you saw how changing one early parameter cascades through the whole chain. where do you see this pattern outside math? think about a system you interact with where small upstream changes create large downstream effects. what's the 'multiplier' in that system?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── proof.garden ────────────────────────────────────────────────
// grow proof trees from axiom seeds
// plant → connect → bloom, paced

export function proofGarden(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: proof steps",
      config: {
        type: "prediction",
        prediction: {
          question:
            "euclid proved there are infinitely many prime numbers around 300 BCE. his proof is considered one of the most elegant in history. how many lines does the core argument take?",
          type: "choice",
          options: [
            { id: "3", label: "about 3 lines" },
            { id: "12", label: "about 12 lines" },
            { id: "30", label: "about 30 lines" },
            { id: "100", label: "over 100 lines" },
          ],
          answer: "3",
        },
      },
      timeLimit: 45,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: proof that sqrt(2) is irrational",
      discussionPrompt: "the contradiction is beautiful — both a and b must be even, but we said 'lowest terms.' who found the logic chain hardest to follow?",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "the proof that sqrt(2) is irrational is a classic proof by contradiction. each step depends on the one before it. arrange them in logical order:",
          pieces: [
            {
              id: "assume",
              content: "assume sqrt(2) = a/b where a/b is in lowest terms (no common factors)",
              hint: "proofs by contradiction start with assuming the opposite",
            },
            {
              id: "square",
              content: "square both sides: 2 = a^2 / b^2, so a^2 = 2b^2",
              hint: "algebraic manipulation of the assumption",
            },
            {
              id: "a-even",
              content: "since a^2 is even (it equals 2b^2), a itself must be even. write a = 2k.",
              hint: "if a were odd, a^2 would be odd",
            },
            {
              id: "substitute",
              content: "substitute a = 2k: (2k)^2 = 2b^2, so 4k^2 = 2b^2, so b^2 = 2k^2",
              hint: "plug the new expression back in",
            },
            {
              id: "b-even",
              content: "since b^2 = 2k^2, b must also be even",
              hint: "same logic as before — if b^2 is even, b is even",
            },
            {
              id: "contradiction",
              content: "but if both a and b are even, they share factor 2 — contradicting 'lowest terms'. therefore sqrt(2) is irrational.",
              hint: "the assumption leads to impossibility",
            },
          ],
          solution: ["assume", "square", "a-even", "substitute", "b-even", "contradiction"],
        },
      },
      timeLimit: 180,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "threshold",
      label: "perspectives: axiom systems",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "three mathematicians from different traditions are arguing about what makes a proof valid. each has a fundamentally different view of mathematical truth. read your perspective and answer the question.",
          roles: [
            {
              id: "platonist",
              label: "the platonist",
              info: "mathematical objects are real — they exist in an abstract realm independent of human minds. when we prove a theorem, we discover something that was already true. the number 7 existed before humans, and pi was irrational before anyone proved it. the fact that mathematics 'works' in physics is evidence that we're discovering real structure, not inventing it.",
              question:
                "if math is discovered, not invented, then what exactly is a mathematician doing when they write a proof? are they more like explorers or reporters?",
            },
            {
              id: "formalist",
              label: "the formalist",
              info: "mathematics is a game played with symbols according to rules. a proof is just a sequence of symbol manipulations that follows the rules — nothing more. there's no 'mathematical reality' out there. the reason we care about consistency is practical: inconsistent systems let you prove anything, which makes them useless. truth in math means 'provable from axioms.'",
              question:
                "if math is just a symbol game, why does it describe the physical world so unreasonably well? is that a coincidence?",
            },
            {
              id: "intuitionist",
              label: "the intuitionist",
              info: "mathematical objects are mental constructions. a statement is only true if we can construct a proof of it — 'it must be true or false' isn't enough. this means some classical proofs are invalid: you can't prove something exists by showing its nonexistence leads to contradiction. you must actually build the object. this rejects the law of excluded middle for infinite domains.",
              question:
                "the proof that sqrt(2) is irrational uses contradiction — you proved something exists (irrationality) by showing the opposite fails. should we trust this kind of proof? why or why not?",
            },
          ],
          discussionPrompt:
            "share what your mathematician believes. notice: the platonist says proofs discover truth, the formalist says they follow rules, and the intuitionist says they construct objects. can a proof be valid in one system and invalid in another?",
          revealPrompt:
            "the threshold: mathematical truth is not monolithic. different axiom systems yield different truths. the parallel postulate is true in euclidean geometry and false in hyperbolic geometry — and both are internally consistent. proof is always relative to a starting point.",
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "negotiation", socialStructure: "asymmetric", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: the nature of mathematical truth",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "you've now seen proof as both a logical chain (sqrt(2)) and a philosophical battleground (what counts as valid reasoning). godel proved in 1931 that any consistent system powerful enough to describe arithmetic must contain true statements it cannot prove. what does this mean for the idea of 'complete knowledge'? does this change how you think about certainty — in math or anywhere else?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── pattern.weave ───────────────────────────────────────────────
// reverse-engineer hidden numerical rules
// find → reverse → compose, paced

export function patternWeave(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: hidden sequences",
      config: {
        type: "prediction",
        prediction: {
          question:
            "the sequence goes: 1, 1, 2, 3, 5, 8, 13, 21, 34. what is the next number? (hint: look at the relationship between consecutive terms, not the terms themselves.)",
          type: "number",
          answer: 55,
        },
      },
      timeLimit: 60,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: decode the rule",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "someone created a number sequence using a multi-step rule. the output is: 2, 6, 12, 20, 30, 42. work backwards — arrange these observations in the order that cracks the code:",
          pieces: [
            {
              id: "differences",
              content: "compute first differences: 4, 6, 8, 10, 12",
              hint: "subtract consecutive terms",
            },
            {
              id: "second-diff",
              content: "compute second differences: 2, 2, 2, 2",
              hint: "differences of differences",
            },
            {
              id: "quadratic",
              content: "constant second differences = quadratic formula (n^2 + something)",
              hint: "this is a key pattern recognition rule",
            },
            {
              id: "test",
              content: "test n(n+1): 1(2)=2, 2(3)=6, 3(4)=12 — it works!",
              hint: "try the simplest quadratic form",
            },
            {
              id: "predict",
              content: "predict next: 7(8) = 56. the sequence is n(n+1), the 'oblong numbers'",
              hint: "use the rule to generate new terms",
            },
          ],
          solution: ["differences", "second-diff", "quadratic", "test", "predict"],
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      phase: "threshold",
      label: "explore: sequence generator",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "build your own sequence by adjusting the parameters of a general quadratic generator. try to create a sequence that looks surprising but follows a simple rule. the formula computes the nth term.",
          parameters: [
            {
              id: "n",
              label: "term number (n)",
              min: 1,
              max: 20,
              step: 1,
              defaultValue: 1,
            },
            {
              id: "a",
              label: "quadratic coefficient (a)",
              min: -5,
              max: 5,
              step: 1,
              defaultValue: 1,
            },
            {
              id: "b",
              label: "linear coefficient (b)",
              min: -10,
              max: 10,
              step: 1,
              defaultValue: 1,
            },
            {
              id: "c",
              label: "constant (c)",
              min: -10,
              max: 10,
              step: 1,
              defaultValue: 0,
            },
          ],
          formula: "a * n * n + b * n + c",
          outputLabel: "term value",
          reflectionPrompt:
            "what combination of a, b, c produces a sequence you find interesting? can you describe in words what the sequence 'looks like' without using the formula?",
        },
      },
      timeLimit: 180,
      mechanic: { interactionModel: "sandbox", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "integration",
      label: "categorize: sequence families",
      discussionPrompt: "primes have 'no known closed formula' — mathematicians have tried for millennia. what does it mean that a pattern can be perfectly defined but still resist compression?",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sequences have fundamentally different characters based on their growth patterns. sort each famous sequence into its family:",
          cards: [
            { id: "fibonacci", content: "1, 1, 2, 3, 5, 8, 13 (fibonacci)" },
            { id: "powers", content: "1, 4, 9, 16, 25 (perfect squares)" },
            { id: "geometric", content: "2, 6, 18, 54, 162 (powers of 3, doubled)" },
            { id: "triangular", content: "1, 3, 6, 10, 15, 21 (triangular numbers)" },
            { id: "primes", content: "2, 3, 5, 7, 11, 13, 17 (primes)" },
            { id: "harmonic", content: "1, 1/2, 1/3, 1/4, 1/5 (harmonic)" },
          ],
          categories: [
            {
              id: "recursive",
              label: "recursive (each term depends on previous terms)",
              description: "you need the history to compute the next value",
            },
            {
              id: "formulaic",
              label: "formulaic (each term depends only on position n)",
              description: "you can jump to any term without computing all before it",
            },
            {
              id: "mysterious",
              label: "no known closed formula",
              description: "mathematicians haven't found a simple formula — the pattern resists compression",
            },
          ],
          solution: {
            fibonacci: "recursive",
            powers: "formulaic",
            geometric: "formulaic",
            triangular: "formulaic",
            primes: "mysterious",
            harmonic: "formulaic",
          },
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: patterns and prediction",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "you've now seen pattern recognition as a mathematical skill: take differences, look for constants, test a formula, predict. but here's the deep question — the sequence 1, 2, 4, 8 could be powers of 2 (next: 16) or it could be 'regions formed by connecting n points on a circle' (next: 15, not 16). the same data can hide different rules. where in your life have you been confident about a pattern that turned out to be wrong? what would it take to tell two plausible rules apart?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}
