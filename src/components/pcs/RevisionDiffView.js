'use client';

/**
 * Wave 8 Phase D — Revision diff view (compact, glance-and-understand).
 *
 * Props:
 *   beforeValue: string | null  — JSON-stringified or plain text
 *   afterValue:  string | null  — JSON-stringified or plain text
 *
 * Strategy:
 *   1. Try to JSON.parse each side. If both parse to plain objects, render
 *      a shallow key-by-key diff (added / removed / changed). Equal keys
 *      are dimmed; differing keys are tinted.
 *   2. Otherwise render a side-by-side primitive view (Before tinted red
 *      when values differ, After tinted green).
 *
 * Intentionally NOT a full character-level diff — this is a scanning tool
 * inside a side panel, not a merge view.
 */

function tryParse(s) {
  if (s == null) return { ok: false, value: null, raw: '' };
  const raw = String(s);
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, value: '', raw };
  if (!/^[\[{\"]/.test(trimmed) && !/^(true|false|null|-?\d)/.test(trimmed)) {
    return { ok: false, value: raw, raw };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed), raw };
  } catch {
    return { ok: false, value: raw, raw };
  }
}

function formatPrimitive(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function shallowObjectDiff(before, after) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).sort();
  return keys.map((k) => {
    const inBefore = before && Object.prototype.hasOwnProperty.call(before, k);
    const inAfter = after && Object.prototype.hasOwnProperty.call(after, k);
    const b = inBefore ? before[k] : undefined;
    const a = inAfter ? after[k] : undefined;
    let status = 'same';
    if (inBefore && !inAfter) status = 'removed';
    else if (!inBefore && inAfter) status = 'added';
    else if (JSON.stringify(b) !== JSON.stringify(a)) status = 'changed';
    return { key: k, status, before: b, after: a };
  });
}

export default function RevisionDiffView({ beforeValue, afterValue }) {
  const bp = tryParse(beforeValue);
  const ap = tryParse(afterValue);

  const bothObjects =
    bp.ok && ap.ok &&
    bp.value && ap.value &&
    typeof bp.value === 'object' && typeof ap.value === 'object' &&
    !Array.isArray(bp.value) && !Array.isArray(ap.value);

  if (bothObjects) {
    const rows = shallowObjectDiff(bp.value, ap.value);
    if (rows.length === 0) {
      return <div className="text-xs text-gray-400 italic px-2 py-1">(no fields)</div>;
    }
    return (
      <div className="border border-gray-200 rounded-md overflow-hidden text-xs">
        <div className="grid grid-cols-[minmax(80px,140px)_1fr_1fr] bg-gray-50 border-b border-gray-200 text-[10px] uppercase text-gray-500 font-semibold">
          <div className="px-2 py-1">Field</div>
          <div className="px-2 py-1 border-l border-gray-200">Before</div>
          <div className="px-2 py-1 border-l border-gray-200">After</div>
        </div>
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const baseCell = 'px-2 py-1 font-mono whitespace-pre-wrap break-words';
            let beforeCls = baseCell;
            let afterCls = baseCell;
            let keyCls = 'px-2 py-1 font-mono text-gray-700';
            if (r.status === 'removed') {
              beforeCls += ' bg-red-50 text-red-800';
              afterCls += ' text-gray-300 italic';
              keyCls += ' text-red-700';
            } else if (r.status === 'added') {
              beforeCls += ' text-gray-300 italic';
              afterCls += ' bg-green-50 text-green-800';
              keyCls += ' text-green-700';
            } else if (r.status === 'changed') {
              beforeCls += ' bg-amber-50 text-amber-900';
              afterCls += ' bg-amber-50 text-amber-900';
              keyCls += ' text-amber-700';
            } else {
              beforeCls += ' text-gray-400';
              afterCls += ' text-gray-400';
              keyCls += ' text-gray-400';
            }
            return (
              <div key={r.key} className="grid grid-cols-[minmax(80px,140px)_1fr_1fr]">
                <div className={keyCls}>{r.key}</div>
                <div className={`${beforeCls} border-l border-gray-100`}>
                  {r.status === 'added' ? '—' : formatPrimitive(r.before)}
                </div>
                <div className={`${afterCls} border-l border-gray-100`}>
                  {r.status === 'removed' ? '—' : formatPrimitive(r.after)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Primitive / text fallback — side-by-side with tint when different.
  const beforeDisplay = bp.ok ? formatPrimitive(bp.value) : bp.raw || '—';
  const afterDisplay = ap.ok ? formatPrimitive(ap.value) : ap.raw || '—';
  const same = beforeDisplay === afterDisplay;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className={`px-2 py-1.5 rounded border font-mono whitespace-pre-wrap break-words ${
        same ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-red-200 bg-red-50 text-red-900'
      }`}>
        <div className="text-[10px] uppercase font-semibold mb-0.5 text-gray-500">Before</div>
        {beforeDisplay || '—'}
      </div>
      <div className={`px-2 py-1.5 rounded border font-mono whitespace-pre-wrap break-words ${
        same ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-green-200 bg-green-50 text-green-900'
      }`}>
        <div className="text-[10px] uppercase font-semibold mb-0.5 text-gray-500">After</div>
        {afterDisplay || '—'}
      </div>
    </div>
  );
}
