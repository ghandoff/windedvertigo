import { redirect } from 'next/navigation';

/**
 * Wave 6.0 redirect shim.
 *
 * The Wave 5.3 Label Import dashboard moved into the Data Hub at
 * /pcs/data?tab=labels. The body was extracted into
 * `@/components/pcs/data-hub/LabelsImportsPanel`. This stub preserves
 * existing bookmarks / deep links. Safe to delete after one release cycle.
 */
export default function LegacyLabelImportsRedirect() {
  redirect('/pcs/data?tab=labels');
}
