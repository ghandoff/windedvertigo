// TypeScript port of build_reference.py
// Draws on a 160x120 canvas, scaled 6x to 960x720 with nearest-neighbor

import { PALETTE, hexToRgb } from './palette';

const W = 160;
const H = 120;

type RGB = [number, number, number];

function parseColor(hex: string): RGB {
  return hexToRgb(hex);
}

class PixelCanvas {
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
    // Fill transparent
    for (let i = 3; i < this.data.length; i += 4) {
      this.data[i] = 255;
    }
  }

  setPixel(x: number, y: number, color: RGB) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = (y * W + x) * 4;
    this.data[idx] = color[0];
    this.data[idx + 1] = color[1];
    this.data[idx + 2] = color[2];
    this.data[idx + 3] = 255;
  }

  fillRect(x1: number, y1: number, x2: number, y2: number, color: RGB) {
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        this.setPixel(x, y, color);
      }
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: RGB) {
    // Horizontal line only for simplicity (matching Python d.line horizontal usage)
    if (y1 === y2) {
      for (let x = x1; x <= x2; x++) {
        this.setPixel(x, y1, color);
      }
    } else {
      // Bresenham's line
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = x1 < x2 ? 1 : -1;
      const sy = y1 < y2 ? 1 : -1;
      let err = dx - dy;
      let cx = x1, cy = y1;
      while (true) {
        this.setPixel(cx, cy, color);
        if (cx === x2 && cy === y2) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, color: RGB) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) {
          this.setPixel(x, y, color);
        }
      }
    }
  }
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function drawScene(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  const pc = new PixelCanvas(W, H);

  const SKY_TOP = parseColor(PALETTE.SKY_TOP);
  const SKY_MID = parseColor(PALETTE.SKY_MID);
  const SKY_HORIZON = parseColor(PALETTE.SKY_HORIZON);
  const CLOUD = parseColor(PALETTE.CLOUD);
  const WALL_RED = parseColor(PALETTE.WALL_RED);
  const WALL_LIGHT = parseColor(PALETTE.WALL_LIGHT);
  const WALL_DARK = parseColor(PALETTE.WALL_DARK);
  const ROOF_HI = parseColor(PALETTE.ROOF_HI);
  const DOOR_YELLOW = parseColor(PALETTE.DOOR_YELLOW);
  const WIN_LIGHT = parseColor(PALETTE.WIN_LIGHT);
  const WIN_DARK = parseColor(PALETTE.WIN_DARK);
  const TREE_DARK = parseColor(PALETTE.TREE_DARK);
  const TREE_LIGHT = parseColor(PALETTE.TREE_LIGHT);
  const GRASS = parseColor(PALETTE.GRASS);
  const FLOWER_PINK = parseColor(PALETTE.FLOWER_PINK);
  const PATH_STONE = parseColor(PALETTE.PATH_STONE);
  const OUTLINE = parseColor(PALETTE.OUTLINE);

  // SKY gradient
  for (let y = 0; y < 30; y++) pc.fillRect(0, y, W, y + 1, SKY_TOP);
  for (let y = 30; y < 60; y++) pc.fillRect(0, y, W, y + 1, SKY_MID);
  for (let y = 60; y < 82; y++) pc.fillRect(0, y, W, y + 1, SKY_HORIZON);

  // GROUND
  for (let y = 82; y < H; y++) pc.fillRect(0, y, W, y + 1, GRASS);

  // CLOUDS (overlapping circles)
  const fillCloud = (cx: number, cy: number, r: number) => pc.fillCircle(cx, cy, r, CLOUD);
  fillCloud(28, 18, 5); fillCloud(34, 16, 4); fillCloud(40, 19, 5); fillCloud(44, 17, 3);
  fillCloud(96, 25, 4); fillCloud(102, 24, 5); fillCloud(108, 26, 4);
  fillCloud(135, 12, 3); fillCloud(140, 13, 4);

  // Birds (simple V shapes)
  const bird = (bx: number, by: number) => {
    pc.setPixel(bx, by, OUTLINE);
    pc.setPixel(bx + 1, by - 1, OUTLINE);
    pc.setPixel(bx + 2, by, OUTLINE);
    pc.setPixel(bx + 3, by - 1, OUTLINE);
    pc.setPixel(bx + 4, by, OUTLINE);
  };
  bird(70, 25); bird(124, 35);

  // Grass texture (seeded random, 90 tufts)
  const rand = seededRandom(11);
  for (let i = 0; i < 90; i++) {
    const gx = Math.floor(rand() * W);
    const gy = 82 + Math.floor(rand() * (H - 82));
    const shade = rand() > 0.5 ? TREE_DARK : TREE_LIGHT;
    pc.setPixel(gx, gy, shade);
  }

  // Flowers
  const flowerPositions = [
    [8, 96], [15, 102], [45, 110], [52, 105],
    [146, 98], [151, 106], [130, 112], [70, 113], [76, 116], [85, 115]
  ];
  for (const [fx, fy] of flowerPositions) {
    pc.setPixel(fx, fy, FLOWER_PINK);
    pc.setPixel(fx + 1, fy, FLOWER_PINK);
    pc.setPixel(fx, fy + 1, TREE_LIGHT);
  }

  // TREE trunk [22,78,26,96] WALL_DARK
  pc.fillRect(22, 78, 26, 96, WALL_DARK);
  // Outline left side of trunk
  for (let y = 78; y < 96; y++) pc.setPixel(21, y, OUTLINE);

  // Foliage circles
  pc.fillCircle(24, 68, 13, TREE_DARK);
  pc.fillCircle(18, 64, 7, TREE_DARK);
  pc.fillCircle(32, 66, 8, TREE_DARK);
  pc.fillCircle(22, 62, 8, TREE_LIGHT);
  pc.fillCircle(28, 68, 6, TREE_LIGHT);
  pc.fillCircle(16, 70, 4, TREE_LIGHT);
  pc.fillCircle(26, 72, 4, TREE_LIGHT);

  // Flower pixels in tree
  pc.setPixel(22, 64, FLOWER_PINK);
  pc.setPixel(30, 67, FLOWER_PINK);

  // LIBRARY
  const LIB_X1 = 56, LIB_Y1 = 56, LIB_X2 = 116, LIB_Y2 = 96;
  const ROOF_PEAK_Y = 44;

  // Roof pitched triangle
  const libCenterX = (LIB_X1 + LIB_X2) / 2;
  for (let y = ROOF_PEAK_Y; y < LIB_Y1; y++) {
    const progress = (y - ROOF_PEAK_Y) / (LIB_Y1 - ROOF_PEAK_Y);
    const halfW = Math.round(progress * (LIB_X2 - LIB_X1) / 2);
    const rx1 = Math.round(libCenterX - halfW);
    const rx2 = Math.round(libCenterX + halfW);
    for (let x = rx1; x <= rx2; x++) {
      pc.setPixel(x, y, WALL_RED);
    }
    // Shingle highlights every 2 rows, 4-pixel spacing
    if (y % 2 === 0) {
      for (let x = rx1; x <= rx2; x += 4) {
        pc.setPixel(x, y, ROOF_HI);
      }
    }
  }

  // Wall [56,56,116,96]
  pc.fillRect(LIB_X1, LIB_Y1, LIB_X2, LIB_Y2, WALL_RED);

  // Plank lines every 6px from y=60 to 96
  for (let py = 60; py < LIB_Y2; py += 6) {
    pc.drawLine(LIB_X1, py, LIB_X2, py, WALL_DARK);
  }

  // Right shadow [112,56,116,96]
  pc.fillRect(112, LIB_Y1, LIB_X2, LIB_Y2, WALL_DARK);

  // Left highlight
  for (let y = LIB_Y1; y < LIB_Y2; y++) {
    pc.setPixel(56, y, WALL_LIGHT);
    pc.setPixel(57, y, WALL_LIGHT);
  }

  // Foundation [54,96,118,98]
  pc.fillRect(54, 96, 118, 98, WALL_DARK);

  // WINDOWS
  const drawWindow = (wx1: number, wy1: number, wx2: number, wy2: number) => {
    // OUTLINE frame
    for (let x = wx1; x <= wx2; x++) {
      pc.setPixel(x, wy1, OUTLINE);
      pc.setPixel(x, wy2, OUTLINE);
    }
    for (let y = wy1; y <= wy2; y++) {
      pc.setPixel(wx1, y, OUTLINE);
      pc.setPixel(wx2, y, OUTLINE);
    }
    // WIN_LIGHT glass interior
    pc.fillRect(wx1 + 1, wy1 + 1, wx2, wy2, WIN_LIGHT);
    // SKY_HORIZON warm glow bottom half
    const midY = Math.floor((wy1 + wy2) / 2);
    pc.fillRect(wx1 + 1, midY, wx2, wy2, SKY_HORIZON);
    // Books on shelf at y2-4
    const bookWidths = [2, 2, 3, 2, 2, 3, 2];
    let bx = wx1 + 1;
    for (const bw of bookWidths) {
      const bookColor = Math.random() > 0.5 ? WALL_RED : WALL_DARK;
      pc.fillRect(bx, wy2 - 4, bx + bw, wy2 - 1, bookColor);
      bx += bw + 1;
      if (bx >= wx2) break;
    }
    // Mullions
    const wmidX = Math.floor((wx1 + wx2) / 2);
    const wmidY = Math.floor((wy1 + wy2) / 2);
    for (let x = wx1; x <= wx2; x++) pc.setPixel(x, wmidY, OUTLINE);
    for (let y = wy1; y <= wy2; y++) pc.setPixel(wmidX, y, OUTLINE);
  };

  drawWindow(61, 64, 77, 80);
  drawWindow(95, 64, 111, 80);

  // DOOR
  const DX1 = 82, DY1 = 80, DX2 = 90, DY2 = 96;
  // OUTLINE frame
  for (let x = DX1; x <= DX2; x++) { pc.setPixel(x, DY1, OUTLINE); pc.setPixel(x, DY2, OUTLINE); }
  for (let y = DY1; y <= DY2; y++) { pc.setPixel(DX1, y, OUTLINE); pc.setPixel(DX2, y, OUTLINE); }
  // Closed half
  pc.fillRect(DX1 + 1, DY1 + 1, 87, DY2, DOOR_YELLOW);
  // Open part
  pc.fillRect(87, DY1 + 1, DX2, DY2, WIN_DARK);
  // Knob
  pc.setPixel(84, 88, WALL_DARK);
  // Trim lines
  pc.drawLine(DX1 + 1, DY1 + 5, 87, DY1 + 5, WALL_DARK);
  pc.drawLine(DX1 + 1, DY1 + 11, 87, DY1 + 11, WALL_DARK);

  // BOOK BOX
  const BOX_X1 = 100, BOX_X2 = 110, BOX_Y1 = 88, BOX_Y2 = 95;
  // Post [104,95,106,100]
  pc.fillRect(104, BOX_Y2, 106, 100, WALL_DARK);
  // Body
  pc.fillRect(BOX_X1, BOX_Y1, BOX_X2, BOX_Y2, WALL_LIGHT);
  // Top row dark
  pc.fillRect(BOX_X1, BOX_Y1, BOX_X2, BOX_Y1 + 1, WALL_DARK);
  // Mini roof (4 lines above)
  for (let ri = 0; ri < 4; ri++) {
    const rw = ri * 1;
    pc.fillRect(BOX_X1 - rw, BOX_Y1 - ri - 1, BOX_X2 + rw, BOX_Y1 - ri, WALL_RED);
  }
  // Glass front
  pc.fillRect(BOX_X1 + 1, BOX_Y1 + 2, BOX_X2 - 1, BOX_Y2 - 1, WIN_LIGHT);
  // Books rows
  pc.fillRect(BOX_X1 + 1, BOX_Y2 - 3, BOX_X2 - 1, BOX_Y2 - 2, WIN_DARK);
  pc.fillRect(BOX_X1 + 1, BOX_Y2 - 4, BOX_X2 - 1, BOX_Y2 - 3, WALL_RED);

  // PATH from y=96 to H, expanding from door center
  const doorCenterX = Math.floor((DX1 + DX2) / 2);
  for (let y = 96; y < H; y++) {
    const progress = (y - 96) / (H - 96);
    const halfWidth = 3 + Math.floor(progress * 5);
    for (let x = doorCenterX - halfWidth; x <= doorCenterX + halfWidth; x++) {
      const stoneColor = ((x + y) % 6 === 0) ? WALL_DARK : PATH_STONE;
      pc.setPixel(x, y, stoneColor);
    }
  }

  // BENCH
  const BX1 = 122, BX2 = 144, BY = 92;
  // Verticals (legs)
  for (let y = BY; y < BY + 8; y++) {
    pc.setPixel(BX1 + 1, y, WALL_DARK);
    pc.setPixel(BX2 - 1, y, WALL_DARK);
  }
  // Slats (seat)
  pc.fillRect(BX1, BY, BX2, BY + 2, WALL_LIGHT);
  pc.fillRect(BX1, BY + 3, BX2, BY + 4, WALL_LIGHT);
  // Legs
  pc.setPixel(BX1 + 1, BY + 7, WALL_DARK);
  pc.setPixel(BX1 + 4, BY + 7, WALL_DARK);
  pc.setPixel(BX2 - 2, BY + 7, WALL_DARK);
  pc.setPixel(BX2 - 5, BY + 7, WALL_DARK);
  // Open book on bench
  pc.fillRect(BX1 + 5, BY - 2, BX1 + 14, BY, WIN_LIGHT);
  pc.setPixel(BX1 + 9, BY - 2, OUTLINE);
  pc.setPixel(BX1 + 9, BY - 1, OUTLINE);

  // BICYCLE
  const BIKE_X = 36, BIKE_Y = 96;
  // Two wheels r=3
  const drawWheelOutline = (wcx: number, wcy: number) => {
    pc.fillCircle(wcx, wcy, 3, OUTLINE);
    pc.fillCircle(wcx, wcy, 2, SKY_HORIZON);
    pc.setPixel(wcx, wcy, OUTLINE);
  };
  drawWheelOutline(BIKE_X, BIKE_Y);
  drawWheelOutline(BIKE_X + 8, BIKE_Y);
  // Frame
  pc.drawLine(BIKE_X, BIKE_Y, BIKE_X + 4, BIKE_Y - 4, WALL_DARK);
  pc.drawLine(BIKE_X + 8, BIKE_Y, BIKE_X + 4, BIKE_Y - 4, WALL_DARK);
  pc.drawLine(BIKE_X + 4, BIKE_Y - 4, BIKE_X + 3, BIKE_Y - 6, WALL_DARK);
  // Seat post
  pc.drawLine(BIKE_X + 4, BIKE_Y - 4, BIKE_X + 5, BIKE_Y - 6, OUTLINE);
  pc.drawLine(BIKE_X + 4, BIKE_Y - 6, BIKE_X + 6, BIKE_Y - 6, OUTLINE);
  // Handlebars
  pc.drawLine(BIKE_X + 3, BIKE_Y - 6, BIKE_X + 2, BIKE_Y - 5, OUTLINE);
  pc.drawLine(BIKE_X + 3, BIKE_Y - 6, BIKE_X + 4, BIKE_Y - 5, OUTLINE);

  // Now write ImageData to a small canvas and scale 6x
  const imageData = new ImageData(new Uint8ClampedArray(pc.data), W, H);

  // We need to draw to a temp canvas, then scale
  // ctx is the large 960x720 canvas context
  // Use a helper approach: create temp ImageData and drawImage
  const tempCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(W, H)
    : createFallbackCanvas(W, H);

  const tempCtx = tempCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  tempCtx.putImageData(imageData, 0, 0);

  // Scale up 6x with nearest-neighbor
  (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas as OffscreenCanvas, 0, 0, W * 6, H * 6);
}

function createFallbackCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
