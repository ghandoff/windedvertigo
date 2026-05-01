import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── space.between ───────────────────────────────────────────────
// frame → compose → reveal | paced
// photography viewfinder, negative space

export function spaceBetween(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: visual attention",
      timeLimit: 45,
      config: {
        type: "prediction",
        prediction: {
          question:
            "eye-tracking studies show that when viewing a photograph, how many milliseconds does it take for the eye to fixate on the primary subject?",
          type: "number",
          answer: 200,
          unit: "ms",
        },
      },
      hints: [
        "it's faster than conscious thought",
        "the eye is drawn to contrast, faces, and areas of sharpest focus",
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
      phase: "struggle",
      label: "sort: composition principles",
      discussionPrompt: "negative space as 'balance' not 'meaning' — did anyone disagree? what happens to a composition when you treat emptiness as active design, not leftover?",
      timeLimit: 150,
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each composition technique by its primary function. henri cartier-bresson called the decisive moment 'the simultaneous recognition of the significance of an event and of a precise organization of forms.' how does each technique organize form?",
          cards: [
            { id: "thirds", content: "rule of thirds", hint: "placing subjects at intersection points of a 3x3 grid" },
            { id: "golden", content: "golden ratio spiral", hint: "fibonacci in visual form — the nautilus curve" },
            { id: "leading", content: "leading lines", hint: "roads, fences, rivers that pull the eye forward" },
            { id: "framing", content: "natural framing", hint: "doorways, windows, branches that surround the subject" },
            { id: "symmetry", content: "symmetry / reflection", hint: "mirror images, bilateral balance — wes anderson's signature" },
            { id: "negative", content: "negative space", hint: "the empty area around and between subjects" },
            { id: "depth", content: "layered depth", hint: "foreground, middle ground, background separation" },
            { id: "juxtapose", content: "juxtaposition", hint: "placing contrasting elements side by side" },
          ],
          categories: [
            { id: "guide", label: "guides the eye", description: "directs where and how the viewer looks" },
            { id: "balance", label: "creates balance", description: "distributes visual weight across the frame" },
            { id: "meaning", label: "builds meaning", description: "adds narrative or emotional content through arrangement" },
          ],
          solution: {
            thirds: "guide",
            golden: "guide",
            leading: "guide",
            framing: "guide",
            symmetry: "balance",
            negative: "balance",
            depth: "meaning",
            juxtapose: "meaning",
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
      type: "canvas",
      phase: "threshold",
      label: "compose: focus points",
      timeLimit: 180,
      discussionPrompt:
        "where did the group cluster their focus points? did anyone place the figure off-center, and how does that change the emotional weight of the composition?",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "you're composing a photograph of a lone figure standing on a vast, empty beach at dusk. place your focus points, leading lines, and areas of emphasis. the japanese concept of 'ma' (間) treats empty space as an active element — where you leave nothing is as important as where you place something.",
          width: 900,
          height: 600,
          xLabel: "frame width",
          yLabel: "frame height",
          xLow: "left edge",
          xHigh: "right edge",
          yLow: "bottom edge",
          yHigh: "top edge",
          zones: [
            { id: "upper-third", label: "sky / upper third", x: 0, y: 0, width: 900, height: 200 },
            { id: "middle-third", label: "horizon / middle third", x: 0, y: 200, width: 900, height: 200 },
            { id: "lower-third", label: "ground / lower third", x: 0, y: 400, width: 900, height: 200 },
          ],
          multiPin: true,
          minPins: 3,
          pinCategories: [
            { id: "focus", label: "focal point", color: "#ef4444" },
            { id: "leading", label: "leading line", color: "#3b82f6" },
            { id: "emphasis", label: "emphasis area", color: "#f59e0b" },
          ],
          allowNote: true,
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
      type: "open-response",
      phase: "integration",
      label: "describe: the absent",
      timeLimit: 180,
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "the facilitator will show a well-known photograph (perhaps fan ho's 'approaching shadow' or ansel adams' 'moonrise, hernandez'). describe what is NOT in the composition — what was excluded, cropped, left empty, or implied. how does what's missing shape what's present?",
          responseType: "text",
          anonymous: false,
        },
      },
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "solo",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: negative space as design",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "in graphic design, negative space is called 'white space.' in music, it's the rest. in conversation, it's the pause. john cage's '4\'33\"' argued that silence is never truly empty — it's full of ambient sound we normally ignore. how can you apply the principle of active negative space to something you're currently creating or communicating?",
          minLength: 80,
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

// ── hue.shift ───────────────────────────────────────────────────
// match → shift → adapt | time-pressure
// speed color matching under shifting context, color theory

export function hueShift(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: color perception",
      timeLimit: 45,
      config: {
        type: "prediction",
        prediction: {
          question:
            "josef albers demonstrated that context changes how we see color. how many distinct colors can the average human eye distinguish?",
          type: "choice",
          options: [
            { id: "1k", label: "about 1,000" },
            { id: "10k", label: "about 10,000" },
            { id: "1m", label: "about 1 million" },
            { id: "10m", label: "about 10 million" },
          ],
          answer: "10m",
        },
      },
      hints: [
        "the answer is far more than most people guess",
        "we have three types of cone cells, each sensitive to different wavelengths",
      ],
      mechanic: {
        interactionModel: "reveal",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "struggle",
      label: "sort: color temperature",
      discussionPrompt: "chartreuse is the most ambiguous — it shifts warm or cool depending on what's beside it. who put it in 'ambiguous' and who committed to a temperature?",
      timeLimit: 120,
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each color by its emotional temperature. this isn't physics — it's perception. albers wrote in 'interaction of color' that color is the most relative medium in art. trust your gut.",
          cards: [
            { id: "cerulean", content: "cerulean blue", hint: "the blue of a clear winter sky" },
            { id: "cadmium-red", content: "cadmium red", hint: "the red of a fire engine" },
            { id: "ochre", content: "yellow ochre", hint: "dusty, earthy, ancient" },
            { id: "viridian", content: "viridian green", hint: "deep forest, cool jade" },
            { id: "burnt-sienna", content: "burnt sienna", hint: "terra cotta, dried clay" },
            { id: "violet", content: "ultramarine violet", hint: "twilight, deep mystery" },
            { id: "chartreuse", content: "chartreuse", hint: "yellow-green, electric, acidic" },
            { id: "coral", content: "coral pink", hint: "warm skin tone, tropical reef" },
          ],
          categories: [
            { id: "hot", label: "hot / advancing", description: "feels close, energetic, aggressive" },
            { id: "warm", label: "warm / grounding", description: "feels stable, comforting, earthy" },
            { id: "cool", label: "cool / receding", description: "feels distant, calm, contemplative" },
            { id: "ambiguous", label: "ambiguous / shifting", description: "changes depending on what's next to it" },
          ],
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
      type: "rule-sandbox",
      phase: "threshold",
      label: "explore: color mixing",
      timeLimit: 180,
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "mix a color using RGB values. the output estimates perceived warmth on a scale from 0 (cool) to 100 (hot). this approximates how the human eye weights red as warm and blue as cool, with green as neutral. try to hit exactly 50 — perfect thermal balance.",
          parameters: [
            { id: "red", label: "red channel", min: 0, max: 255, step: 5, defaultValue: 128 },
            { id: "green", label: "green channel", min: 0, max: 255, step: 5, defaultValue: 128 },
            { id: "blue", label: "blue channel", min: 0, max: 255, step: 5, defaultValue: 128 },
            { id: "context", label: "background brightness", min: 0, max: 100, step: 5, defaultValue: 50, unit: "%" },
          ],
          formula: "(red * 100 / 255 * 60 / 100 + green * 100 / 255 * 30 / 100 - blue * 100 / 255 * 40 / 100 + 20) * (100 + (context - 50)) / 100",
          outputLabel: "perceived warmth",
          outputUnit: "warmth (0-100)",
          reflectionPrompt:
            "how did changing the background brightness affect your perception of the same color? what does this reveal about the relativity of color?",
          visualizer: "color-preview",
        },
      },
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "canvas",
      phase: "integration",
      label: "map: color relationships",
      timeLimit: 180,
      discussionPrompt:
        "do the pins cluster around warm or cool hues? what does the group's color map reveal about shared emotional associations with color?",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "place a pin where you think the most emotionally powerful color lives. the x-axis is hue — from red on the left through green in the middle to violet on the right. the y-axis is saturation — muted at the top, vivid at the bottom. your pin will become the color at that position. try a few spots before locking in.",
          width: 360,
          height: 360,
          xLabel: "hue",
          yLabel: "saturation",
          xLow: "red",
          xHigh: "violet",
          yLow: "vivid",
          yHigh: "muted",
          pinColor: "hue-mapped",
          allowNote: true,
        },
      },
      mechanic: {
        interactionModel: "sandbox",
        socialStructure: "cooperative",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: context changes everything",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "albers spent decades proving that we never see a color as it 'really' is — only as its context allows. the same gray looks blue next to orange and warm next to blue. where else does context completely transform your perception of something? think beyond color — about people, ideas, experiences that looked different when their surroundings changed.",
          minLength: 80,
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

// ── grid.break ──────────────────────────────────────────────────
// design → constrain → compare | paced
// before/after, design constraints as creative catalysts

export function gridBreak(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: constraints",
      timeLimit: 60,
      config: {
        type: "prediction",
        prediction: {
          question:
            "research on creativity consistently shows that moderate constraints improve creative output. compared to 'do whatever you want,' how much more original are solutions produced under constraints? (measured by blind expert rating)",
          type: "choice",
          options: [
            { id: "less", label: "less original — constraints limit thinking" },
            { id: "same", label: "about the same" },
            { id: "moderate", label: "20-40% more original" },
            { id: "much", label: "50%+ more original" },
          ],
          answer: "moderate",
        },
      },
      hints: [
        "think about twitter's 140-character limit, or haiku's 5-7-5 structure",
        "total freedom can be paralyzing — the 'blank page problem'",
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
      phase: "struggle",
      label: "design: under constraints",
      timeLimit: 240,
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "you're all designing a poster for the same event: a community art exhibition called 'emergence.' each of you has a different constraint. work within your limitation — embrace it fully. charles and ray eames said 'design depends largely on constraints.'",
          roles: [
            {
              id: "mono",
              label: "monochrome",
              info: "you can only use one color plus black and white. no gradients, no shading — just flat shapes. think saul bass's stark, iconic film posters.",
              question: "how did having one color force you to think about hierarchy and contrast differently?",
            },
            {
              id: "type-only",
              label: "type only",
              info: "no images, icons, or shapes — only letterforms. your poster must communicate purely through typography. study how neville brody and david carson used type as image.",
              question: "how did the absence of imagery change what you communicated and how?",
            },
            {
              id: "five-shapes",
              label: "five shapes",
              info: "you may use exactly five geometric shapes — circles, squares, or triangles only. no text except the event name. think el lissitzky, bauhaus, or the de stijl movement.",
              question: "which shape did you wish you had more of? what did you sacrifice?",
            },
            {
              id: "found",
              label: "found materials",
              info: "describe a poster made only from found text — headlines, words, letters cut from imaginary newspapers and magazines. think ransom note aesthetic meets jamie reid's sex pistols covers.",
              question: "how did using someone else's words change your message?",
            },
          ],
          discussionPrompt:
            "compare the four approaches. which constraint produced the most surprising result? did any constraint feel more like freedom than limitation?",
          revealPrompt:
            "the oulipo literary movement (perec, queneau) deliberately imposed extreme constraints to unlock new creative possibilities. perec wrote an entire novel without the letter 'e.'",
        },
      },
      mechanic: {
        interactionModel: "construction",
        socialStructure: "asymmetric",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "sort: design principles",
      discussionPrompt: "white space as 'final polish' is counterintuitive — most beginners add it last, but experts plan for it first. what shifts when you treat emptiness as the starting point?",
      timeLimit: 120,
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "sort each design principle by when it matters most in the creative process.",
          cards: [
            { id: "contrast", content: "contrast", hint: "making differences obvious and intentional" },
            { id: "repetition", content: "repetition", hint: "creating rhythm and consistency" },
            { id: "alignment", content: "alignment", hint: "visual connection between elements" },
            { id: "proximity", content: "proximity", hint: "grouping related elements together" },
            { id: "hierarchy", content: "hierarchy", hint: "signaling what to read first, second, third" },
            { id: "whitespace", content: "white space", hint: "breathing room, intentional emptiness" },
          ],
          categories: [
            { id: "structure", label: "structure first", description: "foundation — set up before anything else" },
            { id: "refinement", label: "refinement", description: "adjust during iteration" },
            { id: "polish", label: "final polish", description: "the last thing you tune" },
          ],
          solution: {
            hierarchy: "structure",
            alignment: "structure",
            proximity: "refinement",
            repetition: "refinement",
            contrast: "polish",
            whitespace: "polish",
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
      type: "poll",
      phase: "integration",
      label: "vote: best constraint",
      discussionPrompt: "which constraint got the fewest votes? often the most limiting one produces the most creative result. did the vote match which designs were actually most inventive?",
      timeLimit: 60,
      config: {
        type: "poll",
        poll: {
          question:
            "which constraint do you think produced the most compelling design work?",
          options: [
            { id: "mono", label: "monochrome — one color" },
            { id: "type-only", label: "type only — no images" },
            { id: "five-shapes", label: "five shapes — geometric only" },
            { id: "found", label: "found materials — collage" },
          ],
        },
      },
      mechanic: {
        interactionModel: "framing",
        socialStructure: "audience",
        tempo: "paced",
      },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: limitation as liberation",
      timeLimit: 240,
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "igor stravinsky wrote: 'the more constraints one imposes, the more one frees oneself of the chains that shackle the spirit.' think about a creative or professional challenge you're facing right now. what constraint could you deliberately impose to break through? be specific — name the project, the constraint, and what you think it would unlock.",
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
