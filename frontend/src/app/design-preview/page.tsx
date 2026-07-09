'use client';

import { useState } from 'react';
import { CorporateSlate } from './corporate-slate';
import { FieldMobile } from './field-mobile';
import { DataObservatory } from './data-observatory';
import { SavaneTech } from './savane-tech';

const designs = [
  {
    id: 'corporate',
    label: 'Corporate Slate',
    emoji: '🏢',
    desc: 'Premium SaaS — Bleu/gris · Bureau',
    component: CorporateSlate,
  },
  {
    id: 'mobile',
    label: 'Field Mobile',
    emoji: '📱',
    desc: 'Mobile-first — Emeraude · Terrain',
    component: FieldMobile,
  },
  {
    id: 'observatory',
    label: 'Data Observatory',
    emoji: '🔭',
    desc: 'Data-dense — Cyan/violet · NOC',
    component: DataObservatory,
  },
  {
    id: 'savane',
    label: 'Savane Tech',
    emoji: '🌍',
    desc: 'African tech — Orange/vert · Local CI',
    component: SavaneTech,
  },
] as const;

type DesignId = (typeof designs)[number]['id'];

export default function DesignPreviewPage() {
  const [active, setActive] = useState<DesignId>('corporate');

  const ActiveDesign = designs.find((d) => d.id === active)!.component;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-0 flex items-stretch gap-0 overflow-x-auto">
        {/* Logo */}
        <div className="flex items-center pr-5 mr-3 border-r border-gray-700">
          <span className="text-white text-xs font-bold tracking-wider whitespace-nowrap">🎨 DESIGN PREVIEW</span>
        </div>
        {designs.map((d) => (
          <button
            key={d.id}
            onClick={() => setActive(d.id)}
            className={`flex items-center gap-2.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active === d.id
                ? 'border-indigo-500 text-white bg-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <span>{d.emoji}</span>
            <span>{d.label}</span>
            <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full ${active === d.id ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-800 text-gray-500'}`}>
              {d.desc}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center px-4">
          <a
            href="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap"
          >
            ← Retour au dashboard
          </a>
        </div>
      </div>

      {/* Design preview */}
      <div className="flex-1 overflow-auto">
        <ActiveDesign />
      </div>
    </div>
  );
}
