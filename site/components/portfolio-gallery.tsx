"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { PortfolioAsset } from "@/lib/notion";
import styles from "./portfolio-gallery.module.css";

/* ── Quadrant display ── */

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

const QUADRANT_COLORS: Record<string, string> = {
  "people-design": "var(--wv-cadet, #273248)",
  "people-research": "var(--wv-sienna, #cb7858)",
  "product-design": "var(--wv-redwood, #b15043)",
  "product-research": "var(--wv-champagne, #ffebd2)",
};

/* ── Helpers ── */

function findRelated(asset: PortfolioAsset, allAssets: PortfolioAsset[]): PortfolioAsset[] {
  return allAssets
    .filter(
      (a) =>
        a.id !== asset.id &&
        (asset.quadrants.some((q) => a.quadrants.includes(q)) ||
          asset.tags.some((t) => a.tags.includes(t))),
    )
    .slice(0, 4);
}

/* ── Asset Card (grid tile) ── */

function AssetCard({ asset, onClick }: { asset: PortfolioAsset; onClick: () => void }) {
  return (
    <button className={styles.assetCard} onClick={onClick}>
      {asset.thumbnailUrl && (
        <img
          src={asset.thumbnailUrl}
          alt=""
          style={{ width: "100%", height: 180, objectFit: "cover" }}
          loading="lazy"
        />
      )}
      <div style={{ padding: "var(--space-md)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--space-xs)", textTransform: "lowercase" }}>
          {asset.name}
        </h3>
        {asset.assetType && (
          <p style={{ fontSize: "0.8rem", color: "var(--color-accent-on-dark)", marginBottom: "var(--space-xs)" }}>
            {asset.assetType}
          </p>
        )}
        {asset.description && (
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            {asset.description.length > 150 ? asset.description.slice(0, 150) + "…" : asset.description}
          </p>
        )}
        {asset.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: "var(--space-sm)" }}>
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
    </button>
  );
}

/* ── Asset Modal ── */

function AssetModal({
  asset,
  allAssets,
  onClose,
  onOpenRelated,
}: {
  asset: PortfolioAsset;
  allAssets: PortfolioAsset[];
  onClose: () => void;
  onOpenRelated: (a: PortfolioAsset) => void;
}) {
  const related = useMemo(() => findRelated(asset, allAssets), [asset, allAssets]);
  const isLightQuadrant = asset.quadrants.includes("product-research");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={asset.name}
    >
      <div className={styles.modalContent}>
        <button className={styles.modalClose} onClick={onClose} aria-label="close">
          ×
        </button>

        {/* Media */}
        <div className={styles.modalMedia}>
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.name} />
          ) : (
            <span className={styles.iconFallback}>{asset.icon || "📁"}</span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {/* Quadrant badges */}
          {asset.quadrants.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {asset.quadrants.map((q) => {
                const bg = QUADRANT_COLORS[q] ?? "#3a4459";
                const needsDark = q === "product-research";
                return (
                  <span
                    key={q}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      textTransform: "lowercase",
                      background: bg,
                      color: needsDark ? "var(--wv-cadet, #273248)" : "#ffffff",
                      border: q === "people-design" ? "1px solid rgba(255,255,255,0.3)" : "none",
                    }}
                  >
                    {QUADRANT_LABELS[q] ?? q}
                  </span>
                );
              })}
            </div>
          )}

          <h2 style={{ fontSize: 24, fontWeight: 700, textTransform: "lowercase", marginBottom: 6 }}>
            {asset.name}
          </h2>

          {asset.assetType && (
            <p style={{ fontSize: 13, color: "var(--wv-sienna, #cb7858)", marginBottom: 12, textTransform: "lowercase" }}>
              {asset.assetType}
            </p>
          )}

          {asset.description && (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 16 }}>
              {asset.description}
            </p>
          )}

          {/* Tags */}
          {asset.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {asset.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
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

          {/* CTA */}
          {asset.url && (
            <a href={asset.url} target="_blank" rel="noopener noreferrer" className={styles.modalCta}>
              view {asset.assetType || "asset"} →
            </a>
          )}

          {/* Related work */}
          {related.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--wv-champagne, #ffebd2)", marginBottom: 12, textTransform: "lowercase", letterSpacing: 0.5 }}>
                related work
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                {related.map((r) => (
                  <button
                    key={r.id}
                    className={styles.relatedCard}
                    onClick={() => onOpenRelated(r)}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, textTransform: "lowercase" }}>
                      {r.name}
                    </p>
                    {r.assetType && (
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>
                        {r.assetType}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Gallery ── */

export function PortfolioGallery({
  assets,
  allAssets,
}: {
  assets: PortfolioAsset[];
  allAssets: PortfolioAsset[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const [activeAsset, setActiveAsset] = useState<PortfolioAsset | null>(null);
  const searchParams = useSearchParams();

  // Deep link: open modal if ?asset=<id> is present
  useEffect(() => {
    const assetParam = searchParams.get("asset");
    if (assetParam) {
      const found = allAssets.find((a) => a.id === assetParam || a.slug === assetParam);
      if (found) setActiveAsset(found);
    }
  }, [searchParams, allAssets]);

  const openModal = useCallback(
    (asset: PortfolioAsset) => {
      setActiveAsset(asset);
      window.history.pushState({}, "", `/portfolio/?asset=${encodeURIComponent(asset.id)}`);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setActiveAsset(null);
    window.history.pushState({}, "", "/portfolio/");
  }, []);

  // Extract unique quadrants for filter buttons
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
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
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-lg)" }}
      >
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onClick={() => openModal(asset)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "var(--space-2xl) 0" }}>
          no assets in this category yet.
        </p>
      )}

      {/* Modal */}
      {activeAsset && (
        <AssetModal
          asset={activeAsset}
          allAssets={allAssets}
          onClose={closeModal}
          onOpenRelated={openModal}
        />
      )}
    </div>
  );
}
