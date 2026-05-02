'use client';

/**
 * Wave 7.4 preview — role switcher (super-user only).
 *
 * In the real sidebar, this is how Garrett pops into "see what Sharon
 * sees" without leaving the workspace. For the preview, it's the primary
 * control: it sets the local `previewRole` state passed down from the
 * preview page, which re-renders the sidebar with that role's layout.
 *
 * This component is also reused on the preview page header as the
 * public role-picker for non-super-user viewers (e.g. Gina clicking
 * through to see what her sidebar looks like). The gating is done at
 * the page level — this component is just a dropdown.
 */

import { ROLES, ROLE_LABEL } from './sidebar-items';

export default function RoleSwitcher({
  value,
  onChange,
  label = 'Viewing as',
  compact = false,
}) {
  return (
    <div className={compact ? 'flex items-center gap-2' : 'w-full'}>
      <label
        htmlFor="sidebar-role-switcher"
        className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500"
      >
        {label}
      </label>
      <select
        id="sidebar-role-switcher"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'mt-1 block rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-pacific-500',
          compact ? '' : 'w-full',
        ].join(' ')}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </select>
    </div>
  );
}
