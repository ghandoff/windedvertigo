import { redirect } from 'next/navigation';

/**
 * Legacy single-file PCS import URL. Consolidated into the batch dashboard
 * at /pcs/admin/imports. Preserved as a redirect for backward compat with
 * any bookmarks or in-flight links.
 */
export default function PcsImportRedirect() {
  redirect('/pcs/admin/imports');
}
