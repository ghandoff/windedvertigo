/**
 * Template variable resolver for campaign emails.
 *
 * Supports {{orgName}}, {{contactName}}, {{senderName}}, {{orgEmail}}, {{orgWebsite}},
 * {{unsubscribeUrl}}, {{viewInBrowserUrl}}.
 *
 * Also handles space-padded Mailchimp-style {{ var }} tags — resolves known vars
 * and strips unknown ones so they never appear literally in sent emails.
 */

export interface TemplateContext {
  orgName?: string;
  contactName?: string;
  firstName?: string;
  senderName?: string;
  orgEmail?: string;
  orgWebsite?: string;
  bespokeEmailCopy?: string;
  outreachSuggestion?: string;
  unsubscribeUrl?: string;
  viewInBrowserUrl?: string;
}

const VAR_MAP: Record<string, keyof TemplateContext> = {
  orgname: "orgName",
  contactname: "contactName",
  firstname: "firstName",
  sendername: "senderName",
  orgemail: "orgEmail",
  orgwebsite: "orgWebsite",
  bespokeemailcopy: "bespokeEmailCopy",
  outreachsuggestion: "outreachSuggestion",
  unsubscribeurl: "unsubscribeUrl",
  viewinbrowserurl: "viewInBrowserUrl",
  // Common underscore-style aliases ({{first_name}}, {{organisation}}, etc.)
  first_name: "firstName",
  organisation: "orgName",
  organization: "orgName",
  contact_name: "contactName",
  sender_name: "senderName",
  // Mailchimp-style aliases — map to our equivalents or strip
  view_in_browser: "viewInBrowserUrl",
  update_preferences: "unsubscribeUrl",
  unsubscribe: "unsubscribeUrl",
  unsubscribe_link: "unsubscribeUrl",
};

/** Resolve both `{{varName}}` and `{{ var_name }}` (space-padded) syntax. */
export function resolveTemplateVars(template: string, ctx: TemplateContext): string {
  // Match {{varName}} or {{ var_name }} — word chars + underscores, optional spaces
  return template
    .replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, varName: string) => {
      const key = VAR_MAP[varName.toLowerCase()];
      if (key && ctx[key]) return ctx[key]!;
      // Strip unresolvable tags so they never land literally in emails
      return "";
    });
}
