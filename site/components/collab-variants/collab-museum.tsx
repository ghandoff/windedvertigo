import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #16 — Museum Label
 *
 * Each collaborator presented as a typographic museum artefact card:
 * name in small caps, a status line ("active · since 2021" or "2019–2024"),
 * and an optional two-word descriptor drawn from a static map.
 * No logos. No animation. Pure voice.
 *
 * Mobile: single column. Tablet+: 2–3 column responsive grid.
 * UDL: fully static, no motion, high contrast text.
 */

const DESCRIPTORS: Record<string, string> = {
  "prme":                                    "responsible management",
  "press play":                              "play pedagogy",
  "history colab":                           "living history",
  "care for education":                      "educator wellbeing",
  "education for sharing":                   "global citizenship",
  "nordic naturals":                         "nutrition + learning",
  "lego foundation":                         "playful learning",
  "sesame workshop":                         "media + childhood",
  "lego playful learning museum network":    "museum play",
  "exploratorium":                           "inquiry science",
  "scratch":                                 "creative computing",
  "aarhus university":                       "play research",
  "epfl":                                    "learning engineering",
  "thinkery":                                "children's museum",
  "oikos international":                     "student sustainability",
  "cce":                                     "civic education",
  "badm":                                    "business + design",
  "rigamajig":                               "open-ended construction",
};

export function CollabMuseum() {
  return (
    <section className="collab-variant collab-museum" aria-label="organisations we play with">
      <p className="collab-variant-label">organisations we play with</p>
      <div className="museum-grid">
        {COLLABORATORS.map((c) => (
          <article key={c.name} className={`museum-card${c.current ? " museum-card--active" : ""}`}>
            <h3 className="museum-card-name">{c.name}</h3>
            <p className="museum-card-status">
              {c.current ? "active collaborator" : "past collaborator"}
            </p>
            {DESCRIPTORS[c.name] && (
              <p className="museum-card-descriptor">{DESCRIPTORS[c.name]}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
