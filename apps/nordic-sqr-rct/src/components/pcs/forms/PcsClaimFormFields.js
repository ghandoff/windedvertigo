'use client';

/**
 * PcsClaimFormFields — Bundle 4 Phase 1
 *
 * Reusable form-fields component for entering a PCS claim with
 * controlled-vocab dropdowns. Sourced from the cv_* tables via the
 * /api/pcs/cv bundle endpoint.
 *
 * Phase scope: this is the form scaffold so Lauren can preview the dropdown
 * sequence. The parent passes an `onSubmit(formData)` prop. Actual claim
 * persistence lands in Phase 4.2.
 *
 * Props:
 *   - onSubmit       (fn)      — receives the assembled form payload
 *   - initialValues  (object)  — optional pre-fill
 *   - busy           (boolean) — disables Submit while parent processes
 */

import { useEffect, useState } from 'react';

const EMPTY_FORM = {
  activeIngredientCode: '',
  aiFormCode: '',
  doseAmount: '',
  doseUnit: 'mg',
  ageCodes: [],
  sexCodes: [],
  lifestageCodes: [],
  lifestyleCodes: [],
  benefitCategoryCode: '',
  claimPrefixCode: '',
  claimText: '',
  gradeCode: '',
};

function MultiSelect({ id, label, options, values, onChange, helperText }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        multiple
        value={values}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange(selected);
        }}
        className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
        size={Math.min(6, Math.max(3, options.length))}
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.displayName}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}

function SingleSelect({ id, label, options, value, onChange, placeholder, helperText, required }) {
  const isEmpty = options.length === 0;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isEmpty}
        className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500 disabled:bg-gray-100 disabled:text-gray-400"
      >
        <option value="">{isEmpty ? '— no options yet —' : (placeholder || 'Select…')}</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.displayName}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}

export default function PcsClaimFormFields({ onSubmit, initialValues, busy = false }) {
  const [bundle, setBundle] = useState(null);
  const [bundleError, setBundleError] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialValues || {}) });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pcs/cv')
      .then((res) => {
        if (!res.ok) throw new Error(`CV fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelled) setBundle(data); })
      .catch((err) => { if (!cancelled) setBundleError(err.message); });
    return () => { cancelled = true; };
  }, []);

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (typeof onSubmit === 'function') onSubmit({ ...form });
  }

  if (bundleError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Failed to load controlled vocabulary: {bundleError}
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  const aiForms = bundle.aiForms; // currently empty; per-AI filter applies once seeded
  const aiHelper = bundle.activeIngredients.length === 0
    ? 'No AIs imported yet; ask admin.'
    : null;
  const formHelper = aiForms.length === 0
    ? 'AI forms populate after AICS docs land.'
    : null;
  const prefixHelper = bundle.claimPrefixes.length === 0
    ? 'Claim prefixes pending — placeholder until Lauren provides the list.'
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SingleSelect
        id="cv-active-ingredient"
        label="Active Ingredient"
        options={bundle.activeIngredients}
        value={form.activeIngredientCode}
        onChange={(v) => update({ activeIngredientCode: v, aiFormCode: '' })}
        helperText={aiHelper}
        required
      />

      <SingleSelect
        id="cv-ai-form"
        label="AI Form"
        options={aiForms}
        value={form.aiFormCode}
        onChange={(v) => update({ aiFormCode: v })}
        helperText={formHelper}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label htmlFor="cv-dose-amount" className="block text-sm font-medium text-gray-700">
            Dose <span className="text-red-500">*</span>
          </label>
          <input
            id="cv-dose-amount"
            type="number"
            step="any"
            min="0"
            value={form.doseAmount}
            onChange={(e) => update({ doseAmount: e.target.value })}
            className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
            placeholder="e.g. 1000"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cv-dose-unit" className="block text-sm font-medium text-gray-700">
            Unit
          </label>
          <select
            id="cv-dose-unit"
            value={form.doseUnit}
            onChange={(e) => update({ doseUnit: e.target.value })}
            className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
          >
            {['mcg', 'mg', 'IU', '%DV'].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MultiSelect
          id="cv-age"
          label="Age groups"
          options={bundle.demographicsAge}
          values={form.ageCodes}
          onChange={(v) => update({ ageCodes: v })}
        />
        <MultiSelect
          id="cv-sex"
          label="Sex"
          options={bundle.demographicsSex}
          values={form.sexCodes}
          onChange={(v) => update({ sexCodes: v })}
        />
        <MultiSelect
          id="cv-lifestage"
          label="Life stage"
          options={bundle.demographicsLifestage}
          values={form.lifestageCodes}
          onChange={(v) => update({ lifestageCodes: v })}
        />
        <MultiSelect
          id="cv-lifestyle"
          label="Lifestyle"
          options={bundle.demographicsLifestyle}
          values={form.lifestyleCodes}
          onChange={(v) => update({ lifestyleCodes: v })}
        />
      </div>

      <SingleSelect
        id="cv-benefit"
        label="Benefit category"
        options={bundle.benefitCategories}
        value={form.benefitCategoryCode}
        onChange={(v) => update({ benefitCategoryCode: v })}
        required
      />

      <SingleSelect
        id="cv-prefix"
        label="Claim prefix"
        options={bundle.claimPrefixes}
        value={form.claimPrefixCode}
        onChange={(v) => update({ claimPrefixCode: v })}
        helperText={prefixHelper}
      />

      <div className="space-y-1">
        <label htmlFor="cv-claim-text" className="block text-sm font-medium text-gray-700">
          Claim text <span className="text-red-500">*</span>
        </label>
        <textarea
          id="cv-claim-text"
          rows={3}
          value={form.claimText}
          onChange={(e) => update({ claimText: e.target.value })}
          className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
          placeholder="Core benefit text without the prefix"
        />
      </div>

      <SingleSelect
        id="cv-grade"
        label="Grade"
        options={bundle.claimGrades}
        value={form.gradeCode}
        onChange={(v) => update({ gradeCode: v })}
        required
      />

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-pacific-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pacific-700 focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:ring-offset-2 disabled:bg-gray-300"
        >
          Submit
        </button>
      </div>
    </form>
  );
}
