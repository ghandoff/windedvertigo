# harbour page — claude code context

## settled decisions

### navbar: play. finds. us.

three words. one sentence. one navigation system.

*play finds us* — drawn from non-dual philosophy (advaita vedanta, dzogchen). not "play wakes us" (which implies a prior sleep, a dualism between those who are awake and those who aren't). "finds" inverts the seeker/sought relationship entirely — play doesn't transform you, it arrives at the same place you already are. recognition, not revelation. the self was never absent.

each word maps to a section:

- **play.** → scrolls down to the games and toys (vertigo.vault, deep.deck, creaseworks, physical toys designed for partners and clients)
- **finds.** → scrolls further down to the "why us" / methodology section — not a credential list, but a demonstration of how wv's approach works. the design process (find, fold, unfold, find again) lives here as evidence. this section earns the word "finds" by *showing* the finding rather than explaining it.
- **us.** → links outward to windedvertigo.com/what, which holds the pillars (play, aliveness, justice), the design process, and the service quadrants. "us" is both the collective and the pronoun that includes the visitor — they are already part of what the harbour is.

---

## conceptual foundation

### the harbour as threshold, not destination

a harbour is a specific kind of place. ships don't stay — they arrive, rest, resupply, find their bearings, and leave. it is protected geography: you can be still here in a way you can't be in open water. it is also inherently communal — different vessels from different journeys ending up in the same place at the same time.

this is the low-stakes condition the harbour creates. you can't play in open water. you need the harbour first. the absence of stakes isn't a nice feature — it's the design.

### the harbour is bi-directional

**forward arc (harbour → /what):** the harbour prepares visitors emotionally. if someone arrives at /what having played something first, the pillars and process don't read as information — they read as *recognition*. they feel it before they understand it. the harbour is the find. /what is the fold.

**reverse arc (/what → harbour):** for wv partners and clients arriving from /what, the harbour is proof of concept. they already know the methodology. the harbour shows them what it looks like when the philosophy becomes something you can hold in your hands. *you know the map. now here is the territory.*

### the full site arc maps onto find, fold, unfold, find again

- the harbour is the **find**
- /what is the **fold**
- the work wv does with clients is the **unfold**
- find again is what happens to people who return

this arc is not just wv's design process. it is the visitor's journey across the entire site.

### the harbour vs. the do page

**harbour** — here is a thing. use it.  
**do** — here is what we make. work with us.

the harbour is self-service. the do page is relational. in the harbour, nothing requires wv's involvement — the work is already done and in the design of the thing itself. the do page is where the relationship begins, where a partner understands that what they see in the harbour is reproducible for their specific context.

the same object (e.g. vertigo.vault) can live in both, but means different things in each context:
- in the harbour: a front door. enter and use it.
- in /do: a window. look at it and understand what it represents about how wv works.

the do page should never become a second harbour — a catalogue of things rather than an argument about a methodology.

---

## page structure recommendations

### hero section

should feel like arrival, not a product pitch. the harbour feeling is shelter, permission, stillness. lead with what the harbour *offers* (the condition) rather than what it *contains* (the catalogue).

current tagline: *"winded.vertigo presents"*  
current hero copy: *"playful tools for connection, creativity, and growth — designed by developmental psychologists and learning scientists who believe play is how humans make sense of the world."*

this is accurate but slightly generic. consider whether the copy can do the harbour work — name the feeling of arriving somewhere protected, where stakes don't apply.

### play. section (games + toys)

the most literal section. should feel alive on arrival — things already in motion, not waiting to be purchased. the best harbours don't have signs explaining that they're harbours. let the games and toys speak first.

product cards should be written at two depths simultaneously:
- readable as *just a fun thing* on the surface
- readable as *an argument for the wv approach* underneath

find, fold, unfold, find again should be legible in the mechanics of each game for the visitor who already knows wv — without being announced for the visitor who doesn't.

### finds. section (methodology / why us)

not a credential list. the word "finds" raises the stakes — it promises something will be uncovered, not explained.

frame as: *here is the thinking underneath what you just played.* the developmental psychology backbone, the evidence-as-feedback design philosophy, the design process — these are the geography that makes the harbour safe. not badges. not proof of trustworthiness. the lighthouse.

the design process (find, fold, unfold, find again) could appear here as a demonstration — not as navigation, but as the methodology made visible.

for the visitor arriving from /what: this section confirms the continuity between the harbour and everything else. for the first-time visitor: this section reveals that what they just played was designed with intention they hadn't yet perceived.

### us. section (link to /what)

for the newcomer: a departure — they leave the harbour and go deeper into wv. should feel like being invited to look at the horizon.

for the returning visitor: a homecoming — confirmation of continuity between the harbour and the larger wv world.

consider teasing the three pillars here without explaining them: play. aliveness. justice. three words that point outward and say: there is more water beyond this harbour.

the /what link should feel like *extension*, not *destination* — less "learn more about us" and more "here is where the harbour connects to everything else."

---

## brand guidelines (non-negotiable)

- all-lowercase text throughout
- british spelling (harbour, not harbor)
- no bullet points in body copy
- spare, declarative tone — the voice of someone who knows exactly what they believe
- wv vocabulary: traces, vertigo, flow, whirlpool, playdate, find/fold/unfold, aliveness

---

## cms notes

content edits flow through the **site content cms** notion database (`09a046a556c1455e80073546b8f83297`) via the sync script → json files → html pages. edit content in notion; the site re-renders after sync. do not edit html directly unless instructed.

relevant notion pages:
- harbour page metadata: `318e4ee7-4ba4-8172-8b0e-e0a918761943`
- harbour hero: `318e4ee7-4ba4-8155-b774-e041ef271e23`
- harbour nav: play (order 1): `318e4ee7-4ba4-8153-ac74-d6258388db5a`
- harbour nav: finds (order 2, currently "why us"): `318e4ee7-4ba4-8141-bf97-c1aef01e1480`
- harbour nav: us (order 3, currently "about", links to /what): `318e4ee7-4ba4-8114-9a19-ebbe179ceeba`
- harbour games database: `8e3f3364-b265-4640-a91e-d0f38b091a07`

---

## pending changes to implement

1. **update navbar taglines in notion cms:**
   - nav order 1: tagline → `play.`
   - nav order 2: tagline → `finds.` (currently `why us.`)
   - nav order 3: tagline → `us.` (currently `about.`)

2. **review and reframe the "finds." section content** so it earns the word — demonstration over declaration, methodology made visible rather than credential list.

3. **review hero copy** for whether it names the harbour-as-threshold feeling or just lists what the harbour contains.

4. **audit all product card copy** for dual-depth legibility — works for first-time visitors, rewards wv insiders.
