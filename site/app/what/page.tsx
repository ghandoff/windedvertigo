import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent } from "@/lib/notion";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "what. – winded.vertigo",
  description:
    "learning is change. the winded.vertigo collective is dedicated to fostering human development through experiences with the interconnectedness of everything.",
  alternates: { canonical: "/what/" },
  openGraph: {
    title: "what. – winded.vertigo",
    description:
      "learning is change. the winded.vertigo collective is dedicated to fostering human development through experiences with the interconnectedness of everything.",
    url: "/what/",
  },
};

export default async function WhatPage() {
  const sections = await fetchSiteContent("what");

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <section className="content-section" id="what-content">
            <h2 className="hero-title">learning is change</h2>
            <p>
              change can shake our foundations, and even make us feel dizzy from
              instability. we love that feeling of vertigo, as it is a signal
              of growth through change and a call for exploration. we seek this
              dizzy with vigor and want to support others who do as well by
              dodging obstacles and conventions that get in our way. we approach
              the precipice of uncertainty without pause but with breathless
              excitement: winded.vertigo
            </p>

            <p>
              the winded.vertigo collective is dedicated to fostering human
              development through experiences with the interconnectedness of
              everything. we believe that learning through play is a
              transformative experience that unites individuals and communities.
              our mission is to support those committed to this holistic
              approach through the co-creation of playful, innovative, and
              impactful learning designs.
            </p>

            <p>
              we create learning ecosystems that thrive through diversity, as
              every interaction seeds opportunity for growth, connections, and
              lifelong learning. we are leaders of an educational transformation
              from conventional tests to the monitoring of playful learning
              processes, as it enhances the learning experience through feedback
              and design.
            </p>

            <p>
              we craft compelling stories, design refreshing research, and
              visualize insights from evidence. everything we do prepares our
              partners to gain support from their stakeholders&mdash;making a{" "}
              <em>yes</em> easier for administrators and policymakers.
            </p>

            <p>
              at winded.vertigo, we redefine learning, ensuring time is spent on
              engaging, exploring, and evolving together, transforming the
              educational landscape one playful leap at a time.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
