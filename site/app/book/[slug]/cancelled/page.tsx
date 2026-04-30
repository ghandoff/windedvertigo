/**
 * /book/[slug]/cancelled — receipt after a successful cancellation.
 *
 * The cancel API performs the cancellation and redirects here on success.
 * This page is purely informational.
 */

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import styles from "@/components/booking/booking.module.css";

export const metadata = {
  title: "cancelled · winded.vertigo",
  description: "your playdate is cancelled.",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CancelledPage({ params }: Props) {
  const { slug } = await params;
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.page}>
        <div className={styles.confirmCard}>
          <h1 className={styles.confirmTitle}>your playdate is cancelled</h1>
          <p className={styles.confirmDetail}>
            no worries — the time is freed up. we&apos;d love to find another moment whenever you&apos;re
            ready.
          </p>
          <div className={styles.confirmActions}>
            <Link href={`/book/${slug}`} className={`${styles.confirmAction} ${styles.primary}`}>
              book again
            </Link>
            <Link href="/" className={styles.confirmAction}>
              back to winded.vertigo
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
