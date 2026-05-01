import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, ExternalLink } from "lucide-react";
import { getContact } from "@/lib/notion/contacts";
import { getActivitiesForContact } from "@/lib/notion/activities";
import { PageHeader } from "@/app/components/page-header";
import { ActivityTimeline } from "@/app/components/activity-timeline";
import { LogActivityDialog } from "@/app/components/log-activity-dialog";
import { ContactEditDialog } from "@/app/components/contact-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AiHealthBadge } from "@/app/components/ai-health-badge";
import { AiActivityInsight } from "@/app/components/ai-activity-insight";
import { DeleteContactButton } from "@/app/components/delete-contact-button";
import { ContactEnrichPhotoButton } from "@/app/components/contact-enrich-photo-button";

export const revalidate = 300;

const STAGE_COLORS: Record<string, string> = {
  stranger: "bg-gray-100 text-gray-700 border-gray-200",
  introduced: "bg-blue-100 text-blue-700 border-blue-200",
  "in conversation": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "warm connection": "bg-orange-100 text-orange-700 border-orange-200",
  "active collaborator": "bg-green-100 text-green-700 border-green-200",
  "inner circle": "bg-purple-100 text-purple-700 border-purple-200",
};

const WARMTH_COLORS: Record<string, string> = {
  cold: "bg-blue-100 text-blue-700 border-blue-200",
  lukewarm: "bg-yellow-100 text-yellow-700 border-yellow-200",
  warm: "bg-orange-100 text-orange-700 border-orange-200",
  hot: "bg-red-100 text-red-700 border-red-200",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;

  let contact;
  try {
    contact = await getContact(id);
  } catch {
    notFound();
  }

  let activities: Awaited<ReturnType<typeof getActivitiesForContact>>["data"] = [];
  try {
    const result = await getActivitiesForContact(id);
    activities = result.data;
  } catch {
    // Activities DB may not be shared with integration yet
  }

  return (
    <>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to contacts
      </Link>

      {/* Profile photo — server-rendered, refreshed after enrich */}
      <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center mb-3">
        {contact.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.profilePhotoUrl}
            alt={contact.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg font-semibold text-muted-foreground">
            {contact.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
          </span>
        )}
      </div>

      <PageHeader title={contact.name}>
        <DeleteContactButton contactId={contact.id} contactName={contact.name} />
        <ContactEditDialog contact={contact} />
        <LogActivityDialog
          contactId={contact.id}
          contactName={contact.name}
          organizationIds={contact.organizationIds}
          currentStage={contact.relationshipStage}
        />
        <ContactEnrichPhotoButton
          contactId={contact.id}
          hasEmail={!!contact.email}
          hasLinkedin={!!contact.linkedin}
          hasPhoto={!!contact.profilePhotoUrl}
        />
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Mail className="h-4 w-4" />
            email
          </a>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {contact.relationshipStage && (
                  <Badge variant="outline" className={`text-xs ${STAGE_COLORS[contact.relationshipStage] ?? ""}`}>
                    {contact.relationshipStage}
                  </Badge>
                )}
                {contact.contactWarmth && (
                  <Badge variant="outline" className={`text-xs ${WARMTH_COLORS[contact.contactWarmth] ?? ""}`}>
                    {contact.contactWarmth}
                  </Badge>
                )}
                {contact.contactType && (
                  <Badge variant="outline" className="text-xs">{contact.contactType}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {contact.role && (
                  <div>
                    <span className="text-muted-foreground">role</span>
                    <p className="font-medium">{contact.role}</p>
                  </div>
                )}
                {contact.email && (
                  <div>
                    <span className="text-muted-foreground">email</span>
                    <p className="font-medium">{contact.email}</p>
                  </div>
                )}
                {contact.phoneNumber && (
                  <div>
                    <span className="text-muted-foreground">phone</span>
                    <p className="font-medium">{contact.phoneNumber}</p>
                  </div>
                )}
                {contact.linkedin && (
                  <div>
                    <span className="text-muted-foreground">linkedin</span>
                    <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline flex items-center gap-1">
                      profile <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {contact.responsiveness && (
                  <div>
                    <span className="text-muted-foreground">responsiveness</span>
                    <p className="font-medium">{contact.responsiveness}</p>
                  </div>
                )}
                {contact.referralPotential && (
                  <div>
                    <span className="text-muted-foreground">referral potential</span>
                    <p className="font-medium">yes</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} />
              <AiActivityInsight activities={activities} />
            </CardContent>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Relationship */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">relationship</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">stage</span>
                <p className="font-medium">{contact.relationshipStage || "unknown"}</p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">last contacted</span>
                <p className="font-medium">{formatDate(contact.lastContacted?.start)}</p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">next action</span>
                <p className="font-medium">{contact.nextAction || "—"}</p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">health</span>
                <div className="mt-1">
                  <AiHealthBadge contactId={contact.id} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked organizations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">organisations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.organizationIds.length > 0 ? (
                contact.organizationIds.map((orgId) => (
                  <Link
                    key={orgId}
                    href={`/organizations/${orgId}`}
                    className="block text-accent hover:underline text-xs"
                  >
                    {orgId.slice(0, 8)}...
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground">no linked organisations</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
