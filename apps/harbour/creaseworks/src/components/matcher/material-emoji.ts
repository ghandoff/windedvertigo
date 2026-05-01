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

/* ── custom icon overrides ─────────────────────────────────────── */
/* Maps material title keywords → PNG filenames in /public/icons/materials/ */

const MATERIAL_ICON: Record<string, string> = {
  /* cardboard */
  "cardboard tube": "cardboard-tube.png",
  "paper towel roll": "cardboard-tube.png",
  tube: "cardboard-tube.png",

  /* fabric & fiber */
  felt: "felt.png",
  "pipe cleaners": "pipe-cleaners.png",
  "pipe cleaner": "pipe-cleaners.png",
  "rubber band": "rubber-bands.png",
  "rubber bands": "rubber-bands.png",
  elastic: "rubber-bands.png",
  button: "buttons.png",
  buttons: "buttons.png",
  bead: "beads.png",
  beads: "beads.png",

  /* wood & natural */
  "popsicle stick": "popsicle-stick.png",
  "popsicle sticks": "popsicle-stick.png",
  "craft stick": "popsicle-stick.png",
  "craft sticks": "popsicle-stick.png",
  "ice cream stick": "popsicle-stick.png",
  cork: "cork.png",
  pinecone: "pinecone.png",
  pinecones: "pinecone.png",
  dirt: "dirt-mud.png",
  mud: "dirt-mud.png",
  soil: "dirt-mud.png",

  /* plastic & containers */
  "plastic bottle": "plastic-bottle.png",
  "bottle cap": "bottle-cap.png",
  "bottle caps": "bottle-cap.png",
  "bubble wrap": "bubble-wrap.png",

  /* metal */
  foil: "aluminum-foil.png",
  "aluminum foil": "aluminum-foil.png",
  "tin foil": "aluminum-foil.png",
  nail: "nail2.png",
  nails: "nail2.png",

  /* art supplies */
  chalk: "chalk.png",
  stamp: "rubber-stamp.png",
  stamps: "rubber-stamp.png",

  /* adhesives & fasteners */
  tape: "tape-roll.png",
  "masking tape": "tape-roll.png",
  "duct tape": "tape-roll.png",
  "washi tape": "washi-tape.png",
  "hot glue": "hot-glue-gun.png",
  stapler: "stapler.png",
  velcro: "velcro.png",

  /* tools */
  "hole punch": "hole-punch.png",
  wire: "wire.png",

  /* food & kitchen */
  marshmallow: "marshmallows.png",
  marshmallows: "marshmallows.png",
  toothpick: "toothpicks.png",
  toothpicks: "toothpicks.png",

  /* containers */
  tray: "tray.png",
  sponge: "sponge.png",
  sponges: "sponge.png",

  /* misc */
  clothespin: "clothespins.png",
  clothespins: "clothespins.png",
};

const ICON_BASE = "/harbour/creaseworks/icons/materials/";

/**
 * Get a custom icon path for a material, if one exists.
 *
 * Priority:
 *  0. CMS-managed `icon` field from Notion (e.g. "chalk" → /icons/materials/chalk.png)
 *  1. Hardcoded MATERIAL_ICON map (exact title match)
 *  2. Hardcoded MATERIAL_ICON map (partial title match)
 *  3. null → fall back to emoji rendering
 */
export function getMaterialIcon(
  title: string,
  _formPrimary?: string,
  _dbEmoji?: string | null,
  dbIcon?: string | null,
): string | null {
  // 0. CMS-managed icon from Notion takes priority
  if (dbIcon) return `${ICON_BASE}${dbIcon}.png`;

  const lower = title.toLowerCase().trim();

  // 1. exact match
  if (MATERIAL_ICON[lower]) return `${ICON_BASE}${MATERIAL_ICON[lower]}`;

  // 2. partial match
  for (const [key, file] of Object.entries(MATERIAL_ICON)) {
    if (lower.includes(key) || key.includes(lower))
      return `${ICON_BASE}${file}`;
  }

  return null;
}

/**
 * Get a visual emoji for a material.
 *
 * If a CMS-managed emoji is provided (from Notion via the sync pipeline),
 * it takes priority. Otherwise, tries exact title match (case-insensitive),
 * then checks if the title contains a known keyword, then falls back to
 * form_primary emoji.
 */
export function getMaterialEmoji(
  title: string,
  formPrimary?: string,
  dbEmoji?: string | null,
): string {
  // 0. CMS-managed emoji from Notion takes priority
  if (dbEmoji) return dbEmoji;

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
