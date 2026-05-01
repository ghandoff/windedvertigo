import type { AgeLevel } from "../types";

/**
 * Text variants for age-level adaptation.
 * Key format: `${gameName}:${activityId}:${field}`
 * Only entries that DIFFER from professional are stored.
 * Professional text lives in the game files themselves.
 *
 * Activity ID convention: {game-prefix}-{phase}-{type}
 * e.g. pg = proof.garden, ih = infinity.hotel, etc.
 *
 * Games covered (15 highest-priority, grade >= 9):
 *   mathematics:       proof.garden, infinity.hotel, fold.space, pattern.weave, variable.engine
 *   computer-science:  race.condition, type.tower
 *   physics:           time.prism
 *   chemistry:         bond.craft, equilibrium.dance, reaction.path
 *   economics:         margin.call, scale.shift
 *   psychology:        bias.lens
 *   philosophy:        ought.machine, circle.read, lens.shift, liminal.pass
 */
export const VARIANTS: Record<string, Partial<Record<AgeLevel, string>>> = {

  // ═══════════════════════════════════════════════════════════════
  // proof.garden
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "proof.garden:pg-encounter-prediction:question": {
    kids: "a really old mathematician named euclid showed that prime numbers never run out. his proof is super famous for being short. how many lines do you think the main idea takes?",
    highschool: "euclid proved there are infinitely many primes around 300 BCE. his proof is famously elegant. how many lines does the core argument take?",
  },

  // struggle — puzzle
  "proof.garden:pg-struggle-puzzle:prompt": {
    kids: "there's a famous proof that shows the square root of 2 can't be written as a simple fraction. it works by assuming the opposite and finding a problem. put the steps in order:",
    highschool: "the classic proof that sqrt(2) is irrational uses contradiction — assume the opposite and find an impossibility. arrange the steps in logical order:",
  },
  "proof.garden:pg-struggle-puzzle:piece:assume": {
    kids: "start by pretending sqrt(2) = a/b, where a/b is already simplified (no common factors)",
    highschool: "assume sqrt(2) = a/b where a/b is in lowest terms (no common factors)",
  },
  "proof.garden:pg-struggle-puzzle:piece:square": {
    kids: "square both sides: 2 = a^2 / b^2, which means a^2 = 2 times b^2",
    highschool: "square both sides: 2 = a^2 / b^2, so a^2 = 2b^2",
  },
  "proof.garden:pg-struggle-puzzle:piece:a-even": {
    kids: "since a^2 equals 2 times something, a^2 is even. that means a must be even too. call it a = 2k.",
    highschool: "since a^2 is even (equals 2b^2), a must be even. write a = 2k.",
  },
  "proof.garden:pg-struggle-puzzle:piece:substitute": {
    kids: "put a = 2k back in: (2k)^2 = 2b^2 becomes 4k^2 = 2b^2, so b^2 = 2k^2",
    highschool: "substitute a = 2k: (2k)^2 = 2b^2 gives 4k^2 = 2b^2, so b^2 = 2k^2",
  },
  "proof.garden:pg-struggle-puzzle:piece:b-even": {
    kids: "wait — now b^2 = 2 times something too, so b is also even!",
    highschool: "since b^2 = 2k^2, b must also be even",
  },
  "proof.garden:pg-struggle-puzzle:piece:contradiction": {
    kids: "but we said a/b had no common factors! if both are even, they share the factor 2. that's impossible — so our starting guess was wrong. sqrt(2) can't be a fraction.",
    highschool: "but if both a and b are even, they share factor 2 — contradicting 'lowest terms.' therefore sqrt(2) is irrational.",
  },

  // threshold — asymmetric
  "proof.garden:pg-threshold-asymmetric:scenario": {
    kids: "three people have very different ideas about what makes a math proof real. read your character's view and answer the question.",
    highschool: "three mathematicians from different traditions disagree about what makes a proof valid. each has a different view of mathematical truth. read your perspective and answer.",
  },
  "proof.garden:pg-threshold-asymmetric:role:platonist:info": {
    kids: "you believe math is real — numbers and shapes exist even if no one is thinking about them. the number 7 existed before people did! when we prove something in math, we're discovering something that was already true, like an explorer finding a new island.",
    highschool: "you believe mathematical objects are real — they exist independently of human minds. when we prove a theorem, we discover something that was already true. pi was irrational before anyone proved it. math 'works' in physics because we're discovering real structure.",
  },
  "proof.garden:pg-threshold-asymmetric:role:platonist:question": {
    kids: "if math is something we discover (not make up), then what is a mathematician doing when they write a proof? are they more like explorers or newspaper reporters?",
    highschool: "if math is discovered, not invented, what exactly is a mathematician doing when they write a proof? are they more like explorers or reporters?",
  },
  "proof.garden:pg-threshold-asymmetric:role:formalist:info": {
    kids: "you believe math is like a game with rules. a proof is just following the rules step by step — there's no magical 'math world' out there. the reason we care about the rules being consistent is practical: if the rules break, you can prove anything is true, which is useless.",
    highschool: "you believe math is a formal game played with symbols according to rules. a proof is a sequence of symbol manipulations that follows the rules — nothing more. there's no 'mathematical reality.' truth in math means 'provable from the starting rules.'",
  },
  "proof.garden:pg-threshold-asymmetric:role:formalist:question": {
    kids: "if math is just a game with rules, why does it describe the real world so well? is that just luck?",
    highschool: "if math is just a symbol game, why does it describe the physical world so well? is that a coincidence?",
  },
  "proof.garden:pg-threshold-asymmetric:role:intuitionist:info": {
    kids: "you believe math only exists in our minds. something is only true in math if we can actually build it or show it step by step. you can't just say 'it must be true because the opposite doesn't work' — you have to actually construct the answer.",
    highschool: "you believe mathematical objects are mental constructions. a statement is only true if we can construct a proof of it. you can't prove something exists just by showing its nonexistence leads to contradiction — you must actually build the object.",
  },
  "proof.garden:pg-threshold-asymmetric:role:intuitionist:question": {
    kids: "the sqrt(2) proof works by showing the opposite can't be true. do you think that's a good enough reason to believe something? why or why not?",
    highschool: "the proof that sqrt(2) is irrational uses contradiction — proving something by showing the opposite fails. should we trust this kind of proof? why or why not?",
  },
  "proof.garden:pg-threshold-asymmetric:discussionPrompt": {
    kids: "share what your character believes. one says proofs discover truth, one says they follow rules, and one says they build things. can a proof be right in one system but wrong in another?",
    highschool: "share what your mathematician believes. the platonist discovers truth, the formalist follows rules, the intuitionist constructs objects. can a proof be valid in one system and invalid in another?",
  },

  // integration — reflection
  "proof.garden:pg-integration-reflection:prompt": {
    kids: "you've seen that a proof can be like a chain of logic (sqrt(2)) and also a big debate about what counts as real math. a famous mathematician named godel showed that in any math system, there are true things that can never be proven. what does that make you think about whether we can ever know everything? does this change how sure you feel about things — in math or in life?",
    highschool: "you've seen proof as a logical chain (sqrt(2)) and a philosophical battleground (what counts as valid reasoning). godel proved in 1931 that any consistent system powerful enough for arithmetic must contain true statements it cannot prove. what does this mean for the idea of 'complete knowledge'? does it change how you think about certainty?",
  },

  // ═══════════════════════════════════════════════════════════════
  // infinity.hotel
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "infinity.hotel:ih-encounter-prediction:question": {
    kids: "imagine a hotel with rooms numbered 1, 2, 3, 4... going on forever. every single room is full. a new guest shows up. can you fit them in? if yes, how many guests need to switch rooms?",
    highschool: "hilbert's hotel has infinitely many rooms, all occupied. a new guest arrives. can you fit them in? if so, how many guests need to move?",
  },

  // struggle — puzzle
  "infinity.hotel:ih-struggle-puzzle:prompt": {
    kids: "a bus with an infinite number of passengers arrives at the already-full infinite hotel. put the hotel manager's plan in the right order:",
    highschool: "an infinitely long bus arrives at hilbert's fully-booked hotel. every seat has a passenger. put the manager's strategy in order:",
  },
  "infinity.hotel:ih-struggle-puzzle:piece:double": {
    kids: "ask each guest in room n to move to room 2 times n (so room 1 goes to room 2, room 2 goes to room 4, room 3 goes to room 6...)",
    highschool: "ask each guest in room n to move to room 2n (doubling their room number)",
  },
  "infinity.hotel:ih-struggle-puzzle:piece:odd-free": {
    kids: "now look — all the odd-numbered rooms (1, 3, 5, 7...) are empty!",
    highschool: "observe that all odd-numbered rooms (1, 3, 5, 7...) are now empty",
  },
  "infinity.hotel:ih-struggle-puzzle:piece:assign-bus": {
    kids: "put bus passenger number k in odd room 2k - 1 (passenger 1 gets room 1, passenger 2 gets room 3, passenger 3 gets room 5...)",
    highschool: "assign bus passenger k to odd room 2k - 1",
  },

  // threshold — sorting
  "infinity.hotel:ih-threshold-sorting:prompt": {
    kids: "some infinities are bigger than others! sort each group of numbers into 'countable' (you can list them 1, 2, 3...) or 'uncountable' (impossible to list, no matter how hard you try):",
    highschool: "cantor proved some infinities are bigger than others. sort each set into 'countable infinity' (can be listed 1, 2, 3...) or 'uncountable infinity' (cannot be listed no matter what):",
  },

  // integration — poll
  "infinity.hotel:ih-integration-poll:question": {
    kids: "which thing about infinity is the most mind-bending to you?",
    highschool: "which property of infinity is most counterintuitive to you?",
  },

  // application — reflection
  "infinity.hotel:ih-application-reflection:prompt": {
    kids: "our brains are used to counting things we can see and touch. hilbert's hotel shows that infinity doesn't follow the normal rules — a full hotel can still fit more guests! can you think of a time when something that works for small numbers stops working for really big ones? like, what changes when you go from a small group to a huge crowd?",
    highschool: "our intuitions about size and 'more' were built for finite collections. hilbert's hotel shows these break at infinity — a full hotel has room for infinitely more. where else might your finite intuitions mislead you? think about a domain where scale changes the rules.",
  },

  // ═══════════════════════════════════════════════════════════════
  // fold.space
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "fold.space:fs-encounter-prediction:question": {
    kids: "take a square piece of paper. fold it in half, then in half again. now cut one straight line through the folded corner. when you open it up, how many separate pieces do you have?",
    highschool: "take a square piece of paper, fold it in half twice, then cut a single straight line through the folded corner. when you unfold, how many separate pieces do you have?",
  },

  // struggle — puzzle
  "fold.space:fs-struggle-puzzle:prompt": {
    kids: "a paper crane has a special fold order. each fold sets up the next one. put these folds in the right order:",
    highschool: "the traditional origami crane has a precise fold sequence. each fold creates structure the next depends on. put them in order:",
  },

  // threshold — canvas
  "fold.space:fs-threshold-canvas:prompt": {
    kids: "imagine you unfolded a paper crane and looked at all the crease lines on the flat paper. where are the lines of symmetry? a line of symmetry is where one side mirrors the other. put pins where you see them.",
    highschool: "you're looking at a flattened crane crease pattern. place pins where you see axes of symmetry. how many distinct axes does the crease pattern have?",
  },

  // integration — reflection
  "fold.space:fs-integration-reflection:prompt": {
    kids: "there's a rule in paper folding: any crease pattern that folds flat must have an even number of creases meeting at each point. folding paper is actually doing math with your hands! what does it mean that you can use a real object to prove something in math? how is folding paper different from writing math on a whiteboard?",
    highschool: "the flat-fold theorem says any crease pattern that folds flat must have an even number of creases at each vertex, alternating mountain and valley. folding paper is literally doing topology with your hands. what does it mean that a physical object can 'prove' a theorem? how is this different from a symbolic proof?",
  },

  // ═══════════════════════════════════════════════════════════════
  // pattern.weave
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "pattern.weave:pw-encounter-prediction:question": {
    kids: "the pattern goes: 1, 1, 2, 3, 5, 8, 13, 21, 34. what comes next? (hint: look at how each number relates to the two before it.)",
    highschool: "the sequence: 1, 1, 2, 3, 5, 8, 13, 21, 34. what is the next number? (hint: look at the relationship between consecutive terms.)",
  },

  // struggle — puzzle
  "pattern.weave:pw-struggle-puzzle:prompt": {
    kids: "someone made a number pattern using a secret rule. the numbers are: 2, 6, 12, 20, 30, 42. figure out the rule by putting these clues in order:",
    highschool: "someone created a sequence using a multi-step rule. the output is: 2, 6, 12, 20, 30, 42. work backwards — arrange these observations to crack the code:",
  },

  // threshold — rule-sandbox
  "pattern.weave:pw-threshold-sandbox:prompt": {
    kids: "build your own number pattern! move the sliders to change the formula that makes each number. try to make a pattern that looks surprising but actually follows a simple rule.",
    highschool: "build your own sequence by adjusting a general quadratic generator. try to create a sequence that looks surprising but follows a simple rule.",
  },
  "pattern.weave:pw-threshold-sandbox:reflectionPrompt": {
    kids: "what slider settings made the most interesting pattern? can you describe what the numbers do without using the formula?",
    highschool: "what combination of a, b, c produces an interesting sequence? can you describe in words what the sequence 'looks like' without the formula?",
  },

  // integration — sorting
  "pattern.weave:pw-integration-sorting:prompt": {
    kids: "number patterns come in different families depending on how they grow. sort each famous pattern into its family:",
    highschool: "sequences have different characters based on their growth patterns. sort each famous sequence into its family:",
  },

  // application — reflection
  "pattern.weave:pw-application-reflection:prompt": {
    kids: "you learned how to spot patterns: look at differences, find what stays the same, test a rule, and predict what comes next. but here's the tricky part — the same numbers can hide different rules! the sequence 1, 2, 4, 8 could be 'keep doubling' (next: 16) or it could be something totally different (next: 15, not 16). have you ever been sure about a pattern that turned out to be wrong? how would you tell two possible rules apart?",
    highschool: "you've seen pattern recognition as a skill: take differences, find constants, test a formula, predict. but the same data can hide different rules — 1, 2, 4, 8 could be powers of 2 (next: 16) or regions on a circle (next: 15). where have you been confident about a pattern that turned out wrong? what would it take to tell two plausible rules apart?",
  },

  // ═══════════════════════════════════════════════════════════════
  // variable.engine
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "variable.engine:ve-encounter-prediction:question": {
    kids: "start with x = 3. do these steps in order: double it, add 5, multiply the answer by itself, then subtract 100. what number do you end up with?",
    highschool: "start with x = 3. apply in order: double it, add 5, square the result, subtract 100. what's the final value?",
  },

  // struggle — rule-sandbox
  "variable.engine:ve-struggle-sandbox:prompt": {
    kids: "this is a math machine with three stages. move the sliders to change the input and see what comes out. try to guess the output before you move each slider! notice how changing something early changes everything after it.",
    highschool: "this is a three-stage algebraic machine. adjust the input and coefficients to understand how operations compose. try to predict the output before moving each slider. notice cascading effects.",
  },
  "variable.engine:ve-struggle-sandbox:reflectionPrompt": {
    kids: "what happens to the answer when you change the multiplier versus the number you add? which slider makes the biggest difference, and why do you think that is?",
    highschool: "what happens to the output when you change the multiplier (a) versus the addend (b)? which parameter has the most dramatic effect, and why?",
  },

  // threshold — sorting
  "variable.engine:ve-threshold-sorting:prompt": {
    kids: "math expressions grow in different ways. sort each one by how fast it grows:",
    highschool: "algebraic expressions have different structures that determine their behavior. sort each by its fundamental type:",
  },

  // integration — reflection
  "variable.engine:ve-integration-reflection:prompt": {
    kids: "algebra is about combining simple steps into bigger machines. you saw how changing one small thing at the start changes everything down the line. where do you see this in real life? think about a system where one small change at the beginning causes a big change at the end. what's the thing that makes the biggest difference?",
    highschool: "algebra is about composition — combining simple operations into complex machines. changing one early parameter cascades through the chain. where do you see this outside math? think about a system where small upstream changes create large downstream effects. what's the 'multiplier'?",
  },

  // ═══════════════════════════════════════════════════════════════
  // race.condition
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "race.condition:rc-encounter-prediction:question": {
    kids: "a bank account has $1000. two ATMs try to take out $600 at the exact same time. each one checks the balance ($1000), says 'ok, that's enough,' and takes $600. what's left in the account?",
    highschool: "a bank account has $1000. two ATMs simultaneously process a $600 withdrawal. each reads the balance ($1000), confirms it's sufficient, and deducts $600. what is the final balance?",
  },

  // struggle — asymmetric
  "race.condition:rc-struggle-asymmetric:scenario": {
    kids: "you are one of four workers (called 'threads') all trying to update the same counter from 0 to 100. each of you is supposed to add 1 to the counter 25 times. but nobody is taking turns — you're all reading and writing at the same time! read what happens to your worker.",
    highschool: "you are one of four threads trying to update a shared counter from 0 to 100. each thread should increment the counter 25 times. but there's no lock — you're all reading and writing simultaneously. read your thread's experience.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-a:info": {
    kids: "you work really fast. you read 0, change it to 1, write it back. you read 1, change it to 2, write it. you're zooming through your 25 turns. but at step 12 the counter says 8 — not 12! another worker wrote over your work. you keep going anyway. you finish all 25 of your turns feeling great, but the counter only shows about 15 of them.",
    highschool: "you run fast. you read 0, increment to 1, write it back. you're blazing through your 25 increments. but at step 12 the counter says 8 — another thread wrote over your work. you finish your 25 increments, but only about 15 are reflected.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-a:question": {
    kids: "you did the work but the results disappeared. if this happened with real money or real votes instead of a counter, what kind of problems would it cause?",
    highschool: "you did the work but the results disappeared. in a real system, what kind of bugs would this create? think about money, inventory, or votes.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-b:info": {
    kids: "you're slow. you read the counter at 3, take your time thinking, but by the time you write your answer (4), the other workers already pushed the counter to 11. your write stomps on their work — the counter drops from 11 to 4. you don't even know you caused a problem.",
    highschool: "you're slow. you read the counter at 3, but by the time you write 4, threads A and C pushed it to 11. your write stomps their work — the counter drops from 11 to 4. from your perspective, everything worked fine.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-b:question": {
    kids: "you accidentally erased other workers' progress without even knowing it. how is this like two people editing the same document at the same time?",
    highschool: "you destroyed other threads' work without knowing it. how is this similar to two people editing the same document simultaneously?",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-c:info": {
    kids: "you're watching the counter over time. you see: 0, 1, 2, 4, 3, 5, 4, 7, 6, 8, 8, 9, 11, 10, 12. the counter keeps jumping backwards! at the end, it says 73 instead of 100. twenty-seven additions just vanished.",
    highschool: "you're monitoring the counter. you see it jump backward repeatedly: 0, 1, 2, 4, 3, 5, 4, 7... final value: 73, not 100. twenty-seven increments were lost. the execution order is non-deterministic.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-c:question": {
    kids: "27 additions just disappeared. if this were a voting system, what would that mean? could you even tell something went wrong without a watcher like you?",
    highschool: "27 increments were 'lost.' if this were a voting system, what would that mean? could you detect the problem without an observer?",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-d:info": {
    kids: "you need two things: the counter AND a log file. you grab the counter. worker A grabs the log. you wait for the log. worker A waits for the counter. you're both stuck! neither can move because each has what the other needs. eventually, the system gives up and shuts you both down.",
    highschool: "you need the counter AND a log file. you grab the counter lock; thread A grabs the log lock. you wait for the log; A waits for the counter. you're both frozen — deadlocked. the system kills you both after a timeout.",
  },
  "race.condition:rc-struggle-asymmetric:role:thread-d:question": {
    kids: "you and worker A were both doing the right thing, but together you got stuck. what does this teach about how something can work perfectly on its own but break when combined with others?",
    highschool: "you and thread A both behaved 'correctly' individually but created a deadlock together. what does this teach about local correctness vs global correctness?",
  },

  // threshold — puzzle
  "race.condition:rc-threshold-puzzle:prompt": {
    kids: "there are four things that must ALL be true at the same time for a deadlock to happen. put them in the order they usually develop:",
    highschool: "coffman et al. identified four conditions that must all hold for deadlock. arrange them in the order they typically develop:",
  },

  // integration — poll
  "race.condition:rc-integration-poll:question": {
    kids: "now that you know the four things that cause deadlocks — which way of preventing them do you think works best in the real world?",
    highschool: "knowing the four deadlock conditions — which prevention strategy do you think is most practical for real systems?",
  },

  // application — reflection
  "race.condition:rc-application-reflection:prompt": {
    kids: "race conditions aren't just a computer thing. any time multiple people share something without taking turns, problems happen: two chefs reaching for the same knife, two teams editing the same document, two groups spending from the same budget. describe a 'race condition' from your own life. what was the shared thing? what went wrong? how did you fix it (or how could you)?",
    highschool: "race conditions aren't just a programming problem. any system where multiple actors share resources without coordination has them. describe a 'race condition' you've experienced in non-technical life. what was the shared resource? what was lost? how did you fix it?",
  },

  // ═══════════════════════════════════════════════════════════════
  // type.tower
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "type.tower:tt-encounter-prediction:question": {
    kids: "in javascript, what does '11' + 1 - 1 give you? (hint: the computer treats text and numbers differently, and the order matters!)",
    highschool: "javascript: what does '11' + 1 - 1 evaluate to? (hint: the types of the operands determine which operation happens first.)",
  },

  // struggle — sorting
  "type.tower:tt-struggle-sorting:prompt": {
    kids: "in a strict programming language, some operations work and some will crash. sort each one by whether the computer would allow it or not:",
    highschool: "in a strictly typed language, some operations are safe and some will crash. sort each by whether the type system would allow or reject it:",
  },

  // threshold — puzzle
  "type.tower:tt-threshold-puzzle:prompt": {
    kids: "you're building a tower of functions. each function's output goes into the next function as input. put them in order so the types match up — one mismatch and the tower falls!",
    highschool: "you're building a tower of function calls. each function's output becomes the next's input. arrange them so types flow correctly — one mismatch and the tower collapses:",
  },

  // integration — reflection
  "type.tower:tt-integration-reflection:prompt": {
    kids: "type systems are often seen as rules that stop you from doing things. but they're really a way to communicate — like a promise between you now and you later (or between you and your teammates). the function signature 'getEmail(user: User) -> string' is a promise: 'give me a valid user and i'll give you back a text string.' where else do you see this kind of promise in life? think about recipes, game rules, or agreements between friends.",
    highschool: "type systems are often seen as restrictions, but they're really a communication system between present-you and future-you (or teammates). 'getEmail(user: User) -> string' is a contract. where else do you see explicit contracts preventing miscommunication? think about APIs, recipes, legal agreements, or social norms.",
  },

  // ═══════════════════════════════════════════════════════════════
  // time.prism
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "time.prism:tp-encounter-prediction:question": {
    kids: "in a famous experiment, tiny particles called electrons are shot one at a time through two tiny slits. after thousands of electrons, what pattern shows up on the screen behind the slits?",
    highschool: "in the double-slit experiment, individual electrons are fired one at a time at two slits. after thousands of electrons, what pattern appears on the detector?",
  },

  // struggle — asymmetric
  "time.prism:tp-struggle-asymmetric:scenario": {
    kids: "a tiny quantum particle approaches a detector. each of you will choose a different thing to measure. the weird part: in quantum physics, what you choose to measure changes what you can know! after making your choice, compare what you found out.",
    highschool: "a quantum particle approaches a detector. each of you chooses a different measurement. in quantum mechanics, your measurement choice affects what you can know — you can't measure everything at once. compare results.",
  },
  "time.prism:tp-struggle-asymmetric:role:position:info": {
    kids: "you chose to find out exactly where the particle is. your detector clicks and says the particle is at a very precise spot. but now you have no idea how fast it's moving or which direction it's going!",
    highschool: "you measure the particle's exact position: x = 3.72 nm, precise to 0.01 nm. however, after this measurement, you have almost no information about the particle's momentum — it could be moving in any direction at any speed.",
  },
  "time.prism:tp-struggle-asymmetric:role:position:question": {
    kids: "you know exactly where the particle is right now. can you predict where it will be in one second? why or why not?",
    highschool: "you know exactly where the particle is. what can you predict about where it will be in one second?",
  },
  "time.prism:tp-struggle-asymmetric:role:momentum:info": {
    kids: "you chose to find out exactly how fast the particle is moving. your detector tells you it's going a certain speed to the right. but now you have no idea where the particle actually is!",
    highschool: "you measure the particle's exact momentum: 4,500 m/s to the right, precise to 1 m/s. however, you now have almost no information about its position — it could be anywhere in the apparatus.",
  },
  "time.prism:tp-struggle-asymmetric:role:momentum:question": {
    kids: "you know exactly how fast the particle is moving. can you say where it is right now? why is that hard?",
    highschool: "you know exactly how fast the particle moves. what can you predict about where it is right now?",
  },
  "time.prism:tp-struggle-asymmetric:role:spin:info": {
    kids: "you chose to measure which way the particle is spinning (up or down). your detector says 'spin up.' great! but now if you try to measure if it's spinning left or right, the answer is totally random — 50/50.",
    highschool: "you measure spin along the vertical axis: 'spin up.' this is definite and repeatable. but measuring spin along the horizontal axis is now completely random — 50/50. measuring one axis erases info about the other.",
  },
  "time.prism:tp-struggle-asymmetric:role:spin:question": {
    kids: "your particle is definitely spinning 'up.' is it also spinning 'left' or 'right'? can you even answer that question?",
    highschool: "your particle is definitely 'spin up' vertically. is it also 'spin up' horizontally?",
  },

  // threshold — poll
  "time.prism:tp-threshold-poll:question": {
    kids: "based on what you just learned, which explanation makes the most sense to you?",
    highschool: "based on what you experienced, which interpretation feels most right to you?",
  },

  // application — reflection
  "time.prism:tp-application-reflection:prompt": {
    kids: "a famous physicist named niels bohr said 'anyone who is not shocked by quantum theory has not understood it.' the act of measuring changes the thing you're measuring — you can't just watch without affecting it. how does this challenge the idea that science discovers a world that's just 'out there'? can you think of a time when watching someone changed how they behaved?",
    highschool: "bohr said 'anyone not shocked by quantum theory has not understood it.' measurement changes the system — the observer can't be separated from the observed. how does this challenge the idea that science discovers an objective reality 'out there'? is there a parallel to how observing people changes their behavior?",
  },

  // ═══════════════════════════════════════════════════════════════
  // bond.craft
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "bond.craft:bc-encounter-prediction:question": {
    kids: "diamond and table salt are both hard crystals. which one has a higher melting point — which one is harder to melt?",
    highschool: "diamond and table salt are both crystalline solids. which has a higher melting point?",
  },

  // struggle — sorting
  "bond.craft:bc-struggle-sorting:prompt": {
    kids: "atoms stick together in different ways. sort each material by the main way its atoms are connected:",
    highschool: "sort each molecule or material into its primary bond type. some might surprise you.",
  },

  // threshold — canvas
  "bond.craft:bc-threshold-canvas:prompt": {
    kids: "place each type of bond on the map. think about how different the atoms are (left to right) and how strong the bond is (bottom to top).",
    highschool: "place each bond type on the map. where does each sit in terms of electronegativity difference and bond strength?",
  },

  // integration — asymmetric
  "bond.craft:bc-integration-asymmetric:scenario": {
    kids: "you are atoms! each of you has a different number of outer electrons and a different 'pull' on electrons. find a partner and figure out how to share or trade electrons to become stable.",
    highschool: "you are atoms with different electronegativity and electron needs. find a partner and negotiate how to share or transfer electrons.",
  },
  "bond.craft:bc-integration-asymmetric:role:sodium:info": {
    kids: "you have 1 extra electron in your outer shell and you really want to get rid of it. you're generous — you'll happily give it away. but when you do, you become positively charged (like a tiny magnet with a + sign). you need to find someone who wants an extra electron.",
    highschool: "you have 1 valence electron and low electronegativity (0.93). you want to lose that electron to reach a full shell. you become positively charged when you give it up. you need someone electronegative enough to take it.",
  },
  "bond.craft:bc-integration-asymmetric:role:chlorine:info": {
    kids: "you have 7 electrons in your outer shell and you need just 1 more to be complete. you pull electrons toward yourself really hard. you'd love to take an electron from someone willing to give one up, and you'll become negatively charged.",
    highschool: "you have 7 valence electrons and high electronegativity (3.16). you need 1 more electron for a complete octet. you pull electrons strongly and would happily accept one, becoming negatively charged.",
  },
  "bond.craft:bc-integration-asymmetric:role:carbon:info": {
    kids: "you have 4 electrons in your outer shell — right in the middle. you don't want to give them away or take more. you'd rather share! you can make up to 4 connections, which makes you super flexible. you're the building block of all living things!",
    highschool: "you have 4 valence electrons and moderate electronegativity (2.55). you prefer sharing over gaining or losing. you can form up to 4 bonds, making you incredibly versatile — the backbone of organic chemistry.",
  },
  "bond.craft:bc-integration-asymmetric:role:oxygen:info": {
    kids: "you have 6 electrons and need 2 more. you pull really hard on shared electrons. when you share with someone who pulls less than you, the electrons hang out near you more — making you slightly negative and your partner slightly positive.",
    highschool: "you have 6 valence electrons and high electronegativity (3.44). you need 2 more. when sharing with less electronegative atoms, electrons spend more time near you, creating polarity.",
  },

  // application — reflection
  "bond.craft:bc-application-reflection:prompt": {
    kids: "the line between ionic and covalent bonds isn't a sharp line — it's more like a gradient, going smoothly from one to the other. describe something in the real world where two categories actually blend into each other instead of being separate. how does the blending change things?",
    highschool: "the line between ionic and covalent bonding is a spectrum, not a boundary. describe a real-world material where this ambiguity matters. how does partial ionic/covalent character affect properties?",
  },

  // ═══════════════════════════════════════════════════════════════
  // equilibrium.dance
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "equilibrium.dance:ed-encounter-prediction:question": {
    kids: "a sealed glass container has a colorless gas and a brown gas, and they keep turning into each other. you put the container in ice water. what happens to the color?",
    highschool: "a sealed flask contains N2O4 (colorless) in equilibrium with NO2 (brown). you plunge it into ice water. what happens to the color?",
  },

  // struggle — rule-sandbox
  "equilibrium.dance:ed-struggle-sandbox:prompt": {
    kids: "explore how changing things affects a chemical balancing act. the haber process turns nitrogen and hydrogen into ammonia (a fertilizer ingredient). move the sliders to see how concentration, temperature, and pressure change how much ammonia you get.",
    highschool: "explore le chatelier's principle. adjust concentration, temperature, and pressure to see how the equilibrium shifts for the haber process: N2 + 3H2 <-> 2NH3 (delta H = -92 kJ/mol)",
  },
  "equilibrium.dance:ed-struggle-sandbox:reflectionPrompt": {
    kids: "factories run this reaction at 450 degrees even though lower temperatures make more ammonia. why would they do that? what's the trade-off?",
    highschool: "why do industrial plants run the haber process at 450C if lower temperatures give higher yields? what trade-off are they making?",
  },

  // threshold — sorting
  "equilibrium.dance:ed-threshold-sorting:prompt": {
    kids: "when you change something about a balanced chemical reaction, it shifts to fight back. sort each change by which direction the balance moves:",
    highschool: "for each change applied to an equilibrium system, sort by which direction the equilibrium shifts.",
  },

  // integration — poll
  "equilibrium.dance:ed-integration-poll:question": {
    kids: "which sentence best explains why chemical equilibrium is 'active' rather than 'still'?",
    highschool: "which statement best captures why equilibrium is 'dynamic' rather than 'static'?",
  },

  // application — reflection
  "equilibrium.dance:ed-application-reflection:prompt": {
    kids: "chemical balance exists outside of chemistry too — in nature, in your body, and even in friendships. describe something in your life that stays balanced because two opposite things are happening at the same time. what are the two sides? what would throw it off balance?",
    highschool: "equilibrium exists outside chemistry — ecosystems, economies, your body. describe a non-chemistry system that behaves like dynamic equilibrium. what are the 'reactants' and 'products'? what would a le chatelier-style stress look like?",
  },

  // ═══════════════════════════════════════════════════════════════
  // reaction.path
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "reaction.path:rp-encounter-prediction:question": {
    kids: "a special material called platinum is added to hydrogen peroxide (the stuff that fizzes on cuts). it makes the reaction happen way faster. the energy needed to start the reaction drops a lot. by roughly how many times does the reaction speed up?",
    highschool: "a platinum catalyst is added to H2O2 decomposition. the activation energy drops from 75 to 49 kJ/mol. by roughly what factor does the reaction rate increase at 25C?",
  },

  // struggle — rule-sandbox
  "reaction.path:rp-struggle-sandbox:prompt": {
    kids: "explore how temperature, a helper substance (catalyst), and concentration affect how fast a reaction goes. move the sliders to see which one makes the biggest difference.",
    highschool: "explore how temperature, catalyst, and concentration affect reaction rate. the formula models rate using arrhenius-style dependence. adjust sliders to see sensitivity to each parameter.",
  },
  "reaction.path:rp-struggle-sandbox:reflectionPrompt": {
    kids: "which slider changed the speed the most? why is temperature so much more powerful than just adding more stuff?",
    highschool: "which parameter had the biggest effect on rate? why is temperature so much more powerful than concentration?",
  },

  // threshold — puzzle
  "reaction.path:rp-threshold-puzzle:prompt": {
    kids: "you are a tiny molecule! trace your path through a chemical reaction step by step. put the steps in order as you bump into another molecule and transform:",
    highschool: "arrange the steps of the SN2 reaction mechanism between CH3Br and OH- in order. you are the hydroxide ion — trace your path through the energy landscape.",
  },

  // integration — canvas
  "reaction.path:rp-integration-canvas:prompt": {
    kids: "draw the energy hill for this reaction. place pins for: where you start (reactants), the top of the hill (the hard part), and where you end up (products). does the reaction end up higher or lower than where it started?",
    highschool: "sketch the energy diagram. place key points: reactants, transition state, and products. is this reaction exothermic or endothermic?",
  },

  // application — reflection
  "reaction.path:rp-application-reflection:prompt": {
    kids: "catalysts help reactions happen faster without being used up. in your body, enzymes are natural catalysts — each one speeds up only one specific reaction. why is it important that each enzyme only helps with one thing? what would happen if one enzyme sped up everything in a cell?",
    highschool: "catalysts lower activation energy without changing the overall energy balance. enzymes are biological catalysts. why is it important that enzymes are highly specific? what would happen if an enzyme catalyzed everything?",
  },

  // ═══════════════════════════════════════════════════════════════
  // margin.call
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "margin.call:mc-encounter-prediction:question": {
    kids: "in 2008, a big bank called lehman brothers went from $86 per share to almost $0 in less than a year. what percentage of money experts saw it coming and bet against the bank before it collapsed?",
    highschool: "in 2008, lehman brothers stock fell from $86 to $0.03 in 10 months. what percentage of professional fund managers saw it coming and shorted the stock before september 2008?",
  },

  // struggle — poll
  "margin.call:mc-struggle-poll:question": {
    kids: "quick decision! the stock market just dropped a lot in one day. your savings lost $12,000. you have 15 seconds. what do you do?",
    highschool: "flash round: the market dropped 4% today. your portfolio is down $12,000. you have 15 seconds. what do you do?",
  },

  // threshold — sorting
  "margin.call:mc-threshold-sorting:prompt": {
    kids: "some signs tell you what's about to happen in the economy, some tell you what already happened, and some change at the same time. sort each sign into its group:",
    highschool: "sort each economic indicator by whether it leads, lags, or coincides with economic cycles. this matters for predicting recessions.",
  },

  // integration — canvas
  "margin.call:mc-integration-canvas:prompt": {
    kids: "place different ways to invest on the map. safe investments go in the bottom-left, risky ones in the top-right. where would you put savings accounts, stocks, and bitcoin?",
    highschool: "map where each investment type falls on the risk-reward spectrum. place traditional and alternative assets on the canvas.",
  },

  // application — reflection
  "margin.call:mc-application-reflection:prompt": {
    kids: "you just made fast decisions without all the information. studies show that even professional money experts don't do better than regular people in situations like this. what does that tell you about financial advice? about how feelings affect decisions about money?",
    highschool: "you just made decisions under time pressure with incomplete information. research shows professionals do no better than amateurs here. what does this tell you about financial advice? about the role of emotion in markets?",
  },

  // ═══════════════════════════════════════════════════════════════
  // scale.shift
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "scale.shift:ss-encounter-prediction:question": {
    kids: "if every family in the country decides to save more money during tough times (which sounds smart for each family), what happens to the whole economy?",
    highschool: "if every household decides to save more during a recession (individually rational), what happens to the overall economy?",
  },

  // struggle — asymmetric
  "scale.shift:ss-struggle-asymmetric:scenario": {
    kids: "the economy is struggling. lots of people lost their jobs and prices aren't going up much. you each see the same information but have a different job — and you each think something different should be done.",
    highschool: "the economy is in recession. unemployment is 9%, inflation 1.5%, GDP fell 2% last quarter. you each see the same data through a different lens and reach different conclusions.",
  },
  "scale.shift:ss-struggle-asymmetric:role:micro:info": {
    kids: "you study how individual people and businesses make decisions. you see businesses cutting costs (smart!), workers accepting lower pay to keep their jobs (makes sense), and prices falling. you think the economy is fixing itself naturally. the government shouldn't get involved — it would just mess things up.",
    highschool: "you study firms and consumers. businesses are cutting costs rationally, workers accepting lower wages, prices falling toward equilibrium. you believe the recession is a healthy correction — inefficient firms should fail so resources flow to productive ones. government intervention distorts price signals.",
  },
  "scale.shift:ss-struggle-asymmetric:role:micro:question": {
    kids: "what should the government do (or not do), and why? what do you think the other economist is missing?",
    highschool: "what policy do you recommend? what do you think the macroeconomist is getting wrong?",
  },
  "scale.shift:ss-struggle-asymmetric:role:macro:info": {
    kids: "you study the whole economy as one big system. you see a scary spiral: people spending less causes businesses to fire workers, which makes people spend even less, which causes more firings. each person saving money makes sense for them, but together it makes everything worse. you think the government needs to step in and spend money to break the cycle.",
    highschool: "you study aggregate demand. you see a deflationary spiral: falling demand causes layoffs, reducing spending further. individual rationality (saving more) creates collective catastrophe. government must increase spending to break the cycle, even with a deficit.",
  },
  "scale.shift:ss-struggle-asymmetric:role:macro:question": {
    kids: "what should the government do, and why? what do you think the other economist is missing?",
    highschool: "what policy do you recommend? what do you think the microeconomist is missing?",
  },
  "scale.shift:ss-struggle-asymmetric:role:central-bank:info": {
    kids: "you control interest rates — how expensive it is to borrow money. you've already made borrowing almost free, but the economy still isn't recovering. you're thinking about creating more money to get things moving. but if you create too much, prices could go way up. if you do too little, things keep getting worse.",
    highschool: "you control interest rates and money supply. rates are at 0.25% and recovery hasn't happened. you're considering quantitative easing. you worry about inflation if you go too far, deflation if you do too little.",
  },
  "scale.shift:ss-struggle-asymmetric:role:central-bank:question": {
    kids: "what would you do next? whose argument do you agree with more — the person who says let it fix itself, or the person who says the government should spend?",
    highschool: "what's your next move? whose analysis is more compelling — micro or macro?",
  },

  // threshold — sorting
  "scale.shift:ss-threshold-sorting:prompt": {
    kids: "sort each concept into whether it's about individual people and businesses (micro) or about the whole economy (macro). some might surprise you!",
    highschool: "sort each concept into microeconomics or macroeconomics. some might surprise you.",
  },

  // integration — canvas
  "scale.shift:ss-integration-canvas:prompt": {
    kids: "place each economic idea on the map. some are about individuals, some are about the whole country. some matter right now, some matter over years.",
    highschool: "place each economic phenomenon on the micro-macro spectrum. some exist at both scales — place them where they're most important.",
  },

  // application — reflection
  "scale.shift:ss-application-reflection:prompt": {
    kids: "saving money is smart for one family but bad for everyone if everyone does it at once. where else does this happen — where everyone doing the 'smart thing' makes everything worse? think about traffic, social media, or even a classroom where nobody wants to answer first.",
    highschool: "the paradox of thrift shows individual rationality can produce collective disaster. where else does this happen? think about traffic, social media, arms races, or any system where everyone doing the 'smart thing' makes everything worse.",
  },

  // ═══════════════════════════════════════════════════════════════
  // bias.lens
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "bias.lens:bl-encounter-prediction:question": {
    kids: "scientists made a test that measures hidden preferences people don't even know they have. over 30 million people have taken it. what percentage of white americans showed an automatic preference for white faces over black faces, even if they said they treat everyone equally?",
    highschool: "the implicit association test (IAT) measures automatic associations. over 30 million tests have been collected. what percentage of white americans show an implicit preference for white faces over black faces?",
  },

  // struggle — poll
  "bias.lens:bl-struggle-poll:question": {
    kids: "you're picking someone for a big job. two people are equally good. alex went to a fancy school and had a straight path. jordan went to community college, tried starting a business that failed, and had a winding path. quick — who do you call back first?",
    highschool: "you're hiring for a senior role. two equally qualified candidates: alex has a traditional path (elite university, Fortune 500, linear career). jordan has a nontraditional path (community college, failed startup, career gaps). gut reaction — who do you call back?",
  },

  // threshold — sorting
  "bias.lens:bl-threshold-sorting:prompt": {
    kids: "sort these thinking shortcuts by how they work. some mess with how you process information, some come from being in a group, and some protect beliefs you already have.",
    highschool: "sort these biases by mechanism: cognitive (information processing), social (group identity), or confirmatory (protecting existing beliefs).",
  },
  "bias.lens:bl-threshold-sorting:card:status-quo": {
    kids: "status quo bias — preferring things to stay the way they are, even when changing would be better",
    highschool: "status quo bias — preference for the current state of affairs",
  },
  "bias.lens:bl-threshold-sorting:card:ingroup": {
    kids: "in-group favoritism — liking people in your own group more, even if the groups are random",
    highschool: "in-group favoritism — preferring members of your own group",
  },
  "bias.lens:bl-threshold-sorting:card:fundamental-attribution": {
    kids: "the blame game — when someone else messes up you think 'they're bad at this,' but when you mess up you think 'that was just bad luck'",
    highschool: "fundamental attribution error — explaining others' behavior as character, your own as situation",
  },
  "bias.lens:bl-threshold-sorting:card:just-world": {
    kids: "the fair world trap — believing people always get what they deserve, so if something bad happened to someone, they must have done something wrong",
    highschool: "just-world hypothesis — believing people get what they deserve",
  },
  "bias.lens:bl-threshold-sorting:card:backfire": {
    kids: "the backfire effect — when someone shows you facts that prove you wrong, but instead of changing your mind, you believe your original idea even more strongly",
    highschool: "backfire effect — corrective information strengthens the original false belief",
  },
  "bias.lens:bl-threshold-sorting:card:horn": {
    kids: "the horn effect — when one bad thing about a person makes you think everything about them is bad",
    highschool: "horn effect — one negative trait colors perception of all traits",
  },
  "bias.lens:bl-threshold-sorting:card:naive-realism": {
    kids: "the 'i see it clearly' trap — believing you see the world as it really is, while everyone else is biased",
    highschool: "naive realism — believing you see reality objectively while others are biased",
  },
  "bias.lens:bl-threshold-sorting:card:system-justification": {
    kids: "defending the system — sticking up for the way things are, even when the system is unfair to you",
    highschool: "system justification — defending existing social arrangements even when they disadvantage you",
  },

  // integration — canvas
  "bias.lens:bl-integration-canvas:prompt": {
    kids: "be honest: how much do you notice your own biases versus how much they actually affect your choices? place a pin on the map.",
    highschool: "research shows people rate themselves as less biased than 85% of peers. place yourself honestly: how aware are you of your biases vs. how much do they affect your decisions?",
  },

  // application — reflection
  "bias.lens:bl-application-reflection:prompt": {
    kids: "here's the uncomfortable part: just knowing about biases doesn't usually fix them. you can learn about all these thinking traps and still fall into them. the space between wanting to be fair and actually being fair is where bias lives. think about the hiring question from earlier. what was your gut reaction? what does the gap between who you want to be and how you actually decide tell you?",
    highschool: "knowing about biases doesn't reliably reduce them. research shows bias training often increases awareness without changing behavior. the gap between intention and action is where bias lives. think about the hiring scenario. what was your gut reaction, and what does it reveal about the gap between who you want to be and how you actually decide?",
  },

  // ═══════════════════════════════════════════════════════════════
  // ought.machine
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "ought.machine:om-encounter-prediction:question": {
    kids: "the trolley problem is a famous thought experiment: a runaway trolley is heading toward 5 people. you can pull a switch to send it to a different track where there's 1 person. scientists asked people in 233 countries what they'd do. what percentage said they'd pull the switch to save 5 people (but the 1 person would be hit)?",
    highschool: "in the 'moral machine experiment,' awad et al. (2018) surveyed people across 233 countries about moral dilemmas. what percentage chose to divert the trolley (saving five, killing one)?",
  },

  // struggle — asymmetric
  "ought.machine:om-struggle-asymmetric:scenario": {
    kids: "a medicine company made a life-saving drug but charges $80,000 for it. a company in another country can make the same drug for $200. the expensive company says the high price pays for future research. people are dying who could afford the cheap version but not the expensive one. should the company be forced to let others make the cheap version?",
    highschool: "a pharma company prices a life-saving drug at $80,000. a generic manufacturer can produce it for $200. the company says the price funds future research. patients are dying who could afford the generic. should the patent be enforced?",
  },
  "ought.machine:om-struggle-asymmetric:role:utilitarian:info": {
    kids: "you believe the right thing to do is whatever helps the most people overall. if the cheap drug saves 10,000 lives but might reduce future research that could save 2,000 lives, you do the math: saving 10,000 now is better. but you also worry — if companies can never protect their inventions, they might stop making new medicines entirely.",
    highschool: "you argue from utilitarianism: the right action maximizes total well-being. if the generic saves 10,000 lives at the cost of future R&D that might save 2,000, the math is clear. but rule utilitarianism warns that breaking patents as a rule could collapse pharmaceutical investment entirely.",
  },
  "ought.machine:om-struggle-asymmetric:role:utilitarian:question": {
    kids: "make the case for whatever helps the most people. who benefits, who gets hurt, and what's the total?",
    highschool: "argue for the position that maximizes total well-being. show your calculation — who benefits, who suffers, what's the net?",
  },
  "ought.machine:om-struggle-asymmetric:role:deontologist:info": {
    kids: "you believe in doing the right thing based on rules and duties, not just what gets the best results. you ask: what if everyone broke patents when lives were at stake? the whole system of inventing things would fall apart. but you also believe every person matters — charging so much that people die treats them like they don't matter. you're stuck between two duties.",
    highschool: "you argue from kant: act only according to rules you could make universal. universalizing patent violation would collapse intellectual property. but kant also says treat people as ends, not means. pricing beyond reach treats patients as means to profit. you're caught between two duties.",
  },
  "ought.machine:om-struggle-asymmetric:role:deontologist:question": {
    kids: "which duty is more important — following the rules that protect inventions, or making sure people's lives are valued? argue based on what's right, not what gets the best results.",
    highschool: "which duty wins — respect for the system of rights, or respect for persons? argue from principle, not consequences.",
  },
  "ought.machine:om-struggle-asymmetric:role:virtue-ethicist:info": {
    kids: "you don't ask about rules or numbers — you ask: what would a good person do? a good person cares about being fair, not being greedy, and being wise. the question isn't what rule to follow — it's what kind of person do you become by making each choice?",
    highschool: "you ask: what would a virtuous person do? virtue ethics focuses on character — justice, temperance, practical wisdom. the question isn't about rules or outcomes but about what kind of person each choice makes you.",
  },
  "ought.machine:om-struggle-asymmetric:role:virtue-ethicist:question": {
    kids: "forget the rules and the math. what does a good person do here? what kind of person do you become depending on your choice?",
    highschool: "forget the rules and the numbers. what does a good person do, and what character does each choice build?",
  },
  "ought.machine:om-struggle-asymmetric:role:care-ethicist:info": {
    kids: "you believe morality is about caring for real people, not abstract rules. the question isn't about rights or math — it's about who is hurting and who can help. a dying patient isn't just a number — they're someone's mom, dad, or best friend. the drug company is connected to real people and can't pretend otherwise.",
    highschool: "you argue from the ethics of care: moral reasoning is relational, not abstract. the question is about who is vulnerable and who can respond. a dying patient isn't a number — they're someone's parent, child, friend. the company exists in a web of relationships.",
  },
  "ought.machine:om-struggle-asymmetric:role:care-ethicist:question": {
    kids: "who is hurting here? who has the power to help? what does being responsible look like when you think about real people instead of numbers?",
    highschool: "who is vulnerable? who has the power to care? what does responsibility look like when you see faces instead of numbers?",
  },

  // threshold — puzzle
  "ought.machine:om-threshold-puzzle:prompt": {
    kids: "put this famous argument in the right order. each step builds on the one before it. the argument makes logical sense — but do you agree with every starting point?",
    highschool: "reconstruct this famous philosophical argument. arrange the premises in logical order. the argument is valid — but is it sound? (validity = logic works; soundness = premises are also true.)",
  },

  // integration — poll
  "ought.machine:om-integration-poll:question": {
    kids: "after arguing a position you didn't choose and putting together a logical argument — which approach to right and wrong do you actually agree with most for the medicine case?",
    highschool: "after arguing an assigned position and reconstructing a formal argument — which moral framework do you find most compelling for the pharmaceutical case?",
  },

  // application — reflection
  "ought.machine:om-application-reflection:prompt": {
    kids: "a psychologist named haidt says we usually decide what's right by gut feeling first, and then come up with reasons afterwards. you just spent a while thinking carefully about ethics. did it change your gut feeling, or did you just find better arguments for what you already felt? be honest. and if our moral reasoning is mostly just making up reasons for what we already believe, does that make thinking about ethics pointless — or more important than ever?",
    highschool: "haidt's social intuitionist model says moral judgments are gut-first, reasoning-second. you just spent time reasoning about ethics. did it change your intuition, or did you find better arguments for what you already felt? if moral reasoning is mostly rationalization, does that make philosophy useless — or more important?",
  },

  // ═══════════════════════════════════════════════════════════════
  // circle.read
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "circle.read:cr-encounter-prediction:question": {
    kids: "when you read a book, who decides what it means — the person who wrote it, or the person reading it? a philosopher named gadamer said that what you already believe always shapes what you understand. what percentage of literature experts today believe that meaning is created together by the reader and the text?",
    highschool: "gadamer argued we can never read a text without prejudice. fish went further: meaning is entirely created by the reader's community. what percentage of literary scholars today identify as reader-response theorists (meaning is co-created)?",
  },

  // struggle — puzzle
  "circle.read:cr-struggle-puzzle:prompt": {
    kids: "when you read something hard, you go through layers of understanding. arrange these layers in the order you'd go through them. there's no single right answer — the order you pick shows how you naturally read!",
    highschool: "the hermeneutic circle: you can't understand parts without the whole, or the whole without parts. arrange these interpretation layers in your reading order — the sequence reveals your reading style:",
  },
  "circle.read:cr-struggle-puzzle:piece:surface": {
    kids: "surface reading — what do the words actually say?",
    highschool: "surface reading — what do the words literally say?",
  },
  "circle.read:cr-struggle-puzzle:piece:structure": {
    kids: "pattern reading — how is it organized? what repeats or stands out?",
    highschool: "structural reading — how is the text organized? what patterns emerge?",
  },
  "circle.read:cr-struggle-puzzle:piece:context": {
    kids: "background reading — when and where was this written? what was going on in the world?",
    highschool: "contextual reading — when and where was this written? what was happening historically?",
  },
  "circle.read:cr-struggle-puzzle:piece:subtextual": {
    kids: "hidden reading — what is NOT said? what did the author skip or take for granted?",
    highschool: "subtextual reading — what is not said? what is assumed or suppressed?",
  },
  "circle.read:cr-struggle-puzzle:piece:personal": {
    kids: "personal reading — what does this mean to me, right now, in my life?",
    highschool: "personal reading — what does this text mean to me, now, here?",
  },

  // threshold — asymmetric
  "circle.read:cr-threshold-asymmetric:scenario": {
    kids: "look at this famous sentence: 'we hold these truths to be self-evident, that all men are created equal.' it's from the declaration of independence in 1776. each of you will read it through a different lens.",
    highschool: "consider: 'we hold these truths to be self-evident, that all men are created equal, that they are endowed by their creator with certain unalienable rights.' each of you reads through a different philosophical lens.",
  },
  "circle.read:cr-threshold-asymmetric:role:historicist:info": {
    kids: "you read by asking: what did these words mean back then? in 1776, 'all men' meant wealthy white men. thomas jefferson, who wrote this, owned over 600 enslaved people. 'self-evident' was a fancy way of saying 'obviously true' borrowed from Scottish thinkers. the words meant something very specific in their time.",
    highschool: "you read with historical context. in 1776, 'all men' meant propertied white males. jefferson owned 600+ enslaved people. 'self-evident' was borrowed from scottish common sense philosophy. reading our values back onto it is anachronistic.",
  },
  "circle.read:cr-threshold-asymmetric:role:historicist:question": {
    kids: "what did these words mean in 1776? what couldn't they have meant? how does knowing the history change what you understand?",
    highschool: "what did these words mean in 1776? what could they not have meant? where does the historical horizon constrain interpretation?",
  },
  "circle.read:cr-threshold-asymmetric:role:deconstructionist:info": {
    kids: "you read by looking for where the text contradicts itself. 'all men are created equal' — but who was left out? women, enslaved people, native peoples. the word 'self-evident' does something sneaky: it says 'this is so obviously true that you can't even argue with it.' but nothing is automatically obvious — everything is built by people.",
    highschool: "you read for contradictions. 'all men are created equal' is undermined by who was excluded. 'self-evident' forecloses argument by declaring itself beyond question — a 'metaphysics of presence.' nothing is self-evident; everything is constructed.",
  },
  "circle.read:cr-threshold-asymmetric:role:deconstructionist:question": {
    kids: "where does the text say one thing but do another? what does 'self-evident' hide? what happens when you pull at the loose threads?",
    highschool: "where does the text contradict itself? what does 'self-evident' conceal? what happens when you pull at the loose threads?",
  },
  "circle.read:cr-threshold-asymmetric:role:pragmatist:info": {
    kids: "you read by asking: what can we DO with these words? forget what they meant in 1776 — these words have been used to end slavery, get women the right to vote, win civil rights, and legalize marriage equality. the text is a tool, not a museum piece. its meaning is what people have used it for.",
    highschool: "you read for usefulness. forget original meaning — this text has been used to justify abolition, women's suffrage, civil rights, marriage equality. the text is a tool, not a monument. its meaning is its use across time.",
  },
  "circle.read:cr-threshold-asymmetric:role:pragmatist:question": {
    kids: "forget what it meant back then. what can these words do today? how have people used them, and what new uses are still possible?",
    highschool: "forget what it meant then. what can it do now? how has this text been used, and what new uses remain?",
  },
  "circle.read:cr-threshold-asymmetric:role:phenomenologist:info": {
    kids: "you read by forgetting everything you know about this text and just experiencing the words fresh. don't think about history or politics — just read the words and notice what you feel. what jumps out? what resonates?",
    highschool: "you read with husserl's phenomenological reduction: bracket everything you know and encounter it fresh. suspend all assumptions. what is the lived experience of reading these words? what shows up when you strip away everything you've been told?",
  },
  "circle.read:cr-threshold-asymmetric:role:phenomenologist:question": {
    kids: "read the words as if you've never seen them before. what do you feel? what sticks with you? what shows up when you stop thinking about it and just read?",
    highschool: "read the words fresh. what do you experience? what resonates in your body? what shows up when you stop analyzing?",
  },

  // integration — open-response
  "circle.read:cr-integration-open-response:prompt": {
    kids: "after hearing all four ways of reading, write your own take on the passage. you now carry all four lenses. what do you see that you couldn't see before? your understanding has grown — you can't go back to reading it the old way.",
    highschool: "after hearing all four readings, write your own interpretation. you now carry all four lenses. what do you see that you couldn't before? this is the hermeneutic circle: your horizon has shifted.",
  },

  // application — reflection
  "circle.read:cr-application-reflection:prompt": {
    kids: "when you read, do you usually try to understand what the author meant (giving them the benefit of the doubt), or do you look for hidden problems and motives? and here's the bigger question: when you read other people (not books, but actual people), do you try to understand them, or do you try to figure out what they're really up to? is there a difference?",
    highschool: "ricoeur distinguished 'hermeneutics of faith' (reading to recover meaning) from 'hermeneutics of suspicion' (reading to unmask hidden forces). which do you default to? and when you read people (not texts), do you read for meaning or motive? is there a difference?",
  },

  // ═══════════════════════════════════════════════════════════════
  // lens.shift
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "lens.shift:ls-encounter-prediction:question": {
    kids: "scientists found that the language you speak actually changes what you see! people whose languages have different words for colors literally see colors differently. a researcher named boroditsky studied how language affects what we notice. how many languages did her team test?",
    highschool: "the sapir-whorf hypothesis claims language shapes thought. boroditsky (2011) found mandarin speakers process temporal statements differently than english speakers. how many languages did her team test across their perception research?",
  },

  // struggle — asymmetric
  "lens.shift:ls-struggle-asymmetric:scenario": {
    kids: "a student in class hasn't spoken for three weeks. today the teacher calls on them. they stand up, say nothing for five seconds, then sit back down. the class goes quiet. each of you will think about this moment in a different way.",
    highschool: "a student who hasn't spoken in three weeks of class is called on by the professor. they stand, say nothing for five seconds, then sit back down. the class goes quiet.",
  },
  "lens.shift:ls-struggle-asymmetric:role:pragmatist:info": {
    kids: "you think about what actually happens next. the student's silence only matters because of what it changes. did other students start speaking up more? did the teacher change how they call on people? you also wonder: what kind of classroom leads to three weeks of silence in the first place?",
    highschool: "you think through william james and dewey. truth is what works. the silence is meaningful only in terms of consequences. what happened next? dewey would focus on the system: what classroom produced three weeks of silence?",
  },
  "lens.shift:ls-struggle-asymmetric:role:pragmatist:question": {
    kids: "what actually changes because of this moment? what kind of classroom made this happen?",
    highschool: "what are the practical consequences? what system produced this moment?",
  },
  "lens.shift:ls-struggle-asymmetric:role:existentialist:info": {
    kids: "you believe the student chose this — chose to stand, chose silence, chose to sit. even doing 'nothing' is a choice. but you also wonder: were there pressures that made this choice feel like the only option? pretending you had no choice is dishonest. owning the choice you made — that's being real.",
    highschool: "through sartre and beauvoir: the student chose to stand, chose silence, chose to sit. but freedom is situated — what structures constrain this 'free' choice? bad faith is pretending you had no choice. authenticity is owning it.",
  },
  "lens.shift:ls-struggle-asymmetric:role:existentialist:question": {
    kids: "was this an act of freedom or was the student trapped? what did they choose, and what was chosen for them?",
    highschool: "was this freedom or unfreedom? what did the student choose, and what chose them?",
  },
  "lens.shift:ls-struggle-asymmetric:role:rationalist:info": {
    kids: "you want to know what we can say for sure about this situation. and honestly — almost nothing. we can't read the student's mind. we can't know why they were silent. we can guess, but guessing isn't knowing. strip away every assumption. what's left that you actually know?",
    highschool: "through descartes: what can we know with certainty? almost nothing. we can't access their mental states. we can't know their reasons. apply radical doubt: strip away everything uncertain. what remains?",
  },
  "lens.shift:ls-struggle-asymmetric:role:rationalist:question": {
    kids: "what do you actually know for certain here? what are you just assuming?",
    highschool: "what can we know for certain? what are we assuming? apply radical doubt to every interpretation.",
  },
  "lens.shift:ls-struggle-asymmetric:role:empiricist:info": {
    kids: "you only pay attention to what you can actually see and hear. you saw: a student stood up, was quiet for five seconds, sat down. that's it. you can't see their feelings. you can't see their reasons. and from just one event, you can't draw any big conclusions. the honest thing is to describe what happened and resist making up stories about why.",
    highschool: "through hume: all knowledge comes from observation. you have behaviors observed in sequence. hume's problem of induction: you can't generalize from one event. the empiricist catalogs observations and resists conclusions.",
  },
  "lens.shift:ls-struggle-asymmetric:role:empiricist:question": {
    kids: "describe only what you actually saw and heard. what stories are you tempted to make up, and why can't you prove them?",
    highschool: "describe only what was observed. what inferences are you tempted to make, and why can't you justify them?",
  },

  // threshold — sorting
  "lens.shift:ls-threshold-sorting:prompt": {
    kids: "sort these famous quotes into which way of thinking they come from. each tradition has a different idea about where knowledge comes from and what truth means.",
    highschool: "sort these philosophical claims into their tradition. each has a characteristic way of framing questions about knowledge, reality, and meaning.",
  },

  // integration — canvas
  "lens.shift:ls-integration-canvas:prompt": {
    kids: "place a pin where your natural thinking style falls. do you figure things out more through thinking and logic, or through trying things and seeing what happens? do you think truth is something you find, or something you build?",
    highschool: "place a pin where your philosophical orientation falls. x-axis: reason vs. experience. y-axis: truth is discovered vs. constructed. your position has consequences for how you live, decide, and handle uncertainty.",
  },

  // application — reflection
  "lens.shift:ls-application-reflection:prompt": {
    kids: "most people naturally see the world through one main lens — one way of making sense of things. after seeing four lenses applied to the same moment, what's your default? what does it help you see well — and what does it cause you to miss? can you think of a time when switching your way of looking at something would have changed what you understood?",
    highschool: "most people default to one philosophical lens. after seeing four applied to the same moment, what's your default? what does it help you see — and what does it systematically hide? can you name a moment where switching lenses would have changed your understanding?",
  },

  // ═══════════════════════════════════════════════════════════════
  // liminal.pass
  // ═══════════════════════════════════════════════════════════════

  // encounter — prediction
  "liminal.pass:lp-encounter-prediction:question": {
    kids: "researchers found that every school subject has certain big ideas that, once you understand them, completely change how you think. they called these 'threshold concepts' — ideas you either 'get' or 'don't get' with not much in between. what percentage of teachers said their subject has these kinds of ideas?",
    highschool: "meyer & land (2003) identified 'threshold concepts' — ideas that irreversibly transform thinking. they're transformative, irreversible, and integrative. what percentage of academics reported their field has such concepts?",
  },

  // struggle — sorting
  "liminal.pass:lp-struggle-sorting:prompt": {
    kids: "some ideas change you forever once you understand them — you can't go back to not knowing. other ideas are useful but you can learn and forget them without it changing who you are. sort each one:",
    highschool: "sort these: which are genuine threshold concepts (transformative, irreversible, integrative) and which are important but not threshold (learnable, forgettable, non-transformative)?",
  },
  "liminal.pass:lp-struggle-sorting:card:opportunity-cost": {
    kids: "opportunity cost — every time you choose something, you give up the next-best thing. once you see this, you see it everywhere.",
    highschool: "opportunity cost — every choice has a hidden price: the best alternative you gave up",
  },
  "liminal.pass:lp-struggle-sorting:card:quadratic": {
    kids: "the quadratic formula — a set of steps for solving certain math problems",
    highschool: "the quadratic formula — a procedure for solving ax^2 + bx + c = 0",
  },
  "liminal.pass:lp-struggle-sorting:card:natural-selection": {
    kids: "natural selection — living things that survive and have babies pass on their traits. once you get this, it explains almost everything in biology.",
    highschool: "natural selection — differential survival and reproduction based on heritable variation",
  },
  "liminal.pass:lp-struggle-sorting:card:entropy": {
    kids: "entropy — things naturally become more messy and random over time. this explains why your room gets messy but never cleans itself.",
    highschool: "entropy — disorder always increases in closed systems; time has a direction",
  },
  "liminal.pass:lp-struggle-sorting:card:object-permanence": {
    kids: "object permanence — things still exist when you can't see them. babies learn this around 8 months old, and it changes everything about how they understand the world.",
    highschool: "object permanence — things exist when you can't see them. infants develop this around 8 months; it restructures all spatial reasoning.",
  },

  // threshold — canvas
  "liminal.pass:lp-threshold-canvas:prompt": {
    kids: "think about a big change or transition in your life. place a pin on the map: how confusing was it (left to right) and how much did it change you (bottom to top)?",
    highschool: "van gennep identified three stages of passage: separation, liminality, incorporation. turner showed liminality is characterized by ambiguity and disorientation. place a pin for a liminal space you've inhabited: how disorienting was it, and how transformative?",
  },

  // integration — open-response
  "liminal.pass:lp-integration-open-response:prompt": {
    kids: "name one big idea or experience that changed how you see things forever. what was it like before you understood it? what was the confusing part in the middle? and what does the world look like now that you're on the other side?",
    highschool: "name a threshold you've crossed — a concept or realization that irreversibly changed your understanding. what was the liminal state like? what did the world look like on the other side?",
  },

  // application — reflection
  "liminal.pass:lp-application-reflection:prompt": {
    kids: "here's the mind-bending part: the idea of 'threshold concepts' is itself a threshold concept! once you see that learning isn't just slowly collecting facts but a series of big jumps you can't undo, you can't go back to thinking of school as just memorizing stuff. what big idea are you standing at the edge of right now — in school, in your thinking, or in your life — that you haven't quite crossed yet? what's keeping you on the edge? and what might things look like from the other side?",
    highschool: "the meta-threshold: 'threshold concepts' is itself a threshold concept. once you see learning as irreversible crossings rather than gradual accumulation, you can't go back. kierkegaard called this a 'leap.' what threshold are you standing at right now — in work, thinking, or life — that you haven't crossed? what's holding you at the edge?",
  },
};

/** look up a text variant, falling back to the original */
export function getVariant(
  key: string,
  level: AgeLevel,
  original: string,
): string {
  const entry = VARIANTS[key];
  if (!entry) return original;
  return entry[level] ?? original;
}
