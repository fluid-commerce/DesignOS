import { useCampaignStore } from '../store/campaign';

/** Left-arrow icon for back navigation */
function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Separator between breadcrumb segments */
function Separator() {
  return (
    <span style={{ color: '#333', fontSize: '0.75rem', userSelect: 'none', padding: '0 2px' }}>
      /
    </span>
  );
}

interface BreadcrumbSegmentProps {
  label: string;
  onClick?: () => void;
  isLast: boolean;
}

function BreadcrumbSegment({ label, onClick, isLast }: BreadcrumbSegmentProps) {
  const isClickable = !!onClick && !isLast;
  return (
    <span
      onClick={isClickable ? onClick : undefined}
      style={{
        fontSize: '0.8125rem',
        color: isLast ? '#e0e0e0' : '#666',
        fontWeight: isLast ? 500 : 400,
        cursor: isClickable ? 'pointer' : 'default',
        padding: '2px 4px',
        borderRadius: 4,
        transition: 'color 0.1s',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.color = '#aaa'; }}
      onMouseLeave={(e) => { if (isClickable) e.currentTarget.style.color = '#666'; }}
    >
      {label}
    </span>
  );
}

export function Breadcrumb() {
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const creations = useCampaignStore((s) => s.creations);
  const navigateToDashboard = useCampaignStore((s) => s.navigateToDashboard);
  const navigateToDashboardCreations = useCampaignStore((s) => s.navigateToDashboardCreations);
  const navigateToCampaign = useCampaignStore((s) => s.navigateToCampaign);
  const navigateBack = useCampaignStore((s) => s.navigateBack);

  // Resolve display names from cache
  const campaign = activeCampaignId
    ? campaigns.find((c) => c.id === activeCampaignId)
    : null;
  const campaignTitle = campaign?.title ?? activeCampaignId;
  const isStandalone = campaign?.title === '__standalone__';
  const creationTitle = activeCreationId
    ? (creations.find((a) => a.id === activeCreationId)?.title ?? activeCreationId)
    : null;

  // Build segments
  const segments: Array<{ label: string; onClick?: () => void }> = [];

  if (isStandalone) {
    // Standalone creations: show "Creations" root, skip campaign segment
    segments.push({
      label: 'Creations',
      onClick: currentView !== 'dashboard' ? navigateToDashboardCreations : undefined,
    });
  } else {
    segments.push({
      label: 'Campaigns',
      onClick: currentView !== 'dashboard' ? navigateToDashboard : undefined,
    });
    if (currentView !== 'dashboard' && campaignTitle) {
      segments.push({
        label: campaignTitle,
        onClick:
          currentView !== 'campaign' && activeCampaignId
            ? () => navigateToCampaign(activeCampaignId)
            : undefined,
      });
    }
  }

  if (currentView === 'creation' && creationTitle) {
    segments.push({ label: creationTitle });
  }

  const canGoBack = currentView !== 'dashboard';

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0px',
        overflow: 'hidden',
      }}
    >
      {/* Back button */}
      {canGoBack && (
        <button
          onClick={navigateBack}
          title="Go back"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'none',
            border: '1px solid #2a2a2e',
            borderRadius: 4,
            color: '#666',
            cursor: 'pointer',
            flexShrink: 0,
            marginRight: '0.5rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
        >
          <BackArrow />
        </button>
      )}

      {/* Segments with separators */}
      {segments.map((seg, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <Separator />}
          <BreadcrumbSegment
            label={seg.label}
            onClick={seg.onClick}
            isLast={i === segments.length - 1}
          />
        </span>
      ))}
    </nav>
  );
}
