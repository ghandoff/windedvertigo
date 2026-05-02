# Nav — `aria-current="page"` pattern

> **Status:** Pattern doc. Applied in Wave 6.0 to `src/components/pcs/PcsNav.js`.
> **Author:** Claude (nav-redesign quick-wins tranche)
> **Date:** 2026-04-21
> **Scope:** Accessibility guidance for any future nav component in this repo.

## What `aria-current` is

`aria-current` is an ARIA attribute that marks an element as the
"current" item in a set of related elements. For navigation, the
canonical value is `aria-current="page"` — applied to the link whose
`href` matches the current route.

Screen readers (VoiceOver, NVDA, JAWS) announce this as "current page"
when the user lands on the link, which is the single most useful signal
for a keyboard / AT user trying to orient themselves inside a multi-page
app. Without it, the only cue is the visual active style — which
assistive tech does not pick up reliably.

Spec: <https://www.w3.org/TR/wai-aria-1.2/#aria-current>

## Why the old PcsNav didn't have it

The original `src/components/pcs/PcsNav.js` (pre-Wave 6.0) used
`usePathname()` to compute an `isActive` boolean and applied a Tailwind
`bg-pacific-50 text-pacific-700` active style — but did not surface that
state to assistive tech. A sighted user could see which nav item was
active; a VoiceOver user could not. This shipped in Wave 1 and was never
revisited until the nav-redesign audit flagged it.

## The pattern Wave 6.0 is applying

Every nav item that resolves to a route should:

1. Compute `isActive` from `usePathname()` (plus an `exact` flag for
   routes like `/pcs` that would otherwise match every `/pcs/*` subroute).
2. Apply the visual active style as before.
3. **Additionally** set `aria-current="page"` on the active `<Link>` — and
   omit the attribute entirely (not `aria-current="false"`, not
   `aria-current={null}`) on inactive links.

React renders `aria-current={undefined}` as "attribute absent," which is
what we want. Only one item in a nav list should ever carry
`aria-current="page"` at a time.

## Minimal code example

```jsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/pcs', label: 'Command Center', exact: true },
  { href: '/pcs/claims', label: 'Claims' },
  // ...
];

export default function ExampleNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul className="flex gap-2">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'bg-pacific-50 text-pacific-700 px-3 py-1.5 rounded-md'
                    : 'text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Key points:

- The outer `<nav>` carries `aria-label="Primary"` (or `"Breadcrumb"`,
  `"Secondary"`, etc.) so screen readers can distinguish multiple landmarks
  on the same page.
- `aria-current="page"` is the only ARIA attribute on the `<Link>`;
  don't mix it with `role="link"` or redundant `aria-label`s.
- The `exact` flag prevents `/pcs` from matching on `/pcs/claims`.
  Without it, two items would claim active state simultaneously —
  `aria-current` would be wrong, not just the visual styling.

## Future nav components

Apply this pattern to:

- `PcsSidebar.js` (Wave 6.x, per `docs/design/nav-redesign.md` §6.2)
- Any breadcrumb component (use `aria-current="page"` on the **last**
  crumb only; earlier crumbs are plain links)
- Pagination (`aria-current="page"` on the active page number)
- Tab strips (`aria-current="page"` is also valid here, though
  `role="tablist"` + `aria-selected` is the more specific pattern for
  in-page tab UIs rather than route-backed ones)
