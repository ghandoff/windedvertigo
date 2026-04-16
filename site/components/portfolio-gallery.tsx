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
      className="portfolio-card"
    >
      {asset.thumbnailUrl && (
        <img
          src={asset.thumbnailUrl}
          alt=""
          className="portfolio-card-thumb"
          loading="lazy"
        />
      )}
      <div className="portfolio-card-body">
        <h3 className="portfolio-card-title">{asset.name}</h3>
        {asset.assetType && (
          <p className="portfolio-card-type">{asset.assetType}</p>
        )}
        {asset.description && (
          <p className="portfolio-card-desc">
            {asset.description.length > 150
              ? asset.description.slice(0, 150) + "…"
              : asset.description}
          </p>
        )}
        {asset.tags.length > 0 && (
          <div className="portfolio-card-tags">
            {asset.tags.map((tag) => (
              <span key={tag} className="portfolio-card-tag">
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
      <div className="portfolio-filters">
        <button
          onClick={() => setFilter("all")}
          className={`portfolio-filter-btn${filter === "all" ? " portfolio-filter-btn--active" : ""}`}
        >
          all
        </button>
        {quadrants.map((q) => (
          <button
            key={q}
            onClick={() => setFilter(q)}
            className={`portfolio-filter-btn${filter === q ? " portfolio-filter-btn--active" : ""}`}
          >
            {QUADRANT_LABELS[q] ?? q}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="portfolio-grid">
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="portfolio-empty">no assets in this category yet.</p>
      )}
    </div>
  );
}
