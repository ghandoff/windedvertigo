import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── frame.shift ─────────────────────────────────────────────────
// observe → compare → reconcile | turn-based
// split-screen asymmetric co-op about reference frames

export function frameShift(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a train moves at 80 km/h. a passenger throws a ball forward at 20 km/h relative to the train. how fast does the ball move relative to the ground?",
          type: "number",
          answer: 100,
          unit: "km/h",
        },
      },
      phase: "encounter",
      label: "predict: relative velocity",
      timeLimit: 45,
      hints: [
        "think about what 'velocity' means to each observer",
        "galilean relativity: velocities add",
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
            "two observers watch a ball drop from a moving train. each observer has a camera that records the ball's path from their position. they must compare what they see and figure out why their recordings look different.",
          roles: [
            {
              id: "ground",
              label: "ground observer",
              info: "you are standing on a platform watching a train pass at 30 m/s. a ball is released from the roof of the train. from your perspective, the ball traces a parabolic arc — it moves forward and downward simultaneously. your camera records a curved trajectory.",
              question:
                "describe the exact shape of the path you see. why does the ball move forward?",
            },
            {
              id: "train",
              label: "train observer",
              info: "you are sitting inside the train, which moves at a constant 30 m/s. a ball is released from the ceiling directly above you. from your perspective, the ball falls straight down in a vertical line. your camera records a perfectly straight drop.",
              question:
                "describe the exact shape of the path you see. why doesn't the ball move sideways?",
            },
            {
              id: "bird",
              label: "aerial observer",
              info: "you are flying in a helicopter directly above the train, looking down. the ball is released and you track it from above. from your perspective, the ball stays on a straight horizontal line — it never appears to fall. you only see its horizontal movement matching the train's motion.",
              question:
                "describe what the path looks like from above. what dimension is invisible to you?",
            },
          ],
          discussionPrompt:
            "compare your three recordings. the ball followed one physical trajectory but produced three different-looking paths. which observer is 'right'?",
          revealPrompt:
            "all three are correct. there is no privileged reference frame — this is the principle of relativity. the laws of physics are the same, but descriptions depend on where you stand.",
        },
      },
      phase: "struggle",
      label: "observe: three cameras, one ball",
      timeLimit: 240,
      hints: [
        "each observer sees a valid trajectory",
        "the disagreement is about description, not physics",
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
            "map where the three reference frames agree and disagree. place a pin for each physical quantity — does it look the same or different across frames?",
          width: 800,
          height: 600,
          xLabel: "frame agreement",
          yLabel: "frame dependence",
          xLow: "same across all frames",
          xHigh: "seems invariant but isn't",
          yLow: "frame-invariant",
          yHigh: "frame-dependent",
          zones: [
            {
              id: "invariant",
              label: "frame-invariant (same for everyone)",
              x: 0,
              y: 400,
              width: 400,
              height: 200,
            },
            {
              id: "variant",
              label: "frame-dependent (changes with observer)",
              x: 0,
              y: 0,
              width: 400,
              height: 200,
            },
            {
              id: "tricky",
              label: "seems invariant but isn't",
              x: 400,
              y: 200,
              width: 400,
              height: 200,
            },
          ],
          multiPin: true,
          minPins: 3,
          allowNote: true,
        },
      },
      phase: "threshold",
      label: "map: invariant vs. relative",
      timeLimit: 180,
      discussionPrompt:
        "which quantities did the group disagree about — did anyone place velocity or energy in the invariant zone? what does the 'tricky' zone reveal about intuitions vs. physics?",
      hints: [
        "acceleration due to gravity is the same for all observers",
        "velocity and trajectory shape change between frames",
        "the mass of the ball doesn't change",
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
            "einstein said 'the laws of physics are the same in all inertial frames.' if no observer is more correct than another, what does 'objectivity' mean in science? write about a time in your life when two people experienced the same event completely differently.",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: observer-dependence",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── entropy.garden ──────────────────────────────────────────────
// nurture → decay → grieve | time-pressure
// tamagotchi nurture with inevitable loss, thermodynamics

export function entropyGarden(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "you put an ice cube in a warm room. the room is 25C and the ice is 0C. will they ever reach exactly the same temperature, and if so, will the ice reform?",
          type: "choice",
          options: [
            {
              id: "reform",
              label: "yes, they equalize and ice eventually reforms",
            },
            {
              id: "equalize",
              label:
                "they equalize at ~25C but the ice never reforms on its own",
            },
            {
              id: "never",
              label: "they never fully equalize",
            },
          ],
          answer: "equalize",
        },
      },
      phase: "encounter",
      label: "predict: entropy",
      discussionPrompt: "who picked 'ice reforms'? that would violate the second law. what makes spontaneous re-ordering feel possible even though it isn't?",
      timeLimit: 45,
      hints: [
        "think about what 'spontaneous' means in thermodynamics",
        "have you ever seen an ice cube form from room-temperature water without a freezer?",
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
            "you're tending an entropy garden. adjust the conditions and watch how fast order decays. the 'garden health' score measures how much structure remains — it always trends toward zero. can you slow the decay? can you stop it?",
          parameters: [
            {
              id: "temp",
              label: "temperature",
              min: 0,
              max: 500,
              step: 10,
              defaultValue: 300,
              unit: "K",
            },
            {
              id: "energy",
              label: "energy input rate",
              min: 0,
              max: 100,
              step: 5,
              defaultValue: 20,
              unit: "J/s",
            },
            {
              id: "complexity",
              label: "system complexity",
              min: 1,
              max: 10,
              step: 1,
              defaultValue: 5,
            },
          ],
          formula: "100 - (temp * complexity * 0.02) + (energy * 0.8)",
          outputLabel: "garden health",
          outputUnit: "%",
          reflectionPrompt:
            "even at maximum energy input, can the garden reach 100% health at high temperatures? what does this tell you about the relationship between energy and order?",
        },
      },
      phase: "struggle",
      label: "tend: decay rates",
      timeLimit: 180,
      hints: [
        "try setting energy to maximum — does it fully compensate?",
        "living things spend enormous energy maintaining order",
        "the second law says total entropy always increases",
      ],
      mechanic: {
        interactionModel: "sandbox",
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
            "you spent time trying to keep the garden alive. it decayed anyway. how does that make you feel?",
          options: [
            { id: "frustrated", label: "frustrated — i wanted to win" },
            { id: "peaceful", label: "peaceful — decay is natural" },
            {
              id: "motivated",
              label: "motivated — the fight against entropy is meaningful",
            },
            { id: "sad", label: "sad — everything falls apart eventually" },
            {
              id: "curious",
              label: "curious — i want to understand why",
            },
          ],
          allowMultiple: true,
        },
      },
      phase: "threshold",
      label: "feel: inevitable decay",
      discussionPrompt: "look at the emotional distribution — 'frustrated' vs 'peaceful' vs 'motivated.' the same physical law produces completely different emotional responses. why?",
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
            "the second law of thermodynamics says entropy in a closed system always increases — disorder always grows. life itself is a temporary, local decrease in entropy, maintained by constant energy input. knowing that everything you build will eventually dissolve, what makes the building worthwhile?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: the second law",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── field.canvas ────────────────────────────────────────────────
