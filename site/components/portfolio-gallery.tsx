"use client";

import { useState, useMemo } from "react";
import type { PortfolioAsset } from "@/lib/notion";

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

function AssetCard({ asset }: { asset: PortfolioAsset }) {
  return (
    <a
      href={asset.url || "#"}
      target={asset.url ? "_blank" : undefined}
      rel={asset.url ? "noopener noreferrer" : undefined}
      style={{
        display: "block",
        background: "var(--color-surface-raised)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,235,210,0.08)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.2s, border-color 0.2s",
      }}
      className="project-card"
    >
      {asset.thumbnailUrl && (
        <img
          src={asset.thumbnailUrl}
          alt=""
          style={{ width: "100%", height: 180, objectFit: "cover" }}
          loading="lazy"
        />
      )}
      <div style={{ padding: "var(--space-md)" }}>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: "var(--space-xs)",
            textTransform: "lowercase",
          }}
        >
          {asset.name}
        </h3>
        {asset.assetType && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--color-accent-on-dark)",
              marginBottom: "var(--space-xs)",
            }}
          >
            {asset.assetType}
          </p>
        )}
        {asset.description && (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {asset.description.length > 150
              ? asset.description.slice(0, 150) + "…"
              : asset.description}
          </p>
        )}
        {asset.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: "var(--space-sm)",
            }}
          >
            {asset.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,235,210,0.15)",
                  color: "var(--text-secondary)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

export function PortfolioGallery({ assets }: { assets: PortfolioAsset[] }) {
  const [filter, setFilter] = useState<string>("all");

  const quadrants = useMemo(() => {
    const qs = new Set<string>();
    assets.forEach((a) => a.quadrants.forEach((q) => qs.add(q)));
    return Array.from(qs).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    if (filter === "all") return assets;
    return assets.filter((a) => a.quadrants.includes(filter));
  }, [assets, filter]);

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            border: "1px solid rgba(255,235,210,0.2)",
            background: filter === "all" ? "var(--accent)" : "transparent",
            color: "var(--wv-white)",
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "background 0.2s",
            fontFamily: "inherit",
          }}
        >
          all
        </button>
        {quadrants.map((q) => (
          <button
            key={q}
            onClick={() => setFilter(q)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid rgba(255,235,210,0.2)",
              background: filter === q ? "var(--accent)" : "transparent",
              color: "var(--wv-white)",
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "background 0.2s",
              fontFamily: "inherit",
            }}
          >
            {QUADRANT_LABELS[q] ?? q}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div
        className="projects-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "var(--space-lg)",
        }}
      >
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "var(--space-2xl) 0" }}>
          no assets in this category yet.
        </p>
      )}
    </div>
  );
}
