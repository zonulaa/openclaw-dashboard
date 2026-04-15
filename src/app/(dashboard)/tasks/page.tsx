'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const TABS = [
  { id: 'focus', label: "🎯 Today's Focus" },
  { id: 'board', label: '📋 Task Board' },
];

// ── Lazy-loaded content components ────────────────────────────────────────────
import DailyFocusContent from '@/app/(dashboard)/tasks/DailyFocusContent';
import TaskBoardContent from '@/app/(dashboard)/tasks/TaskBoardContent';

function TasksPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'board' ? 'board' : 'focus';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div>
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>
      {activeTab === 'focus' && <DailyFocusContent />}
      {activeTab === 'board' && <TaskBoardContent />}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#5e7299', fontFamily: 'Courier New, monospace' }}>Loading…</div>}>
      <TasksPageInner />
    </Suspense>
  );
}
