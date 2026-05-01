import type { Metadata } from "next";
import { getActiveMembers } from "@/lib/notion/members";
import { queryProjects } from "@/lib/notion/projects";
import { PageHeader } from "@/app/components/page-header";
import { TranscribeClient } from "./transcribe-client";

export const metadata: Metadata = {
  title: "transcribe — the port",
  description:
    "record a meeting in-browser, auto-transcribe via Whisper, summarise with Claude, and file into the Notion meetings database.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TranscribePage() {
  // Fetch members + active projects in parallel so the client can offer
  // attendee + project pickers without a second round-trip.
  const [members, { data: projects }] = await Promise.all([
    getActiveMembers(),
    queryProjects({ archive: false }, { pageSize: 100 }),
  ]);

  const activeProjects = projects
    .filter((p) => p.status !== "complete" && p.status !== "cancelled")
    .map((p) => ({ id: p.id, name: p.project, type: p.type }));

  const memberOptions = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="transcribe a meeting"
        description="record in-browser, auto-transcribe, summarise, and file to notion. audio stays on cloudflare r2; transcript goes through whisper + claude."
      />
      <TranscribeClient
        members={memberOptions}
        projects={activeProjects}
      />
    </div>
  );
}
