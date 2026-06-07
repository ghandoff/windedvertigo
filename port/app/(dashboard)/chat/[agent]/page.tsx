/**
 * /chat/[agent] — web chat interface for Mo, PaM, and cARL.
 *
 * Mobile-friendly. Authenticated via the existing port Google SSO session.
 * Agent selector in the header lets you switch between agents.
 */

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { AgentChat } from "@/app/components/agent-chat";
import type { AgentId } from "@/lib/agent/agent-router";

type ValidAgent = Exclude<AgentId, "port">;

const VALID_AGENTS = new Set<string>(["mo", "pam", "carl"]);

const AGENT_DESCRIPTIONS: Record<ValidAgent, string> = {
  mo: "chief marketing officer — strategy, brand, campaigns, pipeline.",
  pam: "project & momentum manager — commitments, dependencies, team load.",
  carl: "research & learning — literature, threshold concepts, evidence base.",
};

interface PageProps {
  params: Promise<{ agent: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { agent } = await params;

  if (!VALID_AGENTS.has(agent)) {
    notFound();
  }

  const session = await auth();
  const userName =
    (session as unknown as Record<string, unknown>).firstName as string ??
    session?.user?.name?.split(" ")[0]?.toLowerCase() ??
    session?.user?.email?.split("@")[0] ??
    "there";

  const validAgent = agent as ValidAgent;

  return (
    <div className="flex flex-col h-full -mt-4 md:-mt-6">
      {/* Slim page header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">{agent === "mo" ? "Mo" : agent === "pam" ? "PaM" : "cARL"}</h1>
        <p className="text-sm text-muted-foreground">{AGENT_DESCRIPTIONS[validAgent]}</p>
      </div>

      <AgentChat initialAgent={validAgent} userName={userName} />
    </div>
  );
}

export function generateStaticParams() {
  return [{ agent: "mo" }, { agent: "pam" }, { agent: "carl" }];
}
