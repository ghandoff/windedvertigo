import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── bond.craft ──────────────────────────────────────────────────
// sculpt -> bond -> test | paced
// 3D electron cloud sculpting, chemical bonding

export function bondCraft(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "diamond and table salt are both crystalline solids. which one has a higher melting point?",
          type: "choice",
          options: [
            { id: "diamond", label: "diamond (carbon)" },
            { id: "salt", label: "table salt (NaCl)" },
          ],
          answer: "diamond",
        },
      },
      phase: "encounter",
      label: "predict: crystal showdown",
      discussionPrompt: "salt seems harder and more solid — why did so many people pick it? what does this reveal about everyday intuitions vs. bond strength?",
      timeLimit: 45,
      hints: [
        "think about what holds the atoms together in each crystal",
        "diamond is made entirely of covalent bonds in a network",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
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
            "sort each real molecule or material into its primary bond type. some might surprise you.",
          cards: [
            { id: "nacl", content: "NaCl (table salt)", hint: "metal + nonmetal" },
            { id: "h2o", content: "H\u2082O (water)", hint: "two nonmetals sharing" },
            { id: "fe", content: "iron (Fe) metal", hint: "sea of electrons" },
            { id: "dna", content: "DNA base pairs (A-T)", hint: "weak but specific attraction" },
            { id: "diamond", content: "diamond (C)", hint: "identical atoms sharing" },
            { id: "bronze", content: "bronze (Cu-Sn alloy)", hint: "mixed metals" },
            { id: "hf", content: "HF (hydrofluoric acid)", hint: "huge electronegativity difference but both nonmetals" },
          ],
          categories: [
            { id: "ionic", label: "ionic", description: "electron transfer between metal and nonmetal" },
            { id: "covalent", label: "covalent", description: "electron sharing between nonmetals" },
            { id: "metallic", label: "metallic", description: "delocalized electron sea in metals" },
            { id: "hydrogen", label: "hydrogen bonding", description: "weak attraction between polar molecules" },
          ],
          solution: {
            nacl: "ionic",
            h2o: "covalent",
            fe: "metallic",
            dna: "hydrogen",
            diamond: "covalent",
            bronze: "metallic",
            hf: "covalent",
          },
        },
      },
      phase: "struggle",
      label: "sort: bond families",
      discussionPrompt: "HF trips people up — it's two nonmetals but the electronegativity gap is huge. where does the boundary between covalent and ionic actually live?",
      timeLimit: 120,
      hints: [
        "metals bonding with nonmetals usually form ionic bonds",
        "hydrogen bonds are intermolecular, not intramolecular",
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
            "place each bond type on the map. where does each sit in terms of electronegativity difference and bond strength?",
          width: 800,
          height: 600,
          xLabel: "electronegativity difference (\u0394EN: 0 \u2192 3.3)",
          yLabel: "bond dissociation energy (kJ/mol: 0 \u2192 800)",
          zones: [
            { id: "nonpolar", label: "nonpolar covalent", x: 0, y: 200, width: 200, height: 400 },
            { id: "polar", label: "polar covalent", x: 200, y: 200, width: 300, height: 400 },
            { id: "ionic-zone", label: "ionic", x: 500, y: 200, width: 300, height: 400 },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: electronegativity landscape",
      timeLimit: 150,
      hints: [
        "the boundary between polar covalent and ionic is roughly \u0394EN = 1.7",
        "C-C bonds have \u0394EN = 0 and ~348 kJ/mol",
      ],
      mechanic: {
        interactionModel: "sandbox",
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
            "you are atoms trying to achieve a stable electron configuration. each of you has different electronegativity and electron needs. find a partner and negotiate how to share or transfer electrons.",
          roles: [
            {
              id: "sodium",
              label: "sodium (Na)",
              info: "you have 1 valence electron and electronegativity of 0.93. you desperately want to lose that electron to reach a full shell. you're generous with electrons but you become positively charged when you give one up. you're looking for someone electronegative enough to take it.",
              question: "who would you bond with and why? what type of bond would form?",
            },
            {
              id: "chlorine",
              label: "chlorine (Cl)",
              info: "you have 7 valence electrons and electronegativity of 3.16. you need just 1 more electron to complete your octet. you pull electrons toward yourself strongly. you'd happily accept an electron from someone willing to give one up, becoming negatively charged.",
              question: "who would you bond with and why? what type of bond would form?",
            },
            {
              id: "carbon",
              label: "carbon (C)",
              info: "you have 4 valence electrons and electronegativity of 2.55. you're right in the middle \u2014 you neither want to gain nor lose electrons completely. you prefer sharing. you can form up to 4 bonds, making you incredibly versatile. you're the backbone of organic chemistry.",
              question: "who would you bond with and why? what type of bond would form?",
            },
            {
              id: "oxygen",
              label: "oxygen (O)",
              info: "you have 6 valence electrons and electronegativity of 3.44. you need 2 more electrons and you pull hard. when you share with someone less electronegative, the electrons spend more time near you. this makes you slightly negative and your partner slightly positive \u2014 creating polarity.",
              question: "who would you bond with and why? what type of bond would form?",
            },
          ],
          discussionPrompt:
            "reveal your atom identity to the group. which pairs formed ionic bonds? which formed covalent? did any bond have partial character of both?",
          revealPrompt:
            "Na-Cl forms an ionic bond (\u0394EN = 2.23). C-O forms a polar covalent bond (\u0394EN = 0.89). C-C would be nonpolar covalent (\u0394EN = 0). the boundary is a spectrum, not a sharp line.",
        },
      },
      phase: "integration",
      label: "negotiate: electron exchange",
      timeLimit: 240,
      hints: [
        "compare your electronegativity values \u2014 bigger differences mean more ionic character",
        "consider: would you rather share or transfer?",
      ],
      mechanic: {
        interactionModel: "negotiation",
        socialStructure: "asymmetric",
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
            "the line between ionic and covalent bonding is not a boundary but a spectrum. describe a real-world material or molecule where this ambiguity matters. how does partial ionic/covalent character affect the material's properties?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the bonding spectrum",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── equilibrium.dance ───────────────────────────────────────────
// zoom -> observe -> shift | real-time
// le chatelier's principle — zoom IS the mechanic

export function equilibriumDance(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a sealed flask contains N\u2082O\u2084 (colorless) in equilibrium with NO\u2082 (brown). you plunge it into ice water. what happens to the color?",
          type: "choice",
          options: [
            { id: "darker", label: "gets darker (more brown)" },
            { id: "lighter", label: "gets lighter (more colorless)" },
            { id: "same", label: "stays the same" },
          ],
          answer: "lighter",
        },
      },
      phase: "encounter",
      label: "predict: the color shift",
      discussionPrompt: "cooling makes it lighter, not darker — who had the right reasoning even if they picked wrong? what does 'favoring the exothermic direction' mean intuitively?",
      timeLimit: 45,
      hints: [
        "the forward reaction (N\u2082O\u2084 \u2192 2NO\u2082) is endothermic",
        "cooling favors the exothermic direction",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "explore le chatelier's principle. adjust concentration, temperature, and pressure to see how the equilibrium constant and product ratio shift for the haber process: N\u2082 + 3H\u2082 \u21CC 2NH\u2083 (\u0394H = -92 kJ/mol)",
          parameters: [
            { id: "n2", label: "[N\u2082] concentration", min: 0.1, max: 5.0, step: 0.1, defaultValue: 1.0, unit: "mol/L" },
            { id: "h2", label: "[H\u2082] concentration", min: 0.1, max: 5.0, step: 0.1, defaultValue: 3.0, unit: "mol/L" },
            { id: "temp", label: "temperature", min: 200, max: 800, step: 10, defaultValue: 450, unit: "\u00b0C" },
            { id: "pressure", label: "pressure", min: 1, max: 300, step: 5, defaultValue: 200, unit: "atm" },
          ],
          formula: "(n2 * h2 * h2 * h2 * pressure * pressure / 1000) / (1 + temp / 200)",
          outputLabel: "relative NH\u2083 yield",
          outputUnit: "%",
          reflectionPrompt:
            "why do industrial plants run the haber process at 450\u00b0C if lower temperatures give higher yields? what trade-off are they making?",
        },
      },
      phase: "struggle",
      label: "sandbox: equilibrium levers",
      timeLimit: 180,
      hints: [
        "increasing reactant concentration pushes equilibrium toward products",
        "this reaction reduces moles of gas (4 \u2192 2), so high pressure favors products",
        "lower temperature favors the exothermic direction but slows the reaction rate",
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
            "for each change applied to an equilibrium system, sort by which direction the equilibrium shifts.",
          cards: [
            { id: "add-reactant", content: "add more reactant" },
            { id: "remove-product", content: "remove product as it forms" },
            { id: "increase-temp-endo", content: "heat an endothermic reaction" },
            { id: "increase-temp-exo", content: "heat an exothermic reaction" },
            { id: "increase-pressure-fewer", content: "increase pressure (fewer moles on product side)" },
            { id: "add-catalyst", content: "add a catalyst" },
            { id: "decrease-volume", content: "decrease volume (more moles on reactant side)" },
            { id: "add-inert-gas", content: "add inert gas at constant volume" },
          ],
          categories: [
            { id: "forward", label: "shifts forward (toward products)" },
            { id: "reverse", label: "shifts reverse (toward reactants)" },
            { id: "none", label: "no shift" },
          ],
          solution: {
            "add-reactant": "forward",
            "remove-product": "forward",
            "increase-temp-endo": "forward",
            "increase-temp-exo": "reverse",
            "increase-pressure-fewer": "forward",
            "add-catalyst": "none",
            "decrease-volume": "reverse",
            "add-inert-gas": "none",
          },
        },
      },
      phase: "threshold",
      label: "sort: which way does it shift?",
      discussionPrompt: "catalysts and inert gas both go in 'no shift' — did that surprise anyone? what makes them different from every other intervention?",
      timeLimit: 120,
      hints: [
        "catalysts speed up both directions equally",
        "inert gas at constant volume doesn't change partial pressures",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "poll",
      config: {
        type: "poll",
        poll: {
          question:
            "which statement best captures why equilibrium is 'dynamic' rather than 'static'?",
          options: [
            { id: "a", label: "concentrations stop changing so nothing is happening" },
            { id: "b", label: "forward and reverse reactions continue at equal rates" },
            { id: "c", label: "only the forward reaction continues but slowly" },
            { id: "d", label: "molecules stop moving once equilibrium is reached" },
          ],
        },
      },
      phase: "integration",
      label: "poll: dynamic vs static",
      discussionPrompt: "if anyone picked 'molecules stop moving' — that's the most common misconception. why does 'nothing seems to change' trick us into thinking nothing is happening?",
      timeLimit: 60,
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "equilibrium is everywhere outside chemistry \u2014 ecosystems, economies, your own body. describe a non-chemistry system you know that behaves like a dynamic equilibrium. what are the 'reactants' and 'products'? what would a le chatelier-style stress look like?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: equilibrium beyond the flask",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}

