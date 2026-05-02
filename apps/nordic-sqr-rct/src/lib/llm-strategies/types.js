/**
 * @typedef {Object} Strategy
 * @property {'deterministic' | 'oss-llm' | 'claude'} type
 * @property {string} [model] - e.g. 'claude-sonnet-4.5', 'llama-3.1-8b'. Required for non-deterministic types.
 * @property {(payload: any, options: object) => Promise<StrategyResult>} run
 */

/**
 * @typedef {Object} StrategyResult
 * @property {boolean} ok - true if the strategy produced a usable answer
 * @property {any} [value] - the extracted result; shape is task-specific
 * @property {boolean} [deferToNext] - hint that this strategy explicitly chose not to handle this payload
 * @property {string} [contentHash] - sha256 of the payload, for cache-hit attribution
 * @property {boolean} [cacheHit] - whether this answer came from cache
 */

/**
 * @typedef {Object} TelemetryRecord
 * @property {string} taskName
 * @property {'deterministic' | 'oss-llm' | 'claude' | 'none'} strategy
 * @property {string | null} [model]
 * @property {boolean} ok
 * @property {number} durationMs
 * @property {number} totalDurationMs
 * @property {string} ts - ISO 8601
 * @property {string | null} [contentHash]
 * @property {boolean} [cacheHit]
 */

export {};
