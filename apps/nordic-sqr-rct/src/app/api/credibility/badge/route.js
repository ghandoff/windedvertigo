import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'Reviewer';

  const pacificColor = '#024a87';
  const size = 400;
  const ringWidth = 40;
  const ringRadius = size / 2 - ringWidth / 2;
  const centerRadius = size / 2 - ringWidth - 20;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="white"/>

  <!-- Outer ring -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${ringRadius}" fill="none" stroke="${pacificColor}" stroke-width="${ringWidth}"/>

  <!-- Inner circle (white background) -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${centerRadius}" fill="white" stroke="${pacificColor}" stroke-width="2"/>

  <!-- SQR-RCT text at top (in ring area) -->
  <text
    x="${size / 2}"
    y="50"
    font-family="Arial, sans-serif"
    font-size="24"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >
    SQR-RCT
  </text>

  <!-- Verified badge icon in center -->
  <g transform="translate(${size / 2}, ${size / 2 - 30})">
    <!-- Checkmark circle -->
    <circle cx="0" cy="0" r="35" fill="${pacificColor}"/>
    <path
      d="M -12 0 L -5 8 L 15 -12"
      fill="none"
      stroke="white"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>

  <!-- Reviewer name in center -->
  <text
    x="${size / 2}"
    y="${size / 2 + 40}"
    font-family="Arial, sans-serif"
    font-size="20"
    font-weight="bold"
    fill="${pacificColor}"
    text-anchor="middle"
    dominant-baseline="middle"
  >
    ${name}
  </text>

  <!-- VERIFIED REVIEWER text at bottom (in ring area) -->
  <text
    x="${size / 2}"
    y="${size - 45}"
    font-family="Arial, sans-serif"
    font-size="16"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="2"
  >
    VERIFIED REVIEWER
  </text>

  <!-- Nordic Naturals text at bottom -->
  <text
    x="${size / 2}"
    y="${size - 15}"
    font-family="Arial, sans-serif"
    font-size="12"
    fill="${pacificColor}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-weight="500"
  >
    Nordic Naturals
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': 'inline; filename="sqr-rct-badge.svg"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