// ── reaction.path ───────────────────────────────────────────────
// traverse -> climb -> descend | real-time
// you ARE the molecule, energy landscape marble run

export function reactionPath(): Activity[] {
  _id = 0;
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a platinum catalyst is added to the decomposition of hydrogen peroxide (2H\u2082O\u2082 \u2192 2H\u2082O + O\u2082). the activation energy drops from 75 kJ/mol to 49 kJ/mol. by roughly what factor does the reaction rate increase at 25\u00b0C?",
          type: "number",
          answer: 40000,
          unit: "x faster",
        },
      },
      phase: "encounter",
      label: "predict: catalyst power",
      discussionPrompt: "40,000x faster — did anyone come close? the exponential relationship between activation energy and rate is deeply counterintuitive",
      timeLimit: 60,
      hints: [
        "the arrhenius equation relates rate to e^(-Ea/RT)",
        "a 26 kJ/mol drop in Ea is enormous at room temperature",
        "even small changes in activation energy cause exponential rate changes",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "anonymous",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "explore how temperature, catalyst, and concentration affect reaction rate. the formula models relative rate using arrhenius-style dependence: rate \u221d [A] \u00d7 e^(-Ea/RT). adjust the sliders to see how sensitive the rate is to each parameter.",
          parameters: [
            { id: "conc", label: "concentration [A]", min: 0.1, max: 5.0, step: 0.1, defaultValue: 1.0, unit: "mol/L" },
            { id: "temp", label: "temperature", min: 200, max: 600, step: 5, defaultValue: 298, unit: "K" },
            { id: "ea", label: "activation energy (Ea)", min: 10, max: 150, step: 5, defaultValue: 75, unit: "kJ/mol" },
          ],
          formula: "conc * 1000 / (1 + ea / (temp * 0.008314))",
          outputLabel: "relative reaction rate",
          outputUnit: "arbitrary units",
          reflectionPrompt:
            "which parameter had the biggest effect on rate? why is temperature so much more powerful than concentration?",
        },
      },
      phase: "struggle",
      label: "sandbox: energy landscape",
      timeLimit: 180,
      hints: [
        "try doubling concentration vs raising temperature by 10K",
        "lowering Ea simulates adding a catalyst",
        "the exponential relationship makes temperature disproportionately powerful",
      ],
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "puzzle",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "arrange the steps of the SN2 reaction mechanism between CH\u2083Br and OH\u207b in the correct order. you are the hydroxide ion \u2014 trace your path through the energy landscape.",
          pieces: [
            { id: "approach", content: "OH\u207b approaches the carbon from the back side (opposite the Br)", hint: "nucleophilic attack starts here" },
            { id: "transition", content: "a pentacoordinate transition state forms [HO\u2014CH\u2083\u2014Br]\u207b", hint: "this is the peak of the energy diagram" },
            { id: "inversion", content: "the three H atoms flip like an umbrella inverting (walden inversion)", hint: "stereochemistry changes" },
            { id: "departure", content: "Br\u207b departs as the leaving group", hint: "the bond to bromine breaks" },
            { id: "product", content: "CH\u2083OH forms with inverted stereochemistry", hint: "the product is methanol" },
          ],
          solution: ["approach", "transition", "inversion", "departure", "product"],
          revealOrder: true,
        },
      },
      phase: "threshold",
      label: "sequence: the reaction path",
      discussionPrompt: "the umbrella inversion — who got that step wrong? SN2 happens in a single moment but we had to break it into five steps to understand it",
      timeLimit: 150,
      hints: [
        "SN2 is a single concerted step \u2014 bond making and breaking happen simultaneously",
        "the transition state is the highest energy point",
      ],
      mechanic: {
        interactionModel: "construction",
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
            "sketch the energy diagram for this reaction. place key points: reactants, transition state, and products. is this reaction exothermic or endothermic?",
          width: 800,
          height: 600,
          xLabel: "reaction coordinate (progress \u2192)",
          yLabel: "potential energy (kJ/mol \u2192)",
          zones: [
            { id: "reactants", label: "reactants", x: 0, y: 350, width: 200, height: 250 },
            { id: "ts", label: "transition state (Ea)", x: 300, y: 0, width: 200, height: 250 },
            { id: "products", label: "products", x: 600, y: 400, width: 200, height: 200 },
          ],
          multiPin: true,
          minPins: 3,
          pinCategories: [
            { id: "reactants", label: "reactants", color: "#3b82f6" },
            { id: "transition", label: "transition state", color: "#f59e0b" },
            { id: "products", label: "products", color: "#10b981" },
          ],
          allowNote: true,
        },
      },
      phase: "integration",
      label: "draw: energy diagram",
      timeLimit: 150,
      hints: [
        "the height of the peak above the reactants is the activation energy (Ea)",
        "if products are lower than reactants, the reaction is exothermic",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "solo",
        tempo: "real-time",
      },
    },
    {
      id: uid(),
      type: "reflection",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "catalysts lower the activation energy without changing the overall energy difference between reactants and products. enzymes are biological catalysts. why is it important that enzymes are highly specific \u2014 only catalyzing one reaction? what would happen in a cell if an enzyme catalyzed everything?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: why specificity matters",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "cooperative",
        tempo: "contemplative",
      },
    },
  ];
}
