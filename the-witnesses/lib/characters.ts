import type { CharacterKey } from './session';

export interface CharacterData {
  key: CharacterKey;
  name: string;
  accentColor: string;
  arrivalLines: string[];
  mainPrompt: string;
  feltSenseOptions: {
    label: string;
    followUp: string;
  }[];
  exitLine: string;
  fallbackLine: string;
}

export const CHARACTERS: Record<CharacterKey, CharacterData> = {
  builder: {
    key: 'builder',
    name: 'The Builder',
    accentColor: '#F59E0B',
    arrivalLines: [
      "Someone arrives who wants to understand the bones of the thing. They believe in joints.",
      "Someone arrives with rope in their pocket. They've measured a thousand things. They like to start with what holds.",
      "Someone arrives crouching. They want to see what touches the ground.",
    ],
    mainPrompt: "Show me the joint.\nName the part that holds it up.",
    feltSenseOptions: [
      {
        label: "the joint is strong",
        followUp: "Good. Strong joints take weight. Strong joints can be moved.\nA strong joint isn't loud. It just doesn't slip.",
      },
      {
        label: "the joint is fragile",
        followUp: "Fragile is not weak. Fragile is honest. Fragile holds up when you remember it's fragile.\nI've built things with fragile joints. They worked. They needed checking.",
      },
      {
        label: "I haven't tested it",
        followUp: "Then don't say strong. Don't say weak. Just say untested. That's a real answer.\nMost things fail at the joint nobody tested. Note it. Move on.",
      },
    ],
    exitLine: "[The Builder taps the joint twice with their knuckle, and nods. They leave the way they came.]",
    fallbackLine: "No matter. The joint is still there. Tell me later.",
  },

  explorer: {
    key: 'explorer',
    name: 'The Explorer',
    accentColor: '#14B8A6',
    arrivalLines: [
      "Someone arrives who has never seen this before. They're holding something small, in case they need to leave it behind.",
      "Someone arrives blinking. They've been somewhere with less light.",
      "Someone arrives mid-thought, walking faster than they meant to. They stop. They look.",
    ],
    mainPrompt: '"[PLAYER_WORD]," you said. Like — like what?\nWait. There\'s a — what\'s the —\nShow me what it looks like when someone walks up to this for the first time.',
    feltSenseOptions: [
      {
        label: "I felt welcomed",
        followUp: "Welcomed is — okay. So someone could just. Just walk in. Yeah.\nWelcomed means the door swung the right way. That's not a small thing.",
      },
      {
        label: "I felt out of place",
        followUp: "Out of — oh. Hmm. Was it the room? Was it me?\nI get that. Sometimes the welcoming part hasn't been built yet. It can be.",
      },
      {
        label: "I'm still figuring it out",
        followUp: "Same. I'm — yeah. Same. I think that's allowed.\nFiguring out is — it's the welcoming for the next person. So.",
      },
    ],
    exitLine: "[The Explorer leaves the [OBJECT] on the bench. They wave without looking back.]",
    fallbackLine: "Oh. Oh, nothing? That's — okay, that's also a thing. I'll wait.",
  },

  ripple: {
    key: 'ripple',
    name: 'The Ripple',
    accentColor: '#8B5CF6',
    arrivalLines: [
      "They arrive as many. Some of them are tired, some are not. They want to know what changed.",
      "They arrive together. They don't all face the same direction. They're listening.",
      "They arrive in a wave. Some of them have been here before. Some of them are new.",
    ],
    mainPrompt: "Some of us are tired. Some of us are not.\nWhat did you make for both?",
    feltSenseOptions: [
      {
        label: "both are served",
        followUp: "We feel it. Some of us. Others too. Not all the same way. But served.\nSome of us would still like more. That's normal. We can wait.",
      },
      {
        label: "one matters more",
        followUp: "Yes. Some of us know it. Some of us are the ones who matter less, here.\nThat's a choice. It can be a good one. Tell us which it was.",
      },
      {
        label: "I didn't think about both",
        followUp: "We noticed. We're not angry. Some of us are relieved you said so.\nSome of us would like to be thought about next. Some of us will be okay.",
      },
    ],
    exitLine: "[The Ripple disperses. Some of them stay. Some of them go.]",
    fallbackLine: "Some of us heard you anyway. Some of us are still waiting.",
  },

  ghost: {
    key: 'ghost',
    name: 'The Ghost',
    accentColor: '#E5E7EB',
    arrivalLines: [
      "Someone arrives who was not asked. They came anyway. The thing is theirs too, even if it doesn't know it.",
      "Someone arrives. They have been standing here for some time.",
      "Someone arrives that you nearly forgot. They are not angry. They are here.",
    ],
    mainPrompt: "I'm not in your room.\nTell me what you took away to make space for what you made. Then take something out.",
    feltSenseOptions: [
      {
        label: "I see them now",
        followUp: "Now is enough. Now is when seeing starts.\nDon't apologize. Build different.",
      },
      {
        label: "I'm not sure who's missing",
        followUp: "Not knowing is honest. Stay there a moment.\nSometimes the missing one shows themselves on the third look.",
      },
      {
        label: "I want to redesign",
        followUp: "Then redesign. We don't have to be precious.\nThe thing will not break from being remade. The thing was always being remade.",
      },
    ],
    exitLine: "[The Ghost stays a little longer than the others. Then they're not there.]",
    fallbackLine: "Nothing said. Noted.",
  },

  timeTraveler: {
    key: 'timeTraveler',
    name: 'The Time-Traveler',
    accentColor: '#84CC16',
    arrivalLines: [
      "Someone arrives from later. They've seen what this became. They're holding back a smile, or a wince.",
      "Someone arrives slowly. They've walked a long way back.",
      "Someone arrives carrying a postcard that hasn't been written yet. Their handwriting is on it.",
    ],
    mainPrompt: "By March, it stopped doing that. Did you know?\nFinish this: \"By 2036, it had…\"",
    feltSenseOptions: [
      {
        label: "this is what I want",
        followUp: "Then make it now. Make it the way it will have wanted to be made.\nI came back to tell you it was worth it.",
      },
      {
        label: "this is what I fear",
        followUp: "I came back to tell you it didn't happen that way. Mostly.\nFear is information. It's not a prediction.",
      },
      {
        label: "I don't know yet",
        followUp: "That's fine. By the time I got back here, you knew. You just don't yet.\nYou said \"will.\" From where I'm standing, it's already \"did.\"",
      },
    ],
    exitLine: "[The Time-Traveler walks back the way they came. The light on the wall behind them ages a moment, then snaps back.]",
    fallbackLine: "By 2036, you said nothing. That also counted.",
  },

  trickster: {
    key: 'trickster',
    name: 'The Trickster',
    accentColor: '#EC4899',
    arrivalLines: [
      "Someone arrives from the other side. They believe the truest version of a thing is also its opposite. They're going to play with you. Let them.",
      "Someone arrives walking backwards. They wave hello with the wrong hand.",
      "Someone arrives upside down and rights themselves only halfway.",
    ],
    mainPrompt: '"[PLAYER_WORD]," you said. Show me the opposite.\nDrag the seed to the other side first. I\'ll wait.',
    feltSenseOptions: [
      {
        label: "the opposite is also true",
        followUp: "Of course. The opposite is always also true. That's the trick.\nHold both. Then drop one. Then pick it back up.",
      },
      {
        label: "the opposite is wrong",
        followUp: "Are you sure. Look again. Tilt your head.\nIf the opposite is wrong, the original is doing too much work. Lighter.",
      },
      {
        label: "they're both real",
        followUp: "Now we're getting somewhere. Both real. Neither finished.\nThat's the kind of thing that can be built without breaking.",
      },
    ],
    exitLine: "[The Trickster bows. They flip the seed back to its original colors as they leave, but slightly different. Not exactly the same as before.]",
    fallbackLine: "Nothing, you said. The opposite of nothing is also something. We'll come back to that.",
  },
};

/**
 * Interpolate tokens in character dialogue.
 * Tokens: [PLAYER_WORD], [SEED], [NAME], [OBJECT], [ELEMENT]
 */
export function interpolate(
  text: string,
  tokens: Partial<Record<'PLAYER_WORD' | 'SEED' | 'NAME' | 'OBJECT' | 'ELEMENT', string>>
): string {
  let result = text;
  for (const [key, value] of Object.entries(tokens)) {
    if (value) {
      result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    }
  }
  return result;
}

export const EXPLORER_OBJECTS: Array<'lamp' | 'blanket' | 'mug'> = ['lamp', 'blanket', 'mug'];

export const GHOST_ERASABLE_ELEMENTS = [
  { key: 'bench', label: 'the bench' },
  { key: 'left window', label: 'the left window' },
  { key: 'door', label: 'the door' },
  { key: 'tree', label: 'the tree' },
  { key: 'book box', label: 'the book box' },
  { key: 'bicycle', label: 'the bicycle' },
] as const;
