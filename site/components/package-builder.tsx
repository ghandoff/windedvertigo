"use client";

import { useState } from "react";
import type { PackData } from "@/lib/notion";

const QUADRANT_LABELS: Record<string, { title: string; color: string }> = {
  "people-design": { title: "people × design", color: "var(--wv-sienna)" },
  "people-research": { title: "people × research", color: "var(--wv-redwood)" },
  "product-design": { title: "product × design", color: "var(--color-accent-on-dark)" },
  "product-research": { title: "product × research", color: "var(--wv-champagne)" },
};

function PackCard({
  packKey,
  pack,
  isActive,
  onToggle,
}: {
  packKey: string;
  pack: PackData;
  isActive: boolean;
  onToggle: () => void;
}) {
  const meta = QUADRANT_LABELS[packKey] ?? { title: packKey, color: "var(--wv-champagne)" };

  return (
    <div style={{ marginBottom: "var(--space-lg)" }}>
      <button
        onClick={onToggle}
        aria-expanded={isActive}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "var(--space-lg)",
          background: "var(--color-surface-raised)",
          border: `1px solid ${isActive ? meta.color : "rgba(255,235,210,0.1)"}`,
          borderRadius: 12,
          color: "var(--wv-white)",
          cursor: "pointer",
          textAlign: "left",
          transition: "border-color 0.2s",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: meta.color, marginBottom: 4 }}>
            {meta.title}
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
            {pack.promise || pack.title}
          </p>
        </div>
        <span style={{ fontSize: "1.2rem", color: "var(--text-secondary)", transition: "transform 0.2s", transform: isActive ? "rotate(45deg)" : "none" }}>
          +
        </span>
      </button>

      {isActive && (
        <div style={{ padding: "var(--space-lg)", borderLeft: `2px solid ${meta.color}`, marginLeft: "var(--space-lg)", marginTop: "var(--space-sm)" }}>
          {pack.quadrantStory && (
            <p style={{ marginBottom: "var(--space-lg)", lineHeight: 1.7 }}>{pack.quadrantStory}</p>
          )}
          {pack.story && (
            <p style={{ marginBottom: "var(--space-lg)", color: "var(--text-secondary)", lineHeight: 1.7, fontStyle: "italic" }}>{pack.story}</p>
          )}

          {pack.outcomes.length > 0 && (
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.1em", color: meta.color, marginBottom: "var(--space-md)" }}>
                outcomes
              </h4>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {pack.outcomes.map((o, i) => (
                  <li key={i} style={{ marginBottom: "var(--space-sm)", paddingLeft: "var(--space-md)", borderLeft: "2px solid rgba(255,235,210,0.1)" }}>
                    <strong style={{ display: "block", marginBottom: 2 }}>{o.title}</strong>
                    {o.detail && <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{o.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pack.examples.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.1em", color: meta.color, marginBottom: "var(--space-md)" }}>
                examples
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-md)" }}>
                {pack.examples.map((ex) => (
                  <a
                    key={ex.id}
                    href={ex.url || "#"}
                    target={ex.url ? "_blank" : undefined}
                    rel={ex.url ? "noopener noreferrer" : undefined}
                    style={{
                      display: "block",
                      padding: "var(--space-md)",
                      background: "rgba(255,235,210,0.04)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,235,210,0.08)",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{ex.title}</div>
                    {ex.type && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>{ex.type}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {pack.crossover && (
            <p style={{ marginTop: "var(--space-lg)", fontSize: "0.9rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
              {pack.crossover}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PackageBuilder({ packs }: { packs: Record<string, PackData> }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const packEntries = Object.entries(packs);

  if (packEntries.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>loading packages…</p>;
  }

  return (
    <div>
      {packEntries.map(([key, pack]) => (
        <PackCard
          key={key}
          packKey={key}
          pack={pack}
          isActive={activeKey === key}
          onToggle={() => setActiveKey(activeKey === key ? null : key)}
        />
      ))}
    </div>
  );
}
