// 16-color palette from build_reference.py
export const PALETTE = {
  SKY_TOP: '#8CC8E8',
  SKY_MID: '#BCE0F0',
  SKY_HORIZON: '#F8E6B8',
  CLOUD: '#FAFAF4',
  WALL_RED: '#C8624E',
  WALL_LIGHT: '#E08466',
  WALL_DARK: '#8A3828',
  ROOF_HI: '#B85A3A',
  DOOR_YELLOW: '#F0B440',
  WIN_LIGHT: '#E8F0F0',
  WIN_DARK: '#3E2A1E',
  TREE_DARK: '#346B36',
  TREE_LIGHT: '#5A9C4E',
  GRASS: '#7CC04E',
  FLOWER_PINK: '#F08AA0',
  PATH_STONE: '#D4C496',
  OUTLINE: '#2E1A14',
} as const;

export type PaletteColor = typeof PALETTE[keyof typeof PALETTE];

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
