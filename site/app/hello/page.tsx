import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HelloScroll } from "@/components/hello-scroll";
import styles from "@/components/hello-hub.module.css";

export const metadata: Metadata = {
  title: "hello. – winded.vertigo",
  description:
    "four ways to get to know winded.vertigo — pick the one that fits your schedule.",
  alternates: { canonical: "/hello/" },
  openGraph: {
    title: "hello. – winded.vertigo",
    description:
      "four ways to get to know winded.vertigo — pick the one that fits your schedule.",
    url: "/hello/",
  },
};

/* ── card data ───────────────────────────────────────────────────── */

interface HelloCard {
  id: string;
  minutes: number;
  title: string;
  description: string;
  cta: string;
  href: string | null; // null = placeholder
}

const cards: HelloCard[] = [
  {
    id: "video",
    minutes: 1,
    title: "watch our story",
    description:
      "a quick introduction to who we are and what gets us out of bed.",
    cta: "watch now",
    href: null,
  },
  {
    id: "calendar",
    minutes: 1,
    title: "schedule a playdate",
    description: "pick a time and let\u2019s chat \u2014 no agenda, just curiosity.",
    cta: "book a time",
    href: null,
  },
  {
    id: "packages",
    minutes: 2,
    title: "build your package",
    description:
      "tell us what you need and we\u2019ll show you what\u2019s possible.",
    cta: "start building",
    href: "/do/",
  },
  {
    id: "play",
    minutes: 5,
    title: "try a play activity",
    description:
      "experience one of our four quadrants with a hands-on activity.",
    cta: "let\u2019s play",
    href: null,
  },
];

/* ── page ─────────────────────────────────────────────────────────── */

export default function HelloPage() {
  return (
    <>
      <SiteHeader />
      <HelloScroll />

      <main id="main-content">
        <div className="container content-narrow">
          <section className="content-section">
            <h2 className="hero-title">hello.</h2>
            <div className={styles.intro}>
              <p>
                we know your time is valuable, so we made it easy. pick the
                option that fits your schedule and get to know how we
                work-play.
              </p>
            </div>
          </section>

          <div className={styles.hub}>
            {cards.map((card) => (
              <section
                key={card.id}
                id={card.id}
                className={styles.card}
                aria-labelledby={`${card.id}-title`}
              >
                <time
                  className={styles.badge}
                  dateTime={`PT${card.minutes}M`}
                  aria-label={`estimated time: ${card.minutes} minute${card.minutes > 1 ? "s" : ""}`}
                >
                  {card.minutes} min
                </time>

                <h3 id={`${card.id}-title`} className={styles.title}>
                  {card.title}
                </h3>

                <p className={styles.description}>{card.description}</p>

                {card.href ? (
                  <Link
                    href={card.href}
                    className={styles.cta}
                    aria-label={`${card.cta} — ${card.title}, about ${card.minutes} minute${card.minutes > 1 ? "s" : ""}`}
                  >
                    {card.cta}
                  </Link>
                ) : (
                  <span
                    className={styles.ctaPlaceholder}
                    aria-disabled="true"
                    role="link"
                    aria-label={`${card.cta} — coming soon`}
                  >
                    {card.cta}
                  </span>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
