/**
 * Material → emoji mapping for child accessibility.
 *
 * Maps material titles (and form_primary fallbacks) to visual emojis
 * so children who can't read can still identify what each pill means.
 *
 * The map is intentionally generous — common craft/play materials
 * should all have a recognisable visual representation.
 */

/* ── specific material title → emoji ────────────────────────────── */

const MATERIAL_TITLE_EMOJI: Record<string, string> = {
  /* paper family */
  paper: "📄",
  newspaper: "📰",
  "tissue paper": "🧻",
  "wrapping paper": "🎁",
  "construction paper": "🟧",
  cardstock: "📋",
  "paper plate": "🍽️",
  "paper bag": "🛍️",
  "paper towel": "🧻",
  "coffee filter": "☕",
  magazine: "📖",
  envelope: "✉️",
  sticker: "⭐",
  stickers: "⭐",

  /* cardboard */
  cardboard: "📦",
  "cardboard box": "📦",
  "cereal box": "🥣",
  "egg carton": "🥚",
  "toilet paper roll": "🧻",
  "paper towel roll": "🌀",
  tube: "🌀",
  "cardboard tube": "🌀",
  box: "📦",

  /* fabric & fiber */
  fabric: "🧵",
  felt: "🧶",
  yarn: "🧶",
  string: "🧵",
  ribbon: "🎀",
  rope: "🪢",
  wool: "🧶",
  cotton: "☁️",
  "cotton balls": "☁️",
  "pipe cleaners": "〰️",
  "pipe cleaner": "〰️",
  burlap: "🧵",
  thread: "🪡",
  elastic: "➰",
  "rubber band": "➰",
  "rubber bands": "➰",
  cloth: "🧣",
  "old t-shirt": "👕",
  "t-shirt": "👕",
  sock: "🧦",
  socks: "🧦",
  "old sock": "🧦",
  button: "🔘",
  buttons: "🔘",
  bead: "🔮",
  beads: "🔮",

  /* wood & natural */
  wood: "🪵",
  stick: "🪵",
  sticks: "🪵",
  twig: "🌿",
  twigs: "🌿",
  "popsicle stick": "🍦",
  "popsicle sticks": "🍦",
  "craft stick": "🍦",
  "craft sticks": "🍦",
  "ice cream stick": "🍦",
  cork: "🍾",
  bamboo: "🎋",
  dowel: "🪵",
  bark: "🌳",
  pinecone: "🌲",
  pinecones: "🌲",
  leaf: "🍃",
  leaves: "🍂",
  flower: "🌸",
  flowers: "💐",
  petal: "🌸",
  petals: "🌸",
  seed: "🌱",
  seeds: "🌱",
  rock: "🪨",
  rocks: "🪨",
  stone: "🪨",
  stones: "🪨",
  pebble: "🪨",
  pebbles: "🪨",
  shell: "🐚",
  shells: "🐚",
  feather: "🪶",
  feathers: "🪶",
  sand: "🏖️",
  dirt: "🟫",
  soil: "🌱",
  mud: "🟫",
  moss: "🌿",
  grass: "🌾",
  acorn: "🌰",
  acorns: "🌰",

  /* plastic & containers */
  plastic: "🫙",
  "plastic bottle": "🍶",
  bottle: "🍶",
  "bottle cap": "⭕",
  "bottle caps": "⭕",
  cup: "🥤",
  cups: "🥤",
  "plastic cup": "🥤",
  straw: "🥤",
  straws: "🥤",
  container: "🫙",
  lid: "⭕",
  lids: "⭕",
  "yogurt cup": "🥛",
  bucket: "🪣",
  tray: "🍱",
  bag: "🛍️",
  "plastic bag": "🛍️",
  "zip bag": "🛍️",
  sponge: "🧽",
  "bubble wrap": "💭",

  /* metal */
  foil: "✨",
  "aluminum foil": "✨",
  "tin foil": "✨",
  wire: "〰️",
  "tin can": "🥫",
  can: "🥫",
  nail: "📌",
  nails: "📌",
  coin: "🪙",
  coins: "🪙",
  key: "🔑",
  spoon: "🥄",

  /* art supplies */
  paint: "🎨",
  marker: "🖍️",
  markers: "🖍️",
  crayon: "🖍️",
  crayons: "🖍️",
  pencil: "✏️",
  pencils: "✏️",
  "colored pencil": "🖍️",
  "colored pencils": "🖍️",
  chalk: "🩶",
  glitter: "✨",
  sequin: "💫",
  sequins: "💫",
  ink: "🖊️",
  stamp: "📮",
  stamps: "📮",

  /* adhesives & fasteners */
  tape: "🩹",
  "masking tape": "🩹",
  "duct tape": "🩹",
  "washi tape": "🎏",
  glue: "🫗",
  "glue stick": "🫗",
  "hot glue": "🔥",
  stapler: "📎",
  staples: "📎",
  "paper clip": "📎",
  "paper clips": "📎",
  pin: "📌",
  pins: "📌",
  velcro: "🔗",

  /* tools */
  scissors: "✂️",
  ruler: "📏",
  "hole punch": "⭕",

  /* food & kitchen */
  flour: "🌾",
  salt: "🧂",
  sugar: "🧂",
  "baking soda": "🧪",
  vinegar: "🧪",
  "food coloring": "🌈",
  rice: "🍚",
  pasta: "🍝",
  "dry pasta": "🍝",
  cereal: "🥣",
  marshmallow: "☁️",
  marshmallows: "☁️",
  toothpick: "🪥",
  toothpicks: "🪥",
  cookie: "🍪",
  fruit: "🍎",
  vegetable: "🥕",
  ice: "🧊",
  water: "💧",
  oil: "🫗",
  lemon: "🍋",
  "egg": "🥚",
  "bread": "🍞",
  dough: "🫓",
  "play dough": "🫓",
  playdough: "🫓",

  /* clay & modeling */
  clay: "🏺",
  "air dry clay": "🏺",
  "modeling clay": "🏺",
  plasticine: "🏺",

  /* recycled / found */
  "egg cartons": "🥚",
  "milk carton": "🥛",
  "juice box": "🧃",
  junk: "♻️",
  recycling: "♻️",

  /* misc */
  balloon: "🎈",
  balloons: "🎈",
  magnet: "🧲",
  magnets: "🧲",
  mirror: "🪞",
  candle: "🕯️",
  flashlight: "🔦",
  battery: "🔋",
  clothespin: "🪹",
  clothespins: "🪹",
  sponges: "🧽",
};

