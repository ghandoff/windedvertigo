import { redirect } from 'next/navigation';

/**
 * Wave 6.0 redirect shim.
 *
 * Export moved into the Data Hub at /pcs/data?tab=export. The body was
 * extracted into `@/components/pcs/data-hub/ExportPanel`. This stub
 * preserves existing bookmarks / deep links. Safe to delete after one
 * release cycle.
 */
export default function LegacyExportRedirect() {
  redirect('/pcs/data?tab=export');
}
