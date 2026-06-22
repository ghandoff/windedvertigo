'use client';

/**
 * CAIPB Hub — Claims · Active Ingredients · Products · Benefit Categories
 * Route: /research/pcs/caipb
 *
 * Super-user-only (Budget C preview). Three browse lenses that mirror
 * Lauren's CAIPB Smartsheet: by Ingredient, by Benefit Category, by Product.
 *
 * Unlike /explore (query mode), this is BROWSE mode: start with an entity,
 * navigate to its dashboard, then cross-link to related entities.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RoleRoute from '@/components/RoleRoute';

function HubContent() {
  const router = useRouter();
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({ ingredient: '', benefit: '', product: '' });

  useEffect(() => {
    fetch('/api/pcs/explore')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setOptions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function navigate(lens, id) {
    if (!id) return;
    router.push(`/research/pcs/caipb/${lens}/${id}`);
  }

  const lenses = [
    {
      key: 'ingredient',
      label: 'By Ingredient',
      icon: '⚗',
      description: 'Forms & sources, benefit categories supported, form usage across products.',
      placeholder: 'Select an ingredient…',
      items: options?.ingredients || [],
      href: (id) => `/research/pcs/caipb/ingredient/${id}`,
    },
    {
      key: 'benefit',
      label: 'By Benefit Category',
      icon: '🎯',
      description: 'Ingredients and products that support this benefit, with substantiating claims.',
      placeholder: 'Select a benefit category…',
      items: options?.benefitCategories || [],
      href: (id) => `/research/pcs/caipb/benefit/${id}`,
    },
    {
      key: 'product',
      label: 'By Product',
      icon: '📦',
      description: 'Claims the product can make, active ingredients with doses and FM PLM#.',
      placeholder: 'Select a product…',
      items: options?.documents || [],
      href: (id) => `/research/pcs/caipb/product/${id}`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Link href="/research/pcs" className="hover:text-gray-600">Command Center</Link>
            <span>/</span>
            <span className="text-gray-600 font-medium">CAIPB Dashboards</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">CAIPB Dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">
            Claims · Active Ingredients · Products · Benefit Categories — browse mode.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Loading options…
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {lenses.map(lens => (
              <div key={lens.key} className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
                <div>
                  <div className="text-2xl mb-1">{lens.icon}</div>
                  <h2 className="font-semibold text-gray-800 text-sm">{lens.label}</h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{lens.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <select
                    value={selected[lens.key]}
                    onChange={e => setSelected(prev => ({ ...prev, [lens.key]: e.target.value }))}
                    className="rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pacific-400"
                  >
                    <option value="">{lens.placeholder}</option>
                    {lens.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.pcsId || item.id}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => navigate(lens.key, selected[lens.key])}
                    disabled={!selected[lens.key]}
                    className="w-full px-4 py-2 bg-pacific-600 text-white text-sm font-medium rounded hover:bg-pacific-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Open Dashboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-xs text-gray-400 text-center">
          Preview — coming soon for your team · Replaces Lauren&apos;s CAIPB Smartsheet
        </div>
      </div>
    </div>
  );
}

export default function CaipbHub() {
  return (
    <RoleRoute requires={['super-user']}>
      <HubContent />
    </RoleRoute>
  );
}
