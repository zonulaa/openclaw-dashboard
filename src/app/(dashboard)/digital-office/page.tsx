'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Tab bar ───────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '24px',
      paddingBottom: '0',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: active === tab.id ? '2px solid #00FF9F' : '2px solid transparent',
            color: active === tab.id ? '#00FF9F' : 'rgba(255,255,255,0.5)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: 'Courier New, monospace',
            fontSize: '12px',
            letterSpacing: '0.5px',
            fontWeight: active === tab.id ? 700 : 400,
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
            whiteSpace: 'nowrap',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'crons', label: '⏰ Crons' },
  { id: 'classic', label: '🌌 Command Center' },
];

import AgentOverviewContent from '@/app/(dashboard)/digital-office/AgentOverviewContent';
import CronStatusContent from '@/app/(dashboard)/digital-office/CronStatusContent';
import DigitalOfficeV2Content from '@/app/(dashboard)/digital-office/DigitalOfficeV2Content';

function DigitalOfficePageInner() {
  const searchParams = useSearchParams();
  const paramTab = searchParams.get('tab');
  const validTabs = ['overview', 'crons', 'classic'];
  const initialTab = validTabs.includes(paramTab ?? '') ? (paramTab as string) : 'classic';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div>
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>
      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        {activeTab === 'overview' && <AgentOverviewContent />}
        {activeTab === 'crons' && <CronStatusContent />}
        {activeTab === 'classic' && <DigitalOfficeV2Content />}
      </div>
    </div>
  );
}

export default function DigitalOfficePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#5e7299', fontFamily: 'Courier New, monospace' }}>Loading…</div>}>
      <DigitalOfficePageInner />
    </Suspense>
  );
}
