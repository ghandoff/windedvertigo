import type { Activity } from "../types";

// ── mathematics ──
import { foldSpace, infinityHotel, variableEngine, proofGarden, patternWeave } from "./mathematics";

// ── computer science ──
import { raceCondition, typeTower, stateCraft, signalFlow, codeWeave } from "./computer-science";

// ── physics ──
import { frameShift, entropyGarden, fieldCanvas, orbitLab, timePrism } from "./physics";

// ── biology ──
import { selectionPressure, expressIon, webPulse, emergeBox } from "./biology";

// ── chemistry ──
import { bondCraft, equilibriumDance, reactionPath } from "./chemistry";

// ── economics ──
import { marginCall, tradeWinds, commonsGame, scaleShift, marketMind } from "./economics";

// ── psychology ──
import { mirrorMaze, anchorDrift, storySelf, biasLens, paleBlue } from "./psychology";

// ── philosophy ──
import { oughtMachine, circleRead, lensShift, liminalPass } from "./philosophy";

// ── music ──
import { toneField, voiceWeave, soundColor, rhythmLab } from "./music";

// ── visual arts ──
import { spaceBetween, hueShift, gridBreak } from "./visual-arts";

// ── writing ──
import { readerGhost, draftLoop, genreShift } from "./writing";

/**
 * game registry — maps game names (as displayed in the discover page)
 * to factory functions that produce Activity[] session flows.
 */
export const GAME_REGISTRY: Record<string, () => Activity[]> = {
  // mathematics
  "fold.space": foldSpace,
  "infinity.hotel": infinityHotel,
  "variable.engine": variableEngine,
  "proof.garden": proofGarden,
  "pattern.weave": patternWeave,

  // computer science
  "race.condition": raceCondition,
  "type.tower": typeTower,
  "state.craft": stateCraft,
  "signal.flow": signalFlow,
  "code.weave": codeWeave,

  // physics
  "frame.shift": frameShift,
  "entropy.garden": entropyGarden,
  "field.canvas": fieldCanvas,
  "orbit.lab": orbitLab,
  "time.prism": timePrism,

  // biology
  "selection.pressure": selectionPressure,
  "express.ion": expressIon,
  "web.pulse": webPulse,
  "emerge.box": emergeBox,

  // chemistry
  "bond.craft": bondCraft,
  "equilibrium.dance": equilibriumDance,
  "reaction.path": reactionPath,

  // economics
  "margin.call": marginCall,
  "trade.winds": tradeWinds,
  "commons.game": commonsGame,
  "scale.shift": scaleShift,
  "market.mind": marketMind,

  // psychology
  "mirror.maze": mirrorMaze,
  "anchor.drift": anchorDrift,
  "story.self": storySelf,
  "bias.lens": biasLens,
  "pale.blue": paleBlue,

  // philosophy
  "ought.machine": oughtMachine,
  "circle.read": circleRead,
  "lens.shift": lensShift,
  "liminal.pass": liminalPass,

  // music
  "tone.field": toneField,
  "voice.weave": voiceWeave,
  "sound.color": soundColor,
  "rhythm.lab": rhythmLab,

  // visual arts
  "space.between": spaceBetween,
  "hue.shift": hueShift,
  "grid.break": gridBreak,

  // writing
  "reader.ghost": readerGhost,
  "draft.loop": draftLoop,
  "genre.shift": genreShift,
};
