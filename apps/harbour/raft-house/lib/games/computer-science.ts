import type { Activity } from "../types";

let _id = 0;
function uid(): string {
  return `act_${++_id}_${Date.now().toString(36)}`;
}

// ── race.condition ──────────────────────────────────────────────
// you cause the race condition
// grab → conflict → deadlock, real-time

export function raceCondition(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: concurrent access",
      discussionPrompt: "the answer is $400, not -$200 — both withdrawals succeed because they read before either writes. who fell for the sequential thinking trap?",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a bank account has $1000. two ATMs simultaneously process a $600 withdrawal. each reads the balance ($1000), confirms it's sufficient, and deducts $600. what is the final balance?",
          type: "number",
          answer: 400,
          unit: "$",
        },
      },
      timeLimit: 45,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "struggle",
      label: "simulate: you are a thread",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "you are one of four threads trying to update a shared counter from 0 to 100. each thread is supposed to increment the counter 25 times. but there's no lock — you're all reading and writing simultaneously. read your thread's experience.",
          roles: [
            {
              id: "thread-a",
              label: "thread A (eager)",
              info: "you run fast. you read the counter at 0, increment to 1, write it back. you read 1, increment to 2, write. you're blazing through your 25 increments. but at step 12 you read the counter and it says 8 — not 12. another thread wrote over your work. you keep going anyway, writing 9. you finish your 25 increments feeling productive, but the counter only reflects about 15 of them.",
              question:
                "you did the work but the results disappeared. in a real system, what kind of bugs would this create? think about money, inventory, or votes.",
            },
            {
              id: "thread-b",
              label: "thread B (slow)",
              info: "you're slow. you read the counter at 3, start computing, but by the time you write your result (4), threads A and C have already pushed it to 11. your write stomps their work — the counter drops from 11 to 4. you don't even know you've caused damage. you only see your own read-compute-write cycle. from your perspective, everything worked perfectly.",
              question:
                "you accidentally destroyed other threads' work without knowing it. how is this similar to two people editing the same document at the same time?",
            },
            {
              id: "thread-c",
              label: "thread C (observer)",
              info: "you're monitoring the counter value over time. you see: 0, 1, 2, 4, 3, 5, 4, 7, 6, 8, 8, 9, 11, 10, 12. the counter isn't monotonically increasing — it jumps backward. final value after all threads finish: 73, not 100. you can see the damage but you can't tell which thread caused which problem. the execution order is non-deterministic.",
              question:
                "the final value was 73 instead of 100. twenty-seven increments were 'lost.' if this were a voting system, what would that mean? could you even detect the problem without an observer?",
            },
            {
              id: "thread-d",
              label: "thread D (deadlocked)",
              info: "you need two resources: the counter AND a log file. you grab the counter lock. thread A grabs the log lock. you wait for the log. thread A waits for the counter. you're both frozen. neither can proceed because each holds what the other needs. the system hangs. after a timeout, the operating system kills you both, and your increments are lost entirely.",
              question:
                "you and thread A are both behaving 'correctly' — following your own logic perfectly — but together you create a deadlock. what does this teach about the relationship between local correctness and global correctness?",
            },
          ],
          discussionPrompt:
            "share what happened to your thread. thread A lost writes, thread B overwrote others, thread C saw chaos, and thread D froze. together you've experienced the four major concurrency problems: lost updates, dirty writes, non-determinism, and deadlock.",
          revealPrompt:
            "the threshold: concurrency bugs aren't caused by bad code — they're caused by the gap between how we think (sequentially, one step at a time) and how systems actually execute (interleaved, parallel, non-deterministic). the fix isn't 'be more careful' — it's rethinking the architecture.",
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "negotiation", socialStructure: "asymmetric", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "threshold",
      label: "sequence: deadlock conditions",
      discussionPrompt: "all four conditions must hold simultaneously — which one seems easiest to break in practice? that's your prevention strategy",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "coffman et al. (1971) identified four conditions that must ALL hold simultaneously for a deadlock to occur. arrange them in the order they typically develop in a system:",
          pieces: [
            {
              id: "mutual-exclusion",
              content: "mutual exclusion: at least one resource can only be held by one thread at a time",
              hint: "this is the baseline — some things can't be shared",
            },
            {
              id: "hold-wait",
              content: "hold and wait: a thread holding a resource requests another without releasing the first",
              hint: "greediness — keeping what you have while asking for more",
            },
            {
              id: "no-preemption",
              content: "no preemption: resources cannot be forcibly taken away from a thread",
              hint: "nobody can break the grip — you must wait",
            },
            {
              id: "circular-wait",
              content: "circular wait: a cycle of threads, each waiting for a resource held by the next",
              hint: "the final piece — the chain closes into a loop",
            },
          ],
          solution: ["mutual-exclusion", "hold-wait", "no-preemption", "circular-wait"],
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "poll",
      phase: "integration",
      label: "vote: prevention strategies",
      discussionPrompt: "look at the split — did anyone pick lock-free? that's the hardest to implement but the only one that eliminates the problem entirely",
      config: {
        type: "poll",
        poll: {
          question:
            "knowing the four deadlock conditions — which prevention strategy do you think is most practical for real systems?",
          options: [
            { id: "ordering", label: "impose a global ordering on resource acquisition (prevents circular wait)" },
            { id: "timeout", label: "use timeouts — if you can't get a resource in time, release everything and retry" },
            { id: "lockfree", label: "eliminate locks entirely — use lock-free data structures (compare-and-swap)" },
            { id: "detect", label: "don't prevent deadlocks — detect them and recover (kill one thread)" },
          ],
        },
      },
      mechanic: { interactionModel: "framing", socialStructure: "audience", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "application",
      label: "reflect: concurrency is everywhere",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "race conditions aren't just a programming problem. any system where multiple actors share resources without coordination has them: two chefs reaching for the same knife, two teams editing the same strategy doc, two departments spending from the same budget. describe a 'race condition' you've experienced in non-technical life. what was the shared resource? what was lost? how did you (or could you) fix it?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── type.tower ──────────────────────────────────────────────────
// tetris/jenga with types
// stack → check → balance, paced

export function typeTower(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: type safety",
      discussionPrompt: "110, not 11 — string concatenation then numeric subtraction. who traced through the types correctly on the first try?",
      config: {
        type: "prediction",
        prediction: {
          question:
            "javascript: what does '11' + 1 - 1 evaluate to? (hint: the types of the operands determine which operation happens first.)",
          type: "number",
          answer: 110,
        },
      },
      timeLimit: 45,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "struggle",
      label: "categorize: type compatibility",
      discussionPrompt: "the 'coerced' category is where bugs hide — which coercion surprised you most? why do languages allow implicit conversion at all?",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "in a strictly typed language, some operations are safe and some will crash. sort each operation by whether the type system would allow or reject it:",
          cards: [
            { id: "int-add", content: "integer + integer → integer" },
            { id: "str-add", content: "string + string → string (concatenation)" },
            { id: "int-str", content: "integer + string → ???" },
            { id: "bool-int", content: "boolean * integer → ???" },
            { id: "arr-push", content: "push(string) onto array<string>" },
            { id: "arr-wrong", content: "push(integer) onto array<string>" },
            { id: "null-call", content: "null.toString()" },
            { id: "cast", content: "treat a string as a number after explicit conversion" },
          ],
          categories: [
            {
              id: "safe",
              label: "type-safe (compiler allows)",
              description: "the types are compatible — this will work as intended",
            },
            {
              id: "unsafe",
              label: "type error (compiler rejects)",
              description: "the types don't match — this would crash or produce nonsense",
            },
            {
              id: "coerced",
              label: "works via coercion (risky)",
              description: "some languages allow this by silently converting types — convenient but dangerous",
            },
          ],
          solution: {
            "int-add": "safe",
            "str-add": "safe",
            "int-str": "coerced",
            "bool-int": "coerced",
            "arr-push": "safe",
            "arr-wrong": "unsafe",
            "null-call": "unsafe",
            cast: "safe",
          },
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "threshold",
      label: "sequence: build a type-safe stack",
      discussionPrompt: "the validate step returns User | Error — what happens to the tower if you skip error handling? that's where real systems crash",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "you're building a tower of function calls. each function's output becomes the next function's input. arrange them so the types flow correctly from bottom to top — one type mismatch and the tower collapses:",
          pieces: [
            {
              id: "fetch",
              content: "fetchData(url: string) → Response",
              hint: "the foundation — takes a url, returns raw response",
            },
            {
              id: "parse",
              content: "parseJSON(response: Response) → object",
              hint: "transforms response into structured data",
            },
            {
              id: "validate",
              content: "validateUser(data: object) → User | Error",
              hint: "checks if the data matches the User shape",
            },
            {
              id: "extract",
              content: "getEmail(user: User) → string",
              hint: "pulls a specific field — but only works on valid User",
            },
            {
              id: "send",
              content: "sendNotification(email: string) → boolean",
              hint: "the final action — needs a valid email string",
            },
          ],
          solution: ["fetch", "parse", "validate", "extract", "send"],
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: types as communication",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "type systems are often presented as restrictions — things you can't do. but they're really a communication system between present-you and future-you (or between you and your teammates). the type signature 'getEmail(user: User) → string' is a contract: 'give me a valid user and i promise to give you back a string.' where else do you see this pattern of explicit contracts preventing miscommunication? think about legal agreements, api documentation, recipe ingredients, or even social norms.",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── state.craft ─────────────────────────────────────────────────
// escape room inside a state machine
// explore → trigger → escape, paced

export function stateCraft(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: states and transitions",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a traffic light has 3 states (green, yellow, red) and cycles through them. a vending machine has states like idle, coin-inserted, dispensing, out-of-stock. how many distinct states does a simple elevator system need? (consider: which floor, direction, door open/closed, moving/stopped, for a 3-floor building.)",
          type: "number",
          answer: 18,
          unit: "states",
        },
      },
      timeLimit: 60,
      hints: [
        "3 floors x 2 directions x 3 door/motion states = 18",
        "floor: 1/2/3 — direction: up/down — status: moving/doors-open/doors-closed",
      ],
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: escape the state machine",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "you're trapped inside a state machine that controls a door lock. the lock starts in 'locked' state. you must trigger the right sequence of events to reach the 'open' state. one wrong transition sends you back to 'locked'. arrange the correct escape sequence:",
          pieces: [
            {
              id: "insert-key",
              content: "insert correct key → transition from 'locked' to 'key-accepted'",
              hint: "the lock first validates the key",
            },
            {
              id: "turn",
              content: "turn key clockwise → transition from 'key-accepted' to 'bolt-retracting'",
              hint: "mechanical action begins",
            },
            {
              id: "wait",
              content: "wait for bolt sensor → transition from 'bolt-retracting' to 'unlatched'",
              hint: "the system confirms the bolt has fully retracted",
            },
            {
              id: "push",
              content: "push handle → transition from 'unlatched' to 'open'",
              hint: "only works once the bolt is confirmed retracted",
            },
            {
              id: "timeout",
              content: "if no push within 5 seconds → auto-transition from 'unlatched' back to 'locked'",
              hint: "security feature — the window of opportunity closes",
            },
          ],
          solution: ["insert-key", "turn", "wait", "push", "timeout"],
          revealOrder: true,
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "canvas",
      phase: "threshold",
      label: "map: draw the state diagram",
      discussionPrompt:
        "did everyone place the error state in the same region? which states ended up closest to each other — and does that match the transitions you'd expect in a real music player?",
      config: {
        type: "canvas",
        canvas: {
          prompt:
            "place pins to represent the states of a simple music player: stopped, playing, paused, loading, error. then mentally trace the transitions between them. place each state where it makes spatial sense — states that can transition to each other should be near each other.",
          width: 100,
          height: 100,
          xLabel: "activity",
          yLabel: "operation status",
          xLow: "inactive",
          xHigh: "active",
          yLow: "normal operation",
          yHigh: "error state",
          zones: [
            { id: "idle", label: "idle zone", x: 0, y: 50, width: 30, height: 50 },
            { id: "active", label: "active zone", x: 40, y: 50, width: 40, height: 50 },
            { id: "error", label: "error zone", x: 0, y: 0, width: 100, height: 30 },
          ],
          allowNote: true,
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: everything is a state machine",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "state machines are everywhere — not just in software. a conversation has states (greeting → small talk → topic → closing). a relationship has states (strangers → acquaintances → friends → close friends, with possible backward transitions). a learning process has states (confusion → partial understanding → misconception → breakthrough → mastery). pick a non-technical process you know well and describe it as a state machine. what are the states? what triggers transitions? are there any 'trap states' that are hard to escape?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── signal.flow ─────────────────────────────────────────────────
// wire boxes, observe behavior, rewire under pressure
// wire → observe → rewire, real-time

export function signalFlow(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: logic gates",
      config: {
        type: "prediction",
        prediction: {
          question:
            "you have two inputs, A and B, both either 0 or 1. the AND gate outputs 1 only when both inputs are 1. the OR gate outputs 1 when at least one input is 1. if you chain them — (A AND B) OR (A AND (NOT B)) — what does this simplify to?",
          type: "text",
          answer: "just A — the expression is equivalent to A, regardless of B",
        },
      },
      timeLimit: 60,
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "rule-sandbox",
      phase: "struggle",
      label: "explore: logic circuit",
      config: {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt:
            "this is a logic circuit with two inputs and three gates. adjust the inputs and gate parameters to understand boolean algebra through direct manipulation. the formula computes: gate1(A, threshold1) combined with gate2(B, threshold2). values above the threshold output 1 (true), below output 0 (false).",
          parameters: [
            {
              id: "inputA",
              label: "input A",
              min: 0,
              max: 1,
              step: 1,
              defaultValue: 1,
            },
            {
              id: "inputB",
              label: "input B",
              min: 0,
              max: 1,
              step: 1,
              defaultValue: 0,
            },
            {
              id: "gate",
              label: "combine operation (0=AND, 1=OR, 2=XOR)",
              min: 0,
              max: 2,
              step: 1,
              defaultValue: 0,
            },
            {
              id: "invert",
              label: "invert output? (0=no, 1=yes → NAND/NOR/XNOR)",
              min: 0,
              max: 1,
              step: 1,
              defaultValue: 0,
            },
          ],
          formula:
            "(invert + ((gate * gate - 3 * gate + 2) / 2) * (inputA * inputB) + ((-gate * gate + 2 * gate) / 1) * (inputA + inputB - inputA * inputB) + ((gate * gate - gate) / 2) * ((inputA + inputB) - 2 * inputA * inputB)) % 2",
          outputLabel: "circuit output",
          reflectionPrompt:
            "try all 4 input combinations (0,0), (0,1), (1,0), (1,1) for each gate type. which gate is the 'strictest'? which is the most 'permissive'? what happens when you add inversion?",
        },
      },
      timeLimit: 180,
      mechanic: { interactionModel: "sandbox", socialStructure: "solo", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "sorting",
      phase: "threshold",
      label: "categorize: gate behaviors",
      config: {
        type: "sorting",
        sorting: {
          prompt:
            "every logic gate makes a decision. sort each real-world scenario by which logic gate best models the decision:",
          cards: [
            {
              id: "both-keys",
              content: "a nuclear launch requires two officers turning keys simultaneously",
            },
            {
              id: "any-alarm",
              content: "a fire alarm triggers if ANY sensor detects smoke",
            },
            {
              id: "toggle",
              content: "a light switch — flipping it changes the state (on→off or off→on)",
            },
            {
              id: "veto",
              content: "a proposal passes unless the president vetoes it (one 'no' blocks everything)",
            },
            {
              id: "consensus",
              content: "a jury must unanimously agree to convict",
            },
            {
              id: "difference",
              content: "an error detector that flags when two copies of data disagree",
            },
          ],
          categories: [
            {
              id: "and",
              label: "AND (all must be true)",
              description: "requires every input to be active",
            },
            {
              id: "or",
              label: "OR (any can be true)",
              description: "requires at least one input to be active",
            },
            {
              id: "xor",
              label: "XOR (exactly one must be true / difference detection)",
              description: "activated by disagreement between inputs",
            },
          ],
          solution: {
            "both-keys": "and",
            "any-alarm": "or",
            toggle: "xor",
            veto: "and",
            consensus: "and",
            difference: "xor",
          },
        },
      },
      timeLimit: 120,
      mechanic: { interactionModel: "investigation", socialStructure: "solo", tempo: "real-time" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: computational thinking",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "every digital device — your phone, a traffic light controller, a spacecraft — is built from combinations of these simple gates. an AND gate is just 'both must be true.' an OR gate is 'at least one must be true.' from these two primitives (plus NOT), you can build anything: calculators, operating systems, AI models. what does it mean that complexity emerges from combining trivially simple rules? where else have you seen this pattern — simple rules producing complex behavior?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}

// ── code.weave ──────────────────────────────────────────────────
// block drag, step-through execution
// program → run → debug, paced

export function codeWeave(): Activity[] {
  return [
    {
      id: uid(),
      type: "prediction",
      phase: "encounter",
      label: "predict: program output",
      config: {
        type: "prediction",
        prediction: {
          question:
            "a program runs these instructions: set x = 1. loop 5 times: set x = x * 2, then x = x + 1. what is the final value of x? (trace through carefully — most people get this wrong on the first try.)",
          type: "number",
          answer: 63,
        },
      },
      timeLimit: 60,
      hints: [
        "after iteration 1: x = 1*2+1 = 3",
        "after iteration 2: x = 3*2+1 = 7",
        "after iteration 3: x = 7*2+1 = 15",
      ],
      mechanic: { interactionModel: "reveal", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "puzzle",
      phase: "struggle",
      label: "sequence: sort algorithm",
      discussionPrompt: "bubble sort takes three passes for four elements — how many passes would a list of 1,000 elements need in the worst case? that's why O(n^2) matters",
      config: {
        type: "puzzle",
        puzzle: {
          prompt:
            "you're implementing bubble sort — the simplest sorting algorithm. it compares adjacent elements and swaps them if they're in the wrong order. arrange the steps to sort the list [5, 3, 8, 1] from smallest to largest:",
          pieces: [
            {
              id: "compare-1",
              content: "compare 5 and 3. 5 > 3, so swap → [3, 5, 8, 1]",
              hint: "start from the left, compare first two elements",
            },
            {
              id: "compare-2",
              content: "compare 5 and 8. 5 < 8, no swap → [3, 5, 8, 1]",
              hint: "move one position right, compare next pair",
            },
            {
              id: "compare-3",
              content: "compare 8 and 1. 8 > 1, so swap → [3, 5, 1, 8]. end of first pass. the largest element (8) has 'bubbled' to the end.",
              hint: "after one full pass, the biggest element is in place",
            },
            {
              id: "pass-2",
              content: "second pass: compare 3,5 (ok), compare 5,1 → swap → [3, 1, 5, 8]",
              hint: "repeat the process, but now 8 is already in position",
            },
            {
              id: "pass-3",
              content: "third pass: compare 3,1 → swap → [1, 3, 5, 8]. no more swaps needed. sorted!",
              hint: "each pass puts the next-largest element in place",
            },
          ],
          solution: ["compare-1", "compare-2", "compare-3", "pass-2", "pass-3"],
        },
      },
      timeLimit: 150,
      mechanic: { interactionModel: "construction", socialStructure: "solo", tempo: "paced" },
    },
    {
      id: uid(),
      type: "asymmetric",
      phase: "threshold",
      label: "perspectives: programmer vs debugger",
      config: {
        type: "asymmetric",
        asymmetric: {
          scenario:
            "a program is supposed to calculate the average of a list of numbers, but it's returning wrong results. two people are looking at the same code from different perspectives.",
          roles: [
            {
              id: "programmer",
              label: "the original programmer",
              info: "you wrote this code last week. the logic made perfect sense at the time: loop through the list, add each number to a running total, then divide by the length. you tested it with [10, 20, 30] and got 20. it works! but users are reporting that [10, 20, 30, 0] returns 20 instead of 15. you're staring at your code and it looks correct. you're tempted to say 'works on my machine.' your variable 'count' tracks how many non-zero numbers you've seen, and you divide total by count.",
              question:
                "you accidentally filtered out zeros from the count. why is this bug hard to spot when you wrote the code? what does this reveal about the difference between 'testing' and 'verifying'?",
            },
            {
              id: "debugger",
              label: "the debugger",
              info: "you've never seen this code before. the bug report says: average([10, 20, 30]) returns 20 (correct), but average([10, 20, 30, 0]) returns 20 (wrong — should be 15). you don't read the code first. instead, you test edge cases: average([0]) returns NaN. average([0, 0, 0]) returns NaN. average([1, 0]) returns 1. the pattern is clear: zeros are being ignored. now you look at the code and immediately see 'if (num !== 0) count++' — there's the bug.",
              question:
                "you found the bug faster by NOT reading the code first. instead you tested behaviors. why is this approach often more effective than reading code line by line?",
            },
            {
              id: "tester",
              label: "the QA tester",
              info: "your job is to break things before users do. you think about edge cases systematically: what happens with an empty list? a list with one element? negative numbers? very large numbers? all zeros? a mix of positive and negative that should average to zero? you write 12 test cases. the programmer's code fails on 4 of them. the interesting thing: all 4 failures involve zero in some way. this narrows the search from 'something is wrong' to 'something is wrong with how zero is handled.'",
              question:
                "you found the bug without ever reading the code — just by being systematic about inputs. how do you decide which edge cases to test? what's your mental model?",
            },
          ],
          discussionPrompt:
            "the programmer was too close to the code, the debugger used behavior-first investigation, and the tester used systematic edge cases. share your experience — which approach resonates with how you solve problems?",
          revealPrompt:
            "the threshold: debugging is not about reading code — it's about forming hypotheses and testing them. the most effective debuggers act like scientists: observe the symptom, form a theory about the cause, design an experiment to test it, and repeat. this is the scientific method applied to software.",
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "negotiation", socialStructure: "asymmetric", tempo: "paced" },
    },
    {
      id: uid(),
      type: "reflection",
      phase: "integration",
      label: "reflect: the debugging mindset",
      config: {
        type: "reflection",
        reflection: {
          prompt:
            "debugging is really a metacognitive skill — thinking about your own thinking. the programmer's bug came from an implicit assumption ('count should skip zeros') that felt so obvious they didn't even notice making it. we all carry invisible assumptions in every domain: assumptions about what users want, what team members mean, what success looks like. describe a time you were stuck on a problem (technical or not) because of an assumption you didn't realize you were making. how did you eventually discover the hidden assumption?",
          minLength: 80,
          shareWithGroup: true,
        },
      },
      timeLimit: 240,
      mechanic: { interactionModel: "framing", socialStructure: "cooperative", tempo: "paced" },
    },
  ];
}
