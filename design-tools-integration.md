# design tools integration — winded.vertigo

> how claude design, adobe creative suite, canva, and port CRM work together.
> last updated: may 2026

## the old constraint

previously, claude's design capabilities were limited to code-generated outputs (HTML, SVG, React). this meant brand assets, social graphics, presentation decks, and client deliverables all required manual work in adobe or canva — disconnected from the AI-assisted workflow. the design layer was a bottleneck.

## what changed

### claude design (launched april 2026)
claude can now generate visual assets directly:
- interactive prototypes and mockups
- pitch decks and presentations
- marketing collateral (social assets, landing pages, one-pagers)
- code-powered prototypes with motion, 3D, and interactive elements
- design system integration — reads your codebase and brand files to maintain consistency
- exports to: PDF, PPTX, HTML, Canva (fully editable), internal URLs
- handoff bundles to claude code for production builds

### adobe MCP (connected)
claude has direct API access to:
- **adobe express templates** — search thousands of professional templates for social posts, flyers, banners, invitations. fill text, customise, and animate.
- **adobe stock** — search and license stock photos, vectors, illustrations, videos
- **creative cloud files** — search, browse, and manage files across photoshop, illustrator, indesign
- **adobe firefly** — AI image generation, mood boards
- **indesign rendering** — export InDesign documents as PDF/JPEG/PNG, batch merge data into templates (variable data publishing)
- **image editing** — crop, resize, background removal, colour adjustments, blur, vectorise
- **video tools** — quick cuts, resizing, speech enhancement

### canva (via claude design export)
- claude design exports directly to canva as fully editable designs
- team members (especially payton) can then refine, add brand elements, and collaborate without needing adobe expertise
- canva is the "last mile" for non-technical team members

### port CRM (port.windedvertigo.com)
- proposal generation with brand-compliant templates
- campaign management (email sends via resend)
- contact + pipeline tracking
- proposal PDFs generated programmatically

## the integrated workflow

### for marketing campaigns

```
idea (whirlpool / strategy session)
  → claude drafts campaign brief + content
  → claude design generates social assets (instagram, linkedin)
     → export to canva for payton to refine + schedule
     → or export direct to platform-ready formats
  → claude drafts email copy
     → port CRM sends via resend
  → adobe express for template-based assets (event flyers, announcements)
  → adobe stock for photography when needed
  → all tracked in port CRM campaigns
```

### for client deliverables

```
client brief / RFP
  → claude generates proposal via port CRM proposal generator
  → claude design creates presentation deck
     → export to PPTX for garrett to present
     → or export to canva for payton to brand-polish
  → adobe indesign for complex print deliverables (reports, certificates)
     → claude renders InDesign → PDF via MCP
  → handoff to claude code if prototype needed
```

### for whirlpool experiences

```
whirlpool agenda generated (automated sunday/tuesday)
  → claude design creates session-specific visual tools
     (like the prowl, writer's room, ppcs-launch, delegation matrix)
  → harbour apps provide interactive activities
  → adobe express for quick visual aids during session
  → post-session: claude extracts key moments → social content
     → claude design generates quote cards, infographics
     → export to canva for payton → publish
```

### for harbour app marketing

```
harbour app exists (e.g., deep.deck, raft-house)
  → claude screenshots app in action
  → adobe tools: background removal, colour adjustments, crop
  → claude design creates promotional assets:
     - app preview cards for social
     - feature highlight graphics
     - comparison charts (before/after learning outcomes)
  → export to canva for social scheduling
  → email campaign via port CRM to relevant audience segment
```

## tool assignments

| tool | primary use | who uses it | when |
|------|-----------|-------------|------|
| **claude design** | rapid prototyping, social assets, decks, one-pagers, whirlpool tools | garrett (via claude), payton (refinement) | campaign creation, client presentations, whirlpool prep |
| **adobe express** | template-based design (flyers, posts, banners) | payton directly, or claude via MCP | event promotion, social content, announcements |
| **adobe illustrator** | vector work, logo refinements, complex illustrations | aaron (director of aesthetics) | brand assets, print materials |
| **adobe indesign** | long-form print (reports, certificates, proposals) | aaron or garrett (via claude MCP) | client deliverables, PPCS certificates |
| **adobe photoshop** | photo editing, compositing | aaron or claude (via image editing MCP) | marketing photography, harbour screenshots |
| **adobe firefly** | AI-generated imagery, mood boards | garrett (via claude) or aaron | concept exploration, campaign visuals |
| **adobe stock** | licensed photography and vectors | claude (via MCP) | any asset needing professional photography |
| **canva** | collaborative editing, social scheduling, brand kit | payton (primary), team (collaborative) | final mile for all social content, team presentations |
| **port CRM** | email campaigns, proposals, pipeline | garrett + payton | outreach, nurture sequences, proposals |

## design system enforcement

### the problem
w.v's brand guidelines (brand-voice.md) define colours, typography, tone, and writing rules — but these haven't been consistently applied because design work was manual and distributed.

### the solution
1. **claude design reads the brand system.** point it at brand-voice.md + the colourways + typography rules. every asset it generates starts brand-compliant.
2. **canva brand kit.** upload w.v colours, fonts, logos, and templates to canva's brand kit. payton + team always start from brand-compliant templates.
3. **adobe creative cloud libraries.** store brand colours, character styles, and logos in a shared CC library. any team member using adobe apps pulls from the same source.
4. **port CRM templates.** proposal and email templates use brand colours and voice. generated programmatically, always consistent.
5. **weekly CMO review.** the automated wednesday review includes a brand compliance check on anything published that week.

### brand asset sources
- primary logo / wordmark: adobe CC library (aaron maintains)
- social templates: canva brand kit (payton maintains)
- proposal templates: port CRM (automated)
- presentation templates: claude design (reads brand system)
- whirlpool tools: custom HTML (claude code builds, follows CSS variable system)

## what this means practically

### before (pre-may 2026)
- garrett describes an idea → payton creates in canva manually → review cycle → publish
- client presentation → garrett writes in google slides → payton polishes → deliver
- social content → nobody does it because the workflow has too many steps
- whirlpool tools → claude code builds HTML from scratch each time

### after (may 2026 onward)
- garrett describes an idea → claude design generates draft → export to canva → payton refines in 15 minutes → publish
- client presentation → claude design generates full deck from brief → export to PPTX or canva → present
- social content → claude generates 5 branded posts → adobe express templates for variety → payton schedules batch in 30 minutes
- whirlpool tools → claude design prototypes → claude code builds → deploy to CF workers → team uses

### the speed difference
what used to take 2-3 days (idea → design → review → publish) can now happen in 2-3 hours. this is how a 7-person collective competes with agencies that have dedicated design teams.

## recommendations

1. **set up canva brand kit this week.** upload w.v colours (#273248, #b15043, #cb7858, #ffebd2), logo files, and font selections. payton owns this.

2. **create an adobe CC shared library.** aaron sets up brand colours, logos, and key assets. share with the team.

3. **establish claude design as the default starting point.** for any visual need, start with claude. only go to adobe for specialist work (complex vector, print production, video editing).

4. **use adobe express for volume.** social posts, event graphics, quick announcements — express templates are faster than starting from scratch.

5. **keep adobe illustrator/photoshop for aaron.** these are specialist tools. don't expect the whole team to use them.

6. **integrate port CRM into every campaign.** every email send, every outreach touch, every proposal — through port. this is how we track what's working.

7. **automate the content pipeline.** whirlpool recordings → claude summarises → claude design generates social cards → export to canva → payton publishes. this should happen within 24 hours of every whirlpool.
