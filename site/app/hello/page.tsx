import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HelloScroll } from "@/components/hello-scroll";
import { PlaydateForm } from "@/components/playdate-form";
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
  embed?: string; // YouTube video ID for inline embed
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
    embed: "j4jgTxJ2NuY",
  },
  {
    id: "calendar",
    minutes: 1,
    title: "schedule a playdate",
    description: "pick a time and let\u2019s chat. no agenda, just curiosity.",
    cta: "book a time",
    href: "https://calendar.app.google/Ve5m9aTHQe2vyn6E8",
  },
  {
    id: "packages",
    minutes: 2,
    title: "build your package",
    description:
      "tell us what you need and we\u2019ll show you what\u2019s possible.",
    cta: "start building",
    href: "/quadrants/",
  },
  {
    id: "play",
    minutes: 5,
    title: "try a play activity",
    description:
      "experience one of our four quadrants with a hands-on activity.",
    cta: "let\u2019s play",
    href: "/harbour/creaseworks/sampler",
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
            {/* ── left: portrait video ──────────────────────── */}
            <section
              id="video"
              className={styles.cardFeatured}
              aria-labelledby="video-title"
            >
              <time
                className={styles.badge}
                dateTime="PT1M"
                aria-label="estimated time: 1 minute"
              >
                1 min
              </time>

              <div className={styles.embedWrap}>
                <iframe
                  className={styles.embed}
                  src="https://www.youtube-nocookie.com/embed/M7dnNXH6x5k?rel=0&modestbranding=1"
                  title="watch our story"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <h3 id="video-title" className={styles.title}>
                watch our story
              </h3>
              <p className={styles.description}>
                a quick introduction to who we are and what gets us out of bed.
              </p>
            </section>

            {/* ── right: three stacked cards ────────────────── */}
            <div className={styles.sidebar}>
              {cards.filter((c) => !c.embed).map((card) => (
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

                  {card.id === "calendar" ? (
                    <PlaydateForm
                      quadrant={null}
                      quadrantHistory={[]}
                      className={styles.cta}
                      buttonLabel="book a time"
                    />
                  ) : card.href ? (
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
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
