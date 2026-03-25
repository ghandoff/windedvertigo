import { NextRequest } from "next/server";
import { getStepsForBlueprint } from "@/lib/notion/blueprint-steps";
import { getEmailTemplate } from "@/lib/notion/email-templates";
import { withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withNotionError(async () => {
    const steps = await getStepsForBlueprint(id);

    // Resolve template content for each step
    const stepsWithTemplates = await Promise.all(
      steps.map(async (step) => {
        let template = null;
        if (step.templateIds.length > 0) {
          try {
            template = await getEmailTemplate(step.templateIds[0]);
          } catch {
            // template may have been deleted
          }
        }
        return { ...step, template };
      }),
    );

    return { data: stepsWithTemplates };
  });
}
