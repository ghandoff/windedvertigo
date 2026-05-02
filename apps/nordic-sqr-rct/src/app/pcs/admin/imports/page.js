import { redirect } from 'next/navigation';

/**
 * Wave 6.0 redirect shim.
 *
 * The batch-PCS-import dashboard moved into the Data Hub at
 * /pcs/data?tab=imports. The body was extracted into
 * `@/components/pcs/data-hub/ImportsPanel`. This stub preserves existing
 * bookmarks and Slack deep links. Safe to delete after one release cycle.
 */
export default function LegacyImportsRedirect() {
  redirect('/pcs/data?tab=imports');
}
