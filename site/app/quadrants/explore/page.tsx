import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchSiteContent,
  fetchPackageBuilderData,
} from "@/lib/notion";
import { PackageBuilder } from "@/components/package-builder";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "explore packages – winded.vertigo",
  description:
    "explore our four quadrants and see what we can build together.",
  alternates: { canonical: "/quadrants/explore/" },
  openGraph: {
    title: "explore packages – winded.vertigo",
    description:
      "explore our four quadrants and see what we can build together.",
    url: "/quadrants/explore/",
  },
};

export default async function DoExplorePage() {
  const [sections, packs] = await Promise.all([
    fetchSiteContent("do"),
    fetchPackageBuilderData(),
  ]);

  const cta = sections.find((s) => s.type === "cta");

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <h2 className="hero-title">explore.</h2>

          <section className="content-section" style={{ marginBottom: "var(--space-2xl)" }}>
            <p>
              at winded.vertigo, we work across four quadrants that connect
              people and products through design and research. choose your
              starting point and explore what we can build together.
            </p>
          </section>

          <Image
            src="/images/four_quadrants.png"
            alt="the four quadrants: people × design, people × research, product × design, product × research"
            width={800}
            height={600}
            style={{
              width: "100%",
              maxWidth: 600,
              height: "auto",
              display: "block",
              margin: "0 auto var(--space-2xl)",
            }}
          />

          <PackageBuilder packs={packs} />

          {cta && (
            <section
              style={{
                textAlign: "center",
                padding: "var(--space-2xl) 0",
                marginTop: "var(--space-2xl)",
              }}
            >
              <h3 style={{ fontSize: "1.5rem", marginBottom: "var(--space-md)" }}>
                {cta.name}
              </h3>
              <p style={{ color: "var(--text-secondary)", maxWidth: "60ch", margin: "0 auto" }}>
                {cta.content}
              </p>
              {cta.link && (
                <a
                  href={cta.link}
                  style={{
                    display: "inline-block",
                    marginTop: "var(--space-lg)",
                    padding: "12px 24px",
                    background: "var(--accent)",
                    color: "var(--wv-white)",
                    borderRadius: "8px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {cta.tagline || "get started"}
                </a>
              )}
            </section>
          )}
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
