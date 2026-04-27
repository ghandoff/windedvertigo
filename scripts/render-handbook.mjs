#!/usr/bin/env node
// renders docs/dev-collaboration.md → site/public/handbook/dev-collaboration/index.html
//
// run: node scripts/render-handbook.mjs
// regenerate this whenever docs/dev-collaboration.md changes, then re-deploy the site.

import { marked } from 'marked';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, 'docs/dev-collaboration.md');
const outDir = resolve(root, 'site/public/handbook/dev-collaboration');
const outPath = resolve(outDir, 'index.html');
const githubUrl =
  'https://github.com/ghandoff/windedvertigo/blob/main/docs/dev-collaboration.md';

marked.setOptions({ gfm: true, breaks: false });

const md = await readFile(sourcePath, 'utf8');
const stats = await stat(sourcePath);
const lastModified = stats.mtime.toISOString().slice(0, 10);

// build TOC from h2 headings (## sections)
const headings = [];
const renderer = new marked.Renderer();
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
renderer.heading = ({ tokens, depth }) => {
  const text = tokens.map((t) => t.raw ?? t.text ?? '').join('');
  const id = slug(text);
  if (depth === 2) headings.push({ id, text });
  return `<h${depth} id="${id}"><a href="#${id}" class="anchor" aria-label="link to section">#</a>${marked.parseInline(text)}</h${depth}>\n`;
};

const body = marked.parse(md, { renderer });

