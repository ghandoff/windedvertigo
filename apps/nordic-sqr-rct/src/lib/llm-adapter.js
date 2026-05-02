/**
 * Wave 10.1 — LLM adapter
 *
 * The seam. Call sites declare an extraction TASK (not a model) and a payload.
 * The adapter walks a strategy registry in order — deterministic first,
 * OSS-LLM next, Claude last. Returns { ok, value, strategy, telemetry } so
 * call sites can keep going regardless of which strategy answered.
 *
 * Phase 1A (this commit): scaffold only. NO existing call sites migrate.
 * Phase 1B+: register concrete deterministic strategies (regex-based PCS
 * preflight, TF-IDF claim similarity, prompt caching by content-hash).
 */

const _registry = new Map();   // task name → ordered Strategy[]
const _telemetry = [];          // ring buffer of last N calls (capped)
const TELEMETRY_CAP = 1000;

export function registerStrategy(taskName, strategies) {
  if (typeof taskName !== 'string' || !taskName) {
    throw new Error('registerStrategy: taskName must be a non-empty string.');
  }
  if (!Array.isArray(strategies) || strategies.length === 0) {
    throw new Error('registerStrategy: strategies must be a non-empty array.');
  }
  for (const s of strategies) {
    if (typeof s?.run !== 'function') {
      throw new Error(`registerStrategy: each strategy must expose run(); ${taskName} has a malformed entry.`);
    }
    if (!['deterministic', 'oss-llm', 'claude'].includes(s.type)) {
      throw new Error(`registerStrategy: strategy.type must be 'deterministic' | 'oss-llm' | 'claude'; got "${s.type}" for ${taskName}.`);
    }
  }
  _registry.set(taskName, strategies);
}

export function listRegisteredTasks() {
  return Array.from(_registry.keys());
}

export async function extract(taskName, payload, options = {}) {
  const strategies = _registry.get(taskName);
  if (!strategies) {
    return {
      ok: false,
      error: `No strategy registered for task "${taskName}".`,
      strategy: null,
      telemetry: null,
    };
  }
  const startedAt = Date.now();
  for (const strategy of strategies) {
    const stratStart = Date.now();
    try {
      const result = await strategy.run(payload, options);
      if (result?.ok) {
        const telemetry = recordTelemetry({
          taskName,
          strategy: strategy.type,
          model: strategy.model || null,
          ok: true,
          durationMs: Date.now() - stratStart,
          totalDurationMs: Date.now() - startedAt,
          contentHash: result.contentHash || null,
          cacheHit: !!result.cacheHit,
        });
        return { ok: true, value: result.value, strategy: strategy.type, telemetry };
      }
      // strategy chose to defer (returned { ok:false, deferToNext:true })
      // continue walking the registry
    } catch (err) {
      // don't kill the whole walk on one bad strategy; log and continue
      // Future: structured telemetry record for failures too
      // eslint-disable-next-line no-console
      console.warn(`[llm-adapter] task "${taskName}" strategy "${strategy.type}" threw:`, err?.message || err);
    }
  }
  // Walked the whole registry without success
  recordTelemetry({
    taskName,
    strategy: 'none',
    ok: false,
    durationMs: Date.now() - startedAt,
    totalDurationMs: Date.now() - startedAt,
  });
  return {
    ok: false,
    error: `All strategies for task "${taskName}" deferred or failed.`,
    strategy: null,
    telemetry: null,
  };
}

function recordTelemetry(record) {
  const stamped = { ...record, ts: new Date().toISOString() };
  _telemetry.push(stamped);
  if (_telemetry.length > TELEMETRY_CAP) _telemetry.shift();
  return stamped;
}

export function getTelemetrySummary() {
  // Aggregate by taskName + strategy. Useful for the Phase 1B+ migration tracker.
  const byTask = new Map();
  for (const r of _telemetry) {
    const key = `${r.taskName}::${r.strategy}`;
    if (!byTask.has(key)) byTask.set(key, { count: 0, totalMs: 0, okCount: 0 });
    const slot = byTask.get(key);
    slot.count++;
    slot.totalMs += r.durationMs || 0;
    if (r.ok) slot.okCount++;
  }
  return Array.from(byTask.entries()).map(([k, v]) => {
    const [taskName, strategy] = k.split('::');
    return {
      taskName,
      strategy,
      count: v.count,
      okRate: v.count > 0 ? v.okCount / v.count : 0,
      avgMs: v.count > 0 ? v.totalMs / v.count : 0,
    };
  });
}

// Test-only: clear registry. Not exported in production-style ESM but useful
// for the verify file. Wrapped to discourage runtime use.
export function _resetForTests() {
  _registry.clear();
  _telemetry.length = 0;
}
