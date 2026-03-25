/**
 * Template variable resolver for campaign emails.
 *
 * Supports {{orgName}}, {{contactName}}, {{senderName}}, {{orgEmail}}, {{orgWebsite}}.
 * Case-insensitive matching. Unknown variables are left as-is.
 */

export interface TemplateContext {
  orgName?: string;
  contactName?: string;
  senderName?: string;
  orgEmail?: string;
  orgWebsite?: string;
}

const VAR_MAP: Record<string, keyof TemplateContext> = {
  orgname: "orgName",
  contactname: "contactName",
  sendername: "senderName",
  orgemail: "orgEmail",
  orgwebsite: "orgWebsite",
};

export function resolveTemplateVars(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    const key = VAR_MAP[varName.toLowerCase()];
    if (key && ctx[key]) return ctx[key]!;
    return match; // leave unknown vars as-is
  });
}