// place → paint → share | real-time
// collaborative painting with electromagnetic field lines

export function fieldCanvas(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "two positive charges are placed 10 cm apart. at the exact midpoint between them, what is the net electric field strength?",
          type: "number",
          answer: 0,
          unit: "N/C",
        },
      },
      phase: "encounter",
      label: "predict: field cancellation",
      timeLimit: 60,
      hints: [
        "each charge pushes outward — think about direction, not just magnitude",
        "what happens when two equal forces point in opposite directions?",
      ],
      mechanic: {
        interactionModel: "reveal",
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
            "place charges on the field canvas. pick + or − below, then tap to place. place at least 3 charges and add a note describing what you think the field lines look like between them. try to create a region where the field is nearly zero.",
          width: 800,
          height: 800,
          xLabel: "x position (cm)",
          yLabel: "y position (cm)",
          multiPin: true,
          minPins: 3,
          pinCategories: [
            { id: "positive", label: "+ positive charge", color: "#ef4444" },
            { id: "negative", label: "− negative charge", color: "#3b82f6" },
          ],
          zones: [
            {
              id: "dipole-zone",
              label: "try a dipole here (+ and -)",
              x: 50,
              y: 50,
              width: 300,
              height: 300,
            },
            {
              id: "monopole-zone",
              label: "try same-sign charges here",
              x: 450,
              y: 50,
              width: 300,
              height: 300,
            },
            {
              id: "null-zone",
              label: "try to create a zero-field point here",
              x: 250,
              y: 450,
              width: 300,
              height: 300,
            },
          ],
          allowNote: true,
        },
      },
      phase: "struggle",
      label: "paint: field lines",
      timeLimit: 180,
      hints: [
        "field lines go from positive to negative charges",
        "like charges repel — their field lines push away from each other",
        "a zero-field point exists between two identical charges",
      ],
      mechanic: {
        interactionModel: "construction",
        socialStructure: "cooperative",
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
            "sort these electromagnetic phenomena by the type of field involved.",
          cards: [
            { id: "compass", content: "a compass needle aligns north-south" },
            {
              id: "balloon",
              content: "a balloon sticks to a wall after rubbing on hair",
            },
            {
              id: "lightning",
              content: "lightning strikes from cloud to ground",
            },
            {
              id: "mri",
              content: "an MRI machine images your brain",
            },
            {
              id: "radio",
              content: "a radio picks up a broadcast signal",
            },
            {
              id: "motor",
              content: "an electric motor spins",
            },
            {
              id: "static",
              content: "your hair stands up near a van de graaff generator",
            },
          ],
          categories: [
            {
              id: "electric",
              label: "electric field",
              description: "caused by static or moving charges",
            },
            {
              id: "magnetic",
              label: "magnetic field",
              description: "caused by moving charges or magnetic dipoles",
            },
            {
              id: "electromagnetic",
              label: "electromagnetic wave",
              description: "coupled oscillating electric and magnetic fields",
            },
          ],
          solution: {
            balloon: "electric",
            lightning: "electric",
            static: "electric",
            compass: "magnetic",
            mri: "magnetic",
            motor: "magnetic",
            radio: "electromagnetic",
          },
        },
      },
      phase: "threshold",
      label: "sort: field types",
      discussionPrompt: "the motor uses magnetic fields but requires electric current to create them — where does electric end and magnetic begin? maxwell showed they're the same thing",
      timeLimit: 120,
      hints: [
        "static electricity involves charges that aren't moving",
        "anything involving magnets or spinning relates to magnetic fields",
        "broadcast signals travel through space as waves",
      ],
      mechanic: {
        interactionModel: "investigation",
        socialStructure: "solo",
        tempo: "timed",
      },
    },
    {
      id: uid(),
      type: "open-response",
      config: {
        type: "open-response",
        openResponse: {
          prompt:
            "draw or describe the field line pattern you found most surprising on the canvas. what happened that you didn't expect?",
          responseType: "drawing",
          anonymous: false,
        },
      },
      phase: "integration",
      label: "sketch: field surprise",
      timeLimit: 120,
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
            "faraday invented the concept of 'field lines' because he couldn't do advanced math — he needed to see the physics. fields are invisible, but they fill all of space around every charge. how does making the invisible visible change the way you understand something?",
          minLength: 60,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: invisible forces",
      timeLimit: 180,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── orbit.lab ───────────────────────────────────────────────────
// launch → observe → adjust | real-time
// orbital mechanics through aim and thrust

export function orbitLab(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "the international space station orbits at ~400 km altitude. how fast does it travel to stay in orbit?",
          type: "choice",
          options: [
            { id: "slow", label: "~400 km/h (like a fast train)" },
            { id: "medium", label: "~7,700 m/s (~28,000 km/h)" },
            { id: "fast", label: "~300,000 km/s (speed of light)" },
            { id: "depends", label: "it varies constantly" },
          ],
          answer: "medium",
        },
      },
      phase: "encounter",
      label: "predict: orbital speed",
      timeLimit: 45,
      hints: [
        "the ISS completes one orbit every ~90 minutes",
        "earth's circumference at that altitude is about 42,000 km",
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
            "explore orbital mechanics. adjust the parameters to find a stable circular orbit. the output shows the orbital period — the time to complete one loop. kepler discovered that period depends only on distance, not on the satellite's mass.",
          parameters: [
            {
              id: "altitude",
              label: "orbital altitude",
              min: 200,
              max: 36000,
              step: 100,
              defaultValue: 400,
              unit: "km",
            },
            {
              id: "velocity",
              label: "orbital velocity",
              min: 1000,
              max: 12000,
              step: 100,
              defaultValue: 7700,
              unit: "m/s",
            },
            {
              id: "mass",
              label: "satellite mass",
              min: 100,
              max: 100000,
              step: 500,
              defaultValue: 420000,
              unit: "kg",
            },
          ],
          formula:
            "(2 * 3.14159 * (6371 + altitude)) / (velocity * 0.001) / 60",
          outputLabel: "orbital period",
          outputUnit: "minutes",
          reflectionPrompt:
            "change the satellite mass from 100 kg to 100,000 kg. does the orbital period change? why or why not?",
        },
      },
      phase: "struggle",
      label: "launch: orbital parameters",
      timeLimit: 180,
      hints: [
        "the ISS orbits in about 90 minutes at 400 km altitude",
        "geostationary orbit (TV satellites) is at 35,786 km — period is 1440 minutes (24 hours)",
        "try changing mass while keeping altitude and velocity the same",
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
            "plot different orbits on the map. place pins at the altitude and period combinations you discovered. label each pin with what kind of satellite might use that orbit (ISS, GPS, weather, communications).",
          width: 800,
          height: 600,
          xLabel: "altitude (km) - low to high",
          yLabel: "orbital period (min) - short to long",
          zones: [
            {
              id: "leo",
              label: "LEO (low earth orbit: ISS, hubble)",
              x: 0,
              y: 400,
              width: 200,
              height: 200,
            },
            {
              id: "meo",
              label: "MEO (medium: GPS, navigation)",
              x: 250,
              y: 200,
              width: 200,
              height: 200,
            },
            {
              id: "geo",
              label: "GEO (geostationary: comms, weather)",
              x: 550,
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
      label: "map: orbit types",
      timeLimit: 150,
      hints: [
        "LEO is 200-2,000 km (90-127 min period)",
        "GPS satellites orbit at ~20,200 km (~12 hour period)",
        "geostationary = 35,786 km, exactly 24 hour period",
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
            "kepler figured out orbital mechanics in 1609 by staring at tables of numbers for years. he found that the square of the period is proportional to the cube of the distance — a pattern hidden in data. have you ever found a pattern that took a long time to see? what made it finally click?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: kepler's patience",
      timeLimit: 210,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}

// ── time.prism ──────────────────────────────────────────────────
// read → decide → compare | paced
// branching narrative timelines, quantum mechanics

export function timePrism(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      config: {
        type: "prediction",
        prediction: {
          question:
            "in the famous double-slit experiment, individual electrons are fired one at a time at two slits. after thousands of electrons, what pattern appears on the detector screen?",
          type: "choice",
          options: [
            { id: "two", label: "two bright bands (one per slit)" },
            {
              id: "interference",
              label: "an interference pattern with many bands",
            },
            { id: "random", label: "a completely random scatter" },
            { id: "one", label: "one bright band in the center" },
          ],
          answer: "interference",
        },
      },
      phase: "encounter",
      label: "predict: wave-particle duality",
      discussionPrompt: "individual electrons hit one spot but the pattern is wave-like — who found this genuinely unsettling? that discomfort is the correct response to quantum mechanics",
      timeLimit: 60,
      hints: [
        "each individual electron hits the screen at one specific point",
        "but the pattern of many electrons reveals something wave-like",
        "this experiment was voted 'the most beautiful experiment in physics'",
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
            "a quantum particle approaches a detector. each of you will choose a different measurement to make. in quantum mechanics, the measurement you choose affects what you can know — you cannot measure everything at once. after making your choice, compare results.",
          roles: [
            {
              id: "position",
              label: "position measurer",
              info: "you choose to measure the particle's exact position. your detector clicks and tells you the particle is at x = 3.72 nm. the measurement is precise to 0.01 nm. however, after your measurement, you have almost no information about the particle's momentum — it could be moving in any direction at any speed.",
              question:
                "you know exactly where the particle is. what can you predict about where it will be in one second?",
            },
            {
              id: "momentum",
              label: "momentum measurer",
              info: "you choose to measure the particle's exact momentum. your detector tells you the particle moves at 4,500 m/s to the right, precise to 1 m/s. however, after your measurement, you have almost no information about the particle's position — it could be anywhere in the apparatus.",
              question:
                "you know exactly how fast the particle moves. what can you predict about where it is right now?",
            },
            {
              id: "spin",
              label: "spin measurer",
              info: "you choose to measure the particle's spin along the vertical axis. your detector says 'spin up.' this is definite and repeatable. but now if you try to measure spin along the horizontal axis, the result is completely random — 50/50 up or down. measuring one axis erases information about the other.",
              question:
                "your particle is definitely 'spin up' vertically. is it also 'spin up' horizontally?",
            },
          ],
          discussionPrompt:
            "each of you measured the same particle but learned completely different things. who knows the particle best? is there a 'complete' description of the particle that includes all your measurements?",
          revealPrompt:
            "heisenberg's uncertainty principle: certain pairs of properties (position/momentum, spin-x/spin-z) cannot both be known precisely. this isn't a limit of our instruments — it's a fundamental feature of reality. the particle doesn't have a definite value until measured.",
        },
      },
      phase: "struggle",
      label: "measure: incompatible questions",
      timeLimit: 240,
      hints: [
        "this isn't about imperfect instruments — it's about the nature of reality",
        "compare what each of you can predict vs. what you can't",
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
            "based on what you just experienced, which interpretation feels most right to you?",
          options: [
            {
              id: "copenhagen",
              label:
                "the particle has no definite properties until measured (copenhagen)",
            },
            {
              id: "hidden",
              label:
                "the particle has definite properties, we just can't see them (hidden variables)",
            },
            {
              id: "many-worlds",
              label:
                "every measurement splits reality into branches (many-worlds)",
            },
            {
              id: "shut-up",
              label:
                "the math works — stop asking what it 'means' (shut up and calculate)",
            },
          ],
        },
      },
      phase: "threshold",
      label: "vote: does observation create reality?",
      discussionPrompt: "look at the split between copenhagen and many-worlds — physicists are divided the same way. anyone pick 'shut up and calculate'? that's actually the most popular among working physicists",
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
            "niels bohr said 'anyone who is not shocked by quantum theory has not understood it.' the act of measurement changes the system. the observer cannot be separated from the observed. how does this challenge the idea that science discovers an objective reality 'out there'? is there a parallel to how observing people changes their behavior?",
          minLength: 100,
          shareWithGroup: true,
        },
      },
      phase: "application",
      label: "reflect: copenhagen interpretation",
      timeLimit: 240,
      mechanic: {
        interactionModel: "framing",
        socialStructure: "solo",
        tempo: "contemplative",
      },
    },
  ];
}
