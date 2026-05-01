/**
 * Room → material mapping for the Room Explorer.
 *
 * Each room represents a place a kid might be — kitchen, art corner,
 * backyard. Materials are mapped by title slug (lowercase, trimmed)
 * because Notion UUIDs regenerate on sync but titles are stable.
 *
 * The "find" phase is about noticing what's around you. These rooms
 * match how kids actually think: "I'm in the kitchen — what's here?"
 * not "I need items categorized as form_primary: cardboard."
 *
 * Materials can appear in multiple rooms. That's intentional —
 * a sponge lives in the kitchen AND the bathroom. The selection
 * Set deduplicates by material ID at the state layer.
 *
 * Context auto-inference: each room has a `contextTag` that maps
 * to the existing `context_tags` vocabulary in playdates_cache.
 * When a kid visits a room, that context is auto-injected into
 * the matcher API call — the kid never has to think about it.
 */

export interface RoomConfig {
  id: string;
  label: string;
  prompt: string;
  emoji: string;
  description: string;
  color: string;
  /** maps to existing context_tags vocabulary for auto-inference */
  contextTag: string | null;
  /** material title slugs — title.toLowerCase().trim() */
  materialSlugs: string[];
  /** slot names that commonly live in this room */
  slotSlugs: string[];
}

export const ROOMS: RoomConfig[] = [
  {
    id: "kitchen",
    label: "kitchen",
    prompt: "what's hiding in the kitchen?",
    emoji: "🍳",
    description: "cups, foil, sponges, all kinds of stuff",
    color: "var(--wv-sienna)", // brand sienna — warm discovery
    contextTag: "kitchen",
    materialSlugs: [
      // paper & wrap
      "paper towel", "coffee filter", "paper plate", "paper bag",
      "aluminum foil", "tin foil",
      // containers
      "plastic bag", "zip bag", "straw", "straws",
      "cup", "cups", "plastic cup", "plastic bottle", "bottle",
      "container", "lid", "lids", "yogurt cup", "bottle cap", "bottle caps",
      "tin can", "can",
      // food & kitchen staples
      "flour", "salt", "sugar", "baking soda", "vinegar",
      "food coloring", "rice", "pasta", "dry pasta", "cereal",
      "marshmallow", "marshmallows", "ice", "egg", "bread",
      "dough", "play dough", "playdough", "oil", "lemon",
      // tools & misc
      "toothpick", "toothpicks", "sponge", "sponges",
      "rubber band", "rubber bands", "tray", "bucket",
    ],
    slotSlugs: ["scissors", "water"],
  },
  {
    id: "art-corner",
    label: "art corner",
    prompt: "what can you spot in the art corner?",
    emoji: "🎨",
    description: "paints, paper, tape, all the good stuff",
    color: "var(--wv-redwood)", // brand redwood — creative energy
    contextTag: "indoors",
    materialSlugs: [
      // drawing & painting
      "paint", "marker", "markers", "crayon", "crayons",
      "pencil", "pencils", "colored pencil", "colored pencils",
      "chalk", "glitter", "sequin", "sequins", "ink",
      "stamp", "stamps",
      // adhesives
      "tape", "masking tape", "duct tape", "washi tape",
      "glue", "glue stick",
      // paper
      "paper", "construction paper", "cardstock",
      "tissue paper", "wrapping paper",
      // craft supplies
      "cardboard", "cardboard box", "felt",
      "pipe cleaners", "pipe cleaner",
      "fabric", "ribbon", "yarn", "string", "thread",
      "button", "buttons", "bead", "beads",
      // modeling
      "clay", "air dry clay", "modeling clay", "plasticine",
      // stickers
      "sticker", "stickers",
    ],
    slotSlugs: ["scissors", "glue", "markers"],
  },
  {
    id: "backyard",
    label: "backyard",
    prompt: "what's out in the backyard?",
    emoji: "🌳",
    description: "sticks, leaves, rocks, sunshine",
    color: "#434824",       // complementary earthy green (brand p.21)
    contextTag: "outdoors",
    materialSlugs: [
      "stick", "sticks", "twig", "twigs",
      "leaf", "leaves", "flower", "flowers",
      "petal", "petals", "seed", "seeds",
      "rock", "rocks", "stone", "stones",
      "pebble", "pebbles", "shell", "shells",
      "feather", "feathers",
      "sand", "dirt", "soil", "mud", "moss", "grass",
      "acorn", "acorns", "bark",
      "pinecone", "pinecones", "bamboo",
      "bucket", "rope",
    ],
    slotSlugs: ["water"],
  },
  {
    id: "recycling-bin",
    label: "recycling bin",
    prompt: "what's in the recycling?",
    emoji: "♻️",
    description: "boxes, tubes, bottles — treasure!",
    color: "#43b187",       // complementary teal (brand p.21)
    contextTag: "indoors",
    materialSlugs: [
      "cardboard box", "cereal box",
      "egg carton", "egg cartons",
      "toilet paper roll", "paper towel roll",
      "cardboard tube", "tube", "box",
      "milk carton", "juice box",
      "plastic bottle", "bottle",
      "tin can", "can",
      "newspaper", "magazine",
      "bubble wrap",
      "wire", "foil", "aluminum foil", "tin foil",
      "cork",
      "container", "lid", "lids",
      "bottle cap", "bottle caps",
      "plastic bag", "bag",
    ],
    slotSlugs: ["scissors", "glue"],
  },
  {
    id: "classroom",
    label: "classroom",
    prompt: "what's around the classroom?",
    emoji: "🏫",
    description: "paper, pencils, rulers, and more",
    color: "#5872cb",       // complementary blue-purple (brand p.21)
    contextTag: "classroom",
    materialSlugs: [
      "pencil", "pencils", "ruler",
      "paper", "construction paper", "cardstock",
      "paper clip", "paper clips",
      "stapler", "staples",
      "marker", "markers", "crayon", "crayons",
      "colored pencil", "colored pencils",
      "tape", "masking tape", "glue stick",
      "rubber band", "rubber bands",
      "sticker", "stickers",
      "envelope", "cardboard",
      "scissors", "felt",
      "cotton", "cotton balls",
      "string", "yarn",
      "button", "buttons",
    ],
    slotSlugs: ["scissors", "glue", "markers"],
  },
  {
    id: "bathroom",
    label: "bathroom",
    prompt: "anything interesting in the bathroom?",
    emoji: "🛁",
    description: "cotton balls, sponges, surprises",
    color: "#436db1",       // complementary water blue (brand p.21)
    contextTag: "indoors",
    materialSlugs: [
      "cotton balls", "cotton",
      "tissue paper", "paper towel",
      "sponge", "sponges",
      "elastic", "rubber band", "rubber bands",
      "mirror",
      "toothpick", "toothpicks",
      "plastic bottle", "bottle",
      "cup", "cups",
      "container",
    ],
    slotSlugs: ["water"],
  },
];

/**
 * Filter vibes/rooms to only those whose contextTag exists in the
 * live database. Prevents zero-result queries if a context tag is
 * removed from Notion.
 */
export function filterRoomsForAvailableContexts(
  rooms: RoomConfig[],
  availableContexts: string[],
): RoomConfig[] {
  const ctxSet = new Set(availableContexts.map((c) => c.toLowerCase()));
  return rooms.filter(
    (r) => r.contextTag === null || ctxSet.has(r.contextTag.toLowerCase()),
  );
}

/**
 * Invert the room map: given a material title slug, find which
 * room(s) contain it. Used by Scavenger Hunt to show "look in the kitchen!"
 */
export function findRoomsForMaterial(slug: string): RoomConfig[] {
  const lower = slug.toLowerCase().trim();
  return ROOMS.filter((r) => r.materialSlugs.includes(lower));
}
