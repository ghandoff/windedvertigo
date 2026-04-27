import type { Team } from '@/state/types';
import { getStartup } from '@/content/startups';
import { getValue } from '@/content/values';
import { COPY } from '@/content/copy';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface SvgDoc {
  svg: string;
  width: number;
  height: number;
}

function buildSvg(team: Team): SvgDoc {
  const startup = getStartup(team.startupId);
  if (!startup) return { svg: '', width: 0, height: 0 };
  const purpose =
    team.purposeStatement && team.purposeStatement.trim().length > 0
      ? team.purposeStatement
      : 'a company still finding its purpose.';
  const values = team.wonValues
    .map((id) => getValue(id)?.name)
    .filter((n): n is string => Boolean(n));
  const prompts = COPY.reflection.prompts;
  const answers = prompts.map((_, i) => (team.reflectionAnswers?.[i] ?? '').trim());
  const hasAnswers = answers.some((a) => a.length > 0);

  const chips = values
    .map((name, idx) => {
      const x = 440 + (idx % 3) * 230;
      const y = 400 + Math.floor(idx / 3) * 54;
      return `
        <rect x="${x}" y="${y - 28}" rx="10" ry="10" width="210" height="40" fill="#ffebd2" stroke="#273248" stroke-width="1.5"/>
        <text x="${x + 105}" y="${y}" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#273248">${escapeXml(truncate(name, 22))}</text>
      `;
    })
    .join('');

  const baseCard = `
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="32" y="32" width="1136" height="566" rx="24" fill="#ffffff" stroke="#273248" stroke-width="2"/>
  <text x="80" y="112" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="#b15043" letter-spacing="4">WINDED.VERTIGO · VALUES AUCTION</text>
  <text x="80" y="200" font-family="Inter, sans-serif" font-size="72" font-weight="700" fill="#273248">${escapeXml(startup.name)}</text>
  <rect x="80" y="232" rx="16" ry="16" width="${startup.sector.length * 12 + 40}" height="32" fill="#273248"/>
  <text x="${100}" y="254" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#ffffff">${escapeXml(startup.sector)}</text>
  <foreignObject x="80" y="300" width="1040" height="140">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; font-weight: 700; font-size: 28px; color: #273248; line-height: 1.3;">${escapeHtml(truncate(purpose, 240))}</div>
  </foreignObject>
  ${chips}
  <text x="80" y="572" font-family="Inter, sans-serif" font-size="14" fill="#273248" opacity="0.6">team ${escapeXml(team.colour)} · ${values.length} values locked in · ${team.credos} credos remaining</text>
`;

  if (!hasAnswers) {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffebd2"/>
      <stop offset="0.6" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  ${baseCard}
</svg>
`;
    return { svg, width: 1200, height: 630 };
  }

  const blockHeight = 200;
  const reflectionsTop = 660;
  const reflectionsHeight = 80 + blockHeight * prompts.length + 40;
  const totalHeight = 630 + reflectionsHeight;

  const reflectionBlocks = prompts
    .map((prompt, i) => {
      const y = reflectionsTop + 80 + i * blockHeight;
      const answer = answers[i] || '—';
      return `
  <text x="80" y="${y}" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="#b15043">${escapeXml(prompt)}</text>
  <foreignObject x="80" y="${y + 16}" width="1040" height="${blockHeight - 50}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; font-size: 20px; color: #273248; line-height: 1.45; padding-top: 4px;">${escapeHtml(truncate(answer, 600))}</div>
  </foreignObject>
`;
    })
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${totalHeight}" width="1200" height="${totalHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffebd2"/>
      <stop offset="0.6" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="${totalHeight}" fill="#ffffff"/>
  ${baseCard}
  <line x1="80" y1="630" x2="1120" y2="630" stroke="#273248" stroke-width="1" opacity="0.2"/>
  <text x="80" y="${reflectionsTop + 30}" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="#b15043" letter-spacing="3">REFLECTIONS</text>
  ${reflectionBlocks}
</svg>
`;
  return { svg, width: 1200, height: totalHeight };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('no 2d context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (pngBlob) resolve(pngBlob);
        else reject(new Error('png encode failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg load failed'));
    };
    img.src = url;
  });
}

export async function exportIdentityCard(team: Team): Promise<void> {
  const { svg, width, height } = buildSvg(team);
  if (!svg) return;
  const png = await svgToPngBlob(svg, width, height);
  const startup = getStartup(team.startupId);
  const filename = `${slugify(startup?.name ?? 'values-auction')}-${team.colour}.png`;
  const url = URL.createObjectURL(png);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { buildSvg };
