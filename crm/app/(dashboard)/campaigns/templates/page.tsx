import { Suspense } from "react";
import { queryEmailTemplates } from "@/lib/notion/email-templates";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateForm } from "@/app/components/template-form";
import type { EmailTemplateFilters } from "@/lib/notion/types";

export const revalidate = 300;

const CATEGORY_OPTIONS = ["outreach", "follow-up", "event invite", "newsletter", "other"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  outreach: "bg-blue-100 text-blue-700 border-blue-200",
  "follow-up": "bg-green-100 text-green-700 border-green-200",
  "event invite": "bg-purple-100 text-purple-700 border-purple-200",
  newsletter: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function TemplateGrid({ searchParams }: Props) {
  const params = await searchParams;
  const filters: EmailTemplateFilters = {};
  if (params.category) filters.category = params.category as EmailTemplateFilters["category"];
  if (params.search) filters.search = params.search;

  const { data: templates } = await queryEmailTemplates(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 50 },
  );

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no templates yet. create one to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {templates.map((t) => (
        <Card key={t.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm leading-tight">{t.name}</CardTitle>
              {t.category && (
                <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_COLORS[t.category] ?? ""}`}>
                  {t.category}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {t.subject && (
              <div>
                <span className="text-muted-foreground">subject:</span>{" "}
                <span className="font-medium">{t.subject}</span>
              </div>
            )}
            {t.body && (
              <p className="text-muted-foreground line-clamp-3">{t.body}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function TemplatesPage(props: Props) {
  return (
    <>
      <PageHeader
        title="email templates"
        description="reusable templates with {{variable}} placeholders"
      >
        <TemplateForm />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search templates..." />
          <FilterSelect paramKey="category" placeholder="category" options={CATEGORY_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <TemplateGrid searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
