# Session Notes

## Commit Message Style Guide

Example of a well-structured commit for this repo:

**Title:**
```
feat: add /what-v2 experimental page with flexible Notion-driven layouts
```

**Description:**
```
Add Layout (select) and Icon (URL) properties to the what page content
Notion database, extending the sync pipeline to pull these new fields.

Create /what-v2/ as a side-by-side experimental page that reads from the
same what-page.json but supports per-section layout variants (default,
side-by-side, centered, card, full-width) and optional icon graphics —
all controllable from Notion without code changes.

Changed files:
- scripts/notion-config.js: add layout + icon property mappings
- scripts/fetch-notion.js: extract layout + icon in what-page sync
- apps/site/what-v2/index.html: new v2 page with layout engine
- apps/site/data/what-page.json: regenerated with new fields
```

### Pattern
- **Title**: `type: concise summary under 70 chars` (feat, fix, docs, chore)
- **Description**: what changed and why, then a file manifest with one-line descriptions
- Keep it human-readable — explain the *purpose*, not just the diff

## GitHub Web Editor (CodeMirror 6) — Content Replacement

**CRITICAL**: When replacing file content in GitHub's web editor, the correct sequence is:

1. `document.execCommand('selectAll')`
2. `document.execCommand('delete')` — **DO NOT SKIP THIS**
3. `document.execCommand('insertText', false, content)`

Using `selectAll` + `insertText` without the `delete` step **APPENDS** instead of replacing. This caused the fetch-notion.js doubling incident (1498 lines instead of 749).
