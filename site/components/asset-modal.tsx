"use client";

import { useMemo, useEffect } from "react";
import styles from "./asset-modal.module.css";

/* ── Types ── */

/** Lightweight asset shape for the modal — a superset of PackData examples. */
export interface ModalAsset {
  id: string;
  title: string;
  type: string;
  icon: string;
  url: string;
  detail: string;
  thumbnailUrl: string;
  tags: string[];
  quadrants: string[];
}

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

export function findRelated(asset: ModalAsset, pool: ModalAsset[]): ModalAsset[] {
  return pool
    .filter(
      (a) =>
        a.id !== asset.id &&
        (asset.quadrants.some((q) => a.quadrants.includes(q)) ||
          asset.tags.some((t) => a.tags.includes(t))),
    )
    .slice(0, 4);
}

/* ── Component ── */

export function AssetModal({
  asset,
  allAssets,
  onClose,
  onOpenRelated,
}: {
  asset: ModalAsset;
  allAssets: ModalAsset[];
  onClose: () => void;
  onOpenRelated: (a: ModalAsset) => void;
}) {
  const related = useMemo(() => findRelated(asset, allAssets), [asset, allAssets]);

  // Close on Escape + lock body scroll
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
      aria-label={asset.title}
    >
      <div className={styles.modalContent}>
        <button className={styles.modalClose} onClick={onClose} aria-label="close">
          ×
        </button>

        {/* Media */}
        <div className={styles.modalMedia}>
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.title} />
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
            {asset.title}
          </h2>

          {asset.type && (
            <p style={{ fontSize: 13, color: "var(--wv-sienna, #cb7858)", marginBottom: 12, textTransform: "lowercase" }}>
              {asset.type}
            </p>
          )}

          {asset.detail && (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 16 }}>
              {asset.detail}
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
              view {asset.type || "asset"} →
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
                      {r.title}
                    </p>
                    {r.type && (
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>
                        {r.type}
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
