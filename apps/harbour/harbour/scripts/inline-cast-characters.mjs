/**
 * Inline each character exploration HTML into cast/index.html via iframe srcdoc.
 *
 * Before: <iframe src="./cord-character.html" ...> (fails if network/CSP/frame-ancestors block)
 * After:  <iframe srcdoc="&lt;!DOCTYPE html&gt;..." ...>  (fully self-contained)
 *
 * Also renames Aaron Fruit → Erin Fried throughout the brief (new illustrator).
 *
 * Source character files are left on disk so deep links continue to work.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAST_DIR = path.resolve(__dirname, "..", "public", "cast");
const INDEX = path.join(CAST_DIR, "index.html");

const characters = ["cord", "twig", "swatch", "jugs", "crate", "mud", "drip"];

function escapeForSrcdoc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let html = fs.readFileSync(INDEX, "utf8");
const before = html.length;

for (const name of characters) {
  const filePath = path.join(CAST_DIR, `${name}-character.html`);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip: ${name}-character.html not found`);
    continue;
  }
  const body = fs.readFileSync(filePath, "utf8");
  const escaped = escapeForSrcdoc(body);
  const regex = new RegExp(
    `<iframe\\s+src="\\./${name}-character\\.html"([^>]*)>`,
    "g",
  );
  if (!regex.test(html)) {
    console.warn(`skip: no iframe match for ${name}`);
    continue;
  }
  html = html.replace(regex, `<iframe srcdoc="${escaped}"$1>`);
  console.log(`ok: inlined ${name} (${body.length} chars)`);
}

// Rename illustrator Aaron Fruit → Erin Fried (new illustrator on this brief).
// Word boundaries to avoid touching substrings.
const renames = [
  [/\bAaron Fruit\b/g, "Erin Fried"],
  [/\baaron fruit\b/g, "Erin Fried"],
  [/\bAaron\b/g, "Erin"],
  [/\baaron\b/g, "Erin"],
  [/\bAARON\b/g, "ERIN"],
];
for (const [pat, rep] of renames) {
  const matches = html.match(pat);
  if (matches) {
    html = html.replace(pat, rep);
    console.log(`renamed ${matches.length}× ${pat}`);
  }
}

fs.writeFileSync(INDEX, html);
const after = html.length;
console.log(`\nindex.html: ${before} → ${after} chars (+${after - before})`);
