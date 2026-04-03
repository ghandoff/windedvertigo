/**
 * @windedvertigo/mirror-log — default prompt bank
 *
 * Human-designed metacognitive prompts. No AI generation.
 * These are the fallback when no Notion-sourced prompts are available.
 */

import type { PromptBank } from "../lib/types";

export const DEFAULT_PROMPTS: PromptBank = {
  generic: [
    "what surprised you about what just happened?",
    "what did you notice about your own thinking during this?",
    "if you could go back and do one thing differently, what would it be?",
    "what felt easy? what felt hard? why the difference?",
    "what connections did you make that you didn't expect?",
    "what question are you leaving with?",
    "how did your understanding change from start to finish?",
    "what assumption did you start with? is it still true?",
    "what would you tell someone about to do this for the first time?",
    "what does this make you curious about?",
  ],

  bySkill: {
    "systems-thinking": [
      "what feedback loop surprised you the most?",
      "where did you see a change ripple further than expected?",
      "what was the hardest thing about thinking in systems?",
    ],
    "cause-and-effect": [
      "what caused an outcome you didn't predict?",
      "where did a simple change create complex results?",
    ],
    creativity: [
      "when did you feel most creative during this?",
      "what constraint actually helped your creativity?",
    ],
    collaboration: [
      "what did someone else bring that you wouldn't have thought of?",
      "when was it hardest to listen? what made it easier?",
    ],
    "perspective-taking": [
      "whose perspective did you find hardest to understand?",
      "what changed when you tried to see it from another angle?",
    ],
    communication: [
      "what was hardest to explain? why?",
      "when did you feel truly understood?",
    ],
    "ethical-reasoning": [
      "what trade-off felt the most uncomfortable?",
      "where did fairness and efficiency conflict?",
    ],
  },

  byApp: {
    "tidal-pool": [
      "what system behavior surprised you the most?",
      "which variable had more influence than you expected?",
      "what would you change about your system if you started over?",
      "did you find any loops? what did they teach you?",
    ],
    creaseworks: [
      "what did you make that you're most proud of?",
      "where did you get stuck creatively? how did you get unstuck?",
    ],
    "deep-deck": [
      "which card or prompt made you think the hardest?",
      "what did someone say that changed your mind?",
    ],
    "raft-house": [
      "how did the group's direction differ from what you expected?",
      "what role did you naturally take? was that comfortable?",
    ],
    "paper-trail": [
      "what did you notice with your hands that you wouldn't have noticed on screen?",
      "how did the physical activity change your understanding?",
    ],
  },
};
