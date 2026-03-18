import type { ReactElement } from 'react';
import { useState } from 'react';
import { useCampaignStore, type NavTab } from '../store/campaign';

interface NavItem {
  tab: NavTab;
  label: string;
  icon: () => ReactElement;
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MasonryGridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

function PatternsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83M5.64 18.36l2.83-2.83M15.53 8.47l2.83-2.83" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VoiceGuideIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { tab: 'create', label: 'Create', icon: PlusIcon },
  { tab: 'my-creations', label: 'My Creations', icon: MasonryGridIcon },
  { tab: 'assets', label: 'Assets', icon: AssetsIcon },
  { tab: 'templates', label: 'Templates', icon: TemplatesIcon },
  { tab: 'patterns', label: 'Patterns', icon: PatternsIcon },
  { tab: 'voice-guide', label: 'Voice Guide', icon: VoiceGuideIcon },
];

export function LeftNav() {
  const activeNavTab = useCampaignStore((s) => s.activeNavTab);
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);
  const setActiveNavTab = useCampaignStore((s) => s.setActiveNavTab);
  const toggleChatSidebar = useCampaignStore((s) => s.toggleChatSidebar);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  return (
    <div style={{
      width: 52,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '0.5rem',
      paddingBottom: '0.75rem',
      backgroundColor: '#111111',
      borderRight: '1px solid #1e1e1e',
      height: '100%',
      position: 'relative',
    }}>
      {/* Nav tabs at top */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = activeNavTab === tab;
          return (
            <button
              key={tab}
              title={label}
              onClick={() => setActiveNavTab(tab)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#aaa';
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#666';
                setTooltip(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                background: isActive ? '#1a1a1e' : 'none',
                border: 'none',
                borderLeft: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                borderRadius: isActive ? '0 4px 4px 0' : 4,
                color: isActive ? '#e0e0e0' : '#666',
                cursor: 'pointer',
                transition: 'color 0.15s, background-color 0.15s',
                marginLeft: 2,
              }}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      {/* Tooltip: appears to the right of the hovered nav item */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.left,
            top: tooltip.top,
            transform: 'translateY(-50%)',
            padding: '6px 10px',
            backgroundColor: '#1a1a1e',
            border: '1px solid #2a2a2e',
            borderRadius: 6,
            color: '#e0e0e0',
            fontSize: '0.8125rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {tooltip.label}
        </div>
      )}

      {/* Settings + Chat toggle at bottom */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
        {/* Settings */}
        <button
          key="settings"
          title="Settings"
          onClick={() => setActiveNavTab('settings')}
          onMouseEnter={(e) => {
            if (activeNavTab !== 'settings') e.currentTarget.style.color = '#aaa';
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ label: 'Settings', top: rect.top + rect.height / 2, left: rect.right + 8 });
          }}
          onMouseLeave={(e) => {
            if (activeNavTab !== 'settings') e.currentTarget.style.color = '#666';
            setTooltip(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            background: activeNavTab === 'settings' ? '#1a1a1e' : 'none',
            border: 'none',
            borderLeft: activeNavTab === 'settings' ? '2px solid #44B2FF' : '2px solid transparent',
            borderRadius: activeNavTab === 'settings' ? '0 4px 4px 0' : 4,
            color: activeNavTab === 'settings' ? '#e0e0e0' : '#666',
            cursor: 'pointer',
            transition: 'color 0.15s, background-color 0.15s',
            marginLeft: 2,
          }}
        >
          <SettingsIcon />
        </button>
        {/* AI Chat toggle */}
        <button
          title="AI Chat"
          onClick={toggleChatSidebar}
          onMouseEnter={(e) => {
            if (!chatSidebarOpen) e.currentTarget.style.color = '#aaa';
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ label: 'AI Chat', top: rect.top + rect.height / 2, left: rect.right + 8 });
          }}
          onMouseLeave={(e) => {
            if (!chatSidebarOpen) e.currentTarget.style.color = '#666';
            setTooltip(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            background: 'none',
            border: 'none',
            borderRadius: 4,
            color: chatSidebarOpen ? '#44B2FF' : '#666',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          <ChatBubbleIcon />
        </button>
      </div>
    </div>
  );
}