const toc = headings
  .map((h) => `<li><a href="#${h.id}">${marked.parseInline(h.text)}</a></li>`)
  .join('\n        ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#273248" />
<meta name="description" content="winded.vertigo collective dev-collaboration handbook — repo split, vercel→cf migration, tools, secrets, git workflow." />
<meta name="robots" content="noindex" />
<title>dev collaboration handbook · winded.vertigo</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23273248'/%3E%3Ctext x='50%25' y='55%25' fill='%23ffebd2' font-size='10' font-family='monospace' text-anchor='middle' dominant-baseline='middle'%3Ewv%3C/text%3E%3C/svg%3E" />
<style>
  :root {
    --wv-cadet: #273248;
    --wv-redwood: #b15043;
    --wv-sienna: #cb7858;
    --wv-champagne: #ffebd2;
    --wv-cadet-soft: #3a4866;
    --wv-bg: #ffffff;
    --wv-bg-subtle: #f7f6f2;
    --wv-border: #e6e2d8;
    --wv-text: #1f2738;
    --wv-text-muted: #5a6478;
    --wv-code-bg: #1e2638;
    --wv-code-text: #e8e6f0;
    --wv-focus: #3b82f6;
  }

  *, *::before, *::after { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  body {
    margin: 0;
    background: var(--wv-bg);
    color: var(--wv-text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    letter-spacing: 0.01em;
    -webkit-font-smoothing: antialiased;
  }

  @media (prefers-contrast: more) {
    body { color: #000; }
    :root {
      --wv-text: #000;
      --wv-text-muted: #1f2738;
    }
  }

  :focus-visible {
    outline: 3px solid var(--wv-focus);
    outline-offset: 2px;
    border-radius: 2px;
  }

  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
    background: var(--wv-cadet);
    color: var(--wv-champagne);
    padding: 0.75rem 1rem;
    text-decoration: none;
    z-index: 100;
  }
  .skip-link:focus { left: 0; }

  header.site {
    background: var(--wv-cadet);
    color: var(--wv-champagne);
    padding: 1rem 1.5rem;
    border-bottom: 4px solid var(--wv-sienna);
  }
  header.site .wrap {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  header.site .brand {
    font-weight: 600;
    letter-spacing: 0.02em;
    text-decoration: none;
    color: var(--wv-champagne);
  }
  header.site .brand:hover { color: #fff; }
  header.site .meta {
    font-size: 0.875rem;
    color: var(--wv-champagne);
    opacity: 0.85;
  }
  header.site .meta a {
    color: var(--wv-champagne);
    text-decoration: underline;
    text-decoration-color: var(--wv-sienna);
    text-underline-offset: 3px;
  }
  header.site .meta a:hover { opacity: 1; }

  .layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 3rem;
    align-items: start;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
      gap: 1rem;
      padding-top: 1.5rem;
    }
  }

  nav.toc {
    position: sticky;
    top: 1.5rem;
    font-size: 0.9rem;
    border-left: 2px solid var(--wv-border);
    padding-left: 1rem;
  }
  @media (max-width: 900px) {
    nav.toc {
      position: static;
      border-left: none;
      border: 1px solid var(--wv-border);
      border-radius: 6px;
      padding: 1rem 1.25rem;
      background: var(--wv-bg-subtle);
    }
  }
  nav.toc h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--wv-text-muted);
    margin: 0 0 0.5rem;
    font-weight: 600;
  }
  nav.toc ol {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: section;
  }
  nav.toc li {
    counter-increment: section;
    margin: 0.4rem 0;
    line-height: 1.4;
  }
  nav.toc li::before {
    content: counter(section) ".";
    color: var(--wv-text-muted);
    font-variant-numeric: tabular-nums;
    margin-right: 0.5rem;
  }
  nav.toc a {
    color: var(--wv-text);
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }
  nav.toc a:hover {
    color: var(--wv-redwood);
    border-bottom-color: var(--wv-sienna);
  }

  main.doc {
    max-width: 70ch;
    min-width: 0;
  }

  main.doc h1 {
    font-size: 2.25rem;
    color: var(--wv-cadet);
    margin: 0 0 0.5rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  main.doc h2 {
    font-size: 1.5rem;
    color: var(--wv-cadet);
    margin: 3rem 0 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--wv-border);
    line-height: 1.3;
  }
  main.doc h2:first-of-type { border-top: none; padding-top: 0; margin-top: 2rem; }
  main.doc h3 {
    font-size: 1.15rem;
    color: var(--wv-cadet);
    margin: 2rem 0 0.75rem;
  }
  main.doc h4 {
    font-size: 1rem;
    color: var(--wv-cadet-soft);
    margin: 1.5rem 0 0.5rem;
  }

  main.doc h2 .anchor,
  main.doc h3 .anchor,
  main.doc h4 .anchor {
    color: var(--wv-border);
    text-decoration: none;
    margin-right: 0.5rem;
    font-weight: 400;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }
  main.doc h2:hover .anchor,
  main.doc h3:hover .anchor,
  main.doc h4:hover .anchor {
    opacity: 1;
    color: var(--wv-sienna);
  }

  main.doc p { margin: 0 0 1rem; }

  main.doc a {
    color: var(--wv-redwood);
    text-decoration: underline;
    text-decoration-color: var(--wv-sienna);
    text-underline-offset: 2px;
  }
  main.doc a:hover {
    color: var(--wv-sienna);
    text-decoration-color: var(--wv-redwood);
  }

  main.doc strong { color: var(--wv-cadet); font-weight: 600; }

  main.doc ul, main.doc ol {
    padding-left: 1.5rem;
    margin: 0 0 1rem;
  }
  main.doc li { margin: 0.25rem 0; }
  main.doc li > p { margin-bottom: 0.5rem; }

  main.doc blockquote {
    border-left: 3px solid var(--wv-sienna);
    background: var(--wv-bg-subtle);
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    color: var(--wv-text-muted);
  }
  main.doc blockquote p:last-child { margin-bottom: 0; }

  main.doc code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: var(--wv-bg-subtle);
    color: var(--wv-cadet);
    padding: 0.1em 0.35em;
    border-radius: 3px;
    border: 1px solid var(--wv-border);
  }

  main.doc pre {
    background: var(--wv-code-bg);
    color: var(--wv-code-text);
    padding: 1rem 1.25rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
    font-size: 0.875rem;
    line-height: 1.55;
    border: 1px solid var(--wv-cadet);
  }
  main.doc pre code {
    background: none;
    color: inherit;
    padding: 0;
    border: none;
    font-size: inherit;
  }

  main.doc table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0 1.5rem;
    font-size: 0.95rem;
  }
  main.doc th, main.doc td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--wv-border);
    vertical-align: top;
  }
  main.doc th {
    background: var(--wv-bg-subtle);
    color: var(--wv-cadet);
    font-weight: 600;
    border-bottom: 2px solid var(--wv-cadet);
  }
  main.doc tr:hover td { background: var(--wv-bg-subtle); }

  main.doc hr {
    border: none;
    border-top: 1px solid var(--wv-border);
    margin: 2.5rem 0;
  }

  footer.site {
    max-width: 1200px;
    margin: 2rem auto 0;
    padding: 1.5rem;
    border-top: 1px solid var(--wv-border);
    color: var(--wv-text-muted);
    font-size: 0.85rem;
    text-align: center;
  }
  footer.site a {
    color: var(--wv-redwood);
    text-decoration: underline;
    text-decoration-color: var(--wv-sienna);
  }
</style>
</head>
<body>
  <a class="skip-link" href="#content">skip to content</a>
  <header class="site">
    <div class="wrap">
      <a class="brand" href="https://www.windedvertigo.com/">winded.vertigo</a>
      <div class="meta">
        last updated: ${lastModified} · <a href="${githubUrl}">view source on github</a>
      </div>
    </div>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="table of contents">
      <h2>contents</h2>
      <ol>
        ${toc}
      </ol>
    </nav>
    <main class="doc" id="content">
      ${body}
    </main>
  </div>
  <footer class="site">
    a winded.vertigo collective working document · for internal collaboration ·
    rendered from <a href="${githubUrl}"><code>docs/dev-collaboration.md</code></a>
  </footer>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(outPath, html, 'utf8');

console.log(`✓ rendered ${sourcePath}`);
console.log(`  → ${outPath}`);
console.log(`  ${headings.length} sections, ${(html.length / 1024).toFixed(1)} KB`);
