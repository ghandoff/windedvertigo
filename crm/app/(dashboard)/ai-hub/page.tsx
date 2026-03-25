import { PageHeader } from "@/app/components/page-header";
import { AiHubDashboard } from "@/app/components/ai-hub-dashboard";

export const dynamic = "force-dynamic";

export default function AiHubPage() {
  return (
    <>
      <PageHeader
        title="AI hub"
        description="AI-powered CRM features, token economics, and cost tracking"
      />
      <AiHubDashboard />
    </>
  );
}
