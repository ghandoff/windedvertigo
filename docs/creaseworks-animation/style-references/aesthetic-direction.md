# creaseworks illustration aesthetic — confirmed 2026-07-05

confirmed by garrett from chatgpt-generated sample images. applies to all
creaseworks illustration work: playdate backdrop images, character poses,
animation backgrounds, video compositions.

## reference images
`style-ref-01-kids-clouds-grid.jpg` — kids pointing at cloud characters on graph paper  
`style-ref-02-kids-drawing-clouds.jpg` — kids drawing, contemplative, cloud characters  
`style-ref-03-kids-blocks.jpg` — kids building blocks, grid/rain background  
`style-ref-04-kids-movement.jpg` — children walking/balancing, minimal landscape

## background
- **base**: warm parchment cream — `#f5f0e8` (not white, not beige, warm)
- **grid**: graph paper lines, thin, slightly darker warm tone — `#ddd5c8`
- grid spacing: ~40–48px at 1920×1080; subtle, not dominant
- **feel**: like drawing on good quality grid paper, not a digital grid

## palette
| role | hex | description |
|---|---|---|
| parchment (bg) | `#f5f0e8` | warm cream base |
| grid lines | `#ddd5c8` | subtle warm gray-beige |
| sage green | `#6b8c6b` | muted, not vivid |
| terracotta / clay | `#b5654a` | warm rust, close to creaseworks redwood |
| dusty teal | `#4a8080` | muted blue-green |
| ink line | `#2a2318` | warm dark brown-black, not pure black |
| rosy cheek | `#e8a090` | dot of colour on children's faces |

note: these map closely to the creaseworks brand palette but desaturated.
`brand.redwood (#b15043)` ≈ terracotta. `brand.cadet (#273248)` is too dark/cold
for this aesthetic — don't use as a background in illustration contexts.

## character style
- simple **rounded shapes** — no complex anatomy
- **dot eyes** — two small filled circles, no whites, no pupils
- **tiny mouth** — a single short curve, 3–4px wide at 200px character size
- **rosy cheek dots** — optional, adds warmth
- **no outlines on hair** — hair is a single filled shape with light hatching
- the cloud characters in ref images 1–2 are the exact register for cord
  and all creaseworks material characters: simple shape + two dot eyes + small smile

## texture
- **hatching on fills**: fine parallel or cross-hatched lines in a slightly
  darker tone of the fill colour — gives a crayon/coloured pencil feel
- NOT flat fills, NOT gradients, NOT photorealistic shading
- outline weight: thin (1–2px at 200px character size), slightly wobbly/rough
- SVG `feTurbulence` displacement filter approximates the wobbly line quality

## illustration style references
Beatrice Alemagna (european picture book), Isabelle Arsenault, risograph printing.
avoid: Disney, Pixar, bright primaries, American cartoon, manga.

## chatgpt / imagen prompt anchors
add these phrases to any scene generation prompt:
> "children's book illustration, european picture book style, graph paper background,
> warm cream parchment, muted palette sage green terracotta dusty teal, simple
> round-headed child figures, crayon and pencil texture hatching, soft hand-drawn
> lines, gentle and contemplative mood, Beatrice Alemagna illustration style"

for character-specific prompts add:
> "simple rounded shape, dot eyes, minimal detail, soft edges, textured fill
> with fine pencil hatching, warm dark ink outline"

## what this changes in the video compositions
- scene video backgrounds: swap dark cadet for warm parchment + graph paper grid
- cord SVG: simplify eyes to dots, round the body proportions, add hatching texture
- cord cartoon backgrounds: warm parchment instead of `#273248`
- all caption text: use warm dark ink `#2a2318` on light backgrounds (not cream-on-dark)
