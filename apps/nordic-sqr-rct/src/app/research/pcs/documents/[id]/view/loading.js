/**
 * Loading skeleton for the Living PCS View.
 *
 * Shape mirrors the rendered layout:
 *   sticky header → banner slot → cover → table B.
 */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse space-y-6">
      {/* Sticky header placeholder */}
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-7 bg-gray-200 rounded w-2/3" />
      </div>

      {/* Cover card */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Section heading */}
      <div className="h-5 bg-gray-200 rounded w-48" />

      {/* Table B card */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