/* ── form_primary fallback → emoji ──────────────────────────────── */

const FORM_FALLBACK_EMOJI: Record<string, string> = {
  paper: "📄",
  cardboard: "📦",
  fabric: "🧵",
  wood: "🪵",
  plastic: "🫙",
  metal: "🔩",
  natural: "🌿",
  food: "🍎",
  clay: "🏺",
  string: "🧶",
  tape: "🩹",
  paint: "🎨",
  recycled: "♻️",
  found: "🔍",
  adhesive: "🫗",
  tool: "🔧",
  fiber: "🧶",
  liquid: "💧",
  other: "✨",
};

/**
 * Get a visual emoji for a material.
 *
 * Tries exact title match first (case-insensitive), then checks if the
 * title contains a known keyword, then falls back to form_primary emoji.
 */
export function getMaterialEmoji(title: string, formPrimary?: string): string {
  const lower = title.toLowerCase().trim();

  // 1. exact match
  if (MATERIAL_TITLE_EMOJI[lower]) return MATERIAL_TITLE_EMOJI[lower];

  // 2. partial match — check if title contains a known key
  for (const [key, emoji] of Object.entries(MATERIAL_TITLE_EMOJI)) {
    if (lower.includes(key) || key.includes(lower)) return emoji;
  }

  // 3. form_primary fallback
  if (formPrimary) {
    const formLower = formPrimary.toLowerCase().trim();
    if (FORM_FALLBACK_EMOJI[formLower]) return FORM_FALLBACK_EMOJI[formLower];

    for (const [key, emoji] of Object.entries(FORM_FALLBACK_EMOJI)) {
      if (formLower.includes(key)) return emoji;
    }
  }

  // 4. ultimate fallback
  return "✨";
}
