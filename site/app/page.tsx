import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent } from "@/lib/notion";

/** ISR: revalidate every hour. */
export const revalidate = 3600;

export default async function HomePage() {
  const sections = await fetchSiteContent("home");
  const meta = sections.find((s) => s.name === "meta" || s.section === "meta");

  return (
    <>
      <SiteHeader isHome />

      <main id="main-content" className="home">
        <div className="container">
          <section className="hero">
            <h1 className="visually-hidden">winded.vertigo</h1>
            <nav className="hero-nav" aria-label="main navigation">
              <Link href="/what/">what.</Link>
              <Link href="/we/">we.</Link>
              <Link href="/do/">do.</Link>
            </nav>
            {meta?.content && (
              <p className="home-meta">{meta.content}</p>
            )}
          </section>
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
