import { useState, useEffect, useMemo } from 'react';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '../tokens';
import type { IdeasGetStartedProps, TemplateMeta } from './types';
import { deriveAssetIdeas, deriveTemplateIdeas } from './deriveIdeas';
import { useCardsScroll, FADE_WIDTH } from './hooks';
import { IdeaCard } from './IdeaCard';
import { ScrollArrow } from './ScrollArrows';

export function IdeasGetStarted({ selectedAssets, onApplyIdea }: IdeasGetStartedProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TemplateMeta[]) => {
        if (!cancelled && Array.isArray(data)) {
          setTemplates(data.map((t) => ({ id: t.id, name: t.name, category: t.category })));
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => { cancelled = true; };
  }, []);

  const ideas = useMemo(
    () => [...deriveAssetIdeas(selectedAssets), ...deriveTemplateIdeas(templates)],
    [selectedAssets, templates],
  );
  const { scrollRef, showLeft, showRight, scrollLeft, scrollRight } = useCardsScroll();

  if (ideas.length === 0) {
    return (
      <div style={{ width: '100%', maxWidth: 896, paddingTop: '2.5rem', paddingBottom: '2rem' }}>
        <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.125rem', fontWeight: 600, color: TEXT_PRIMARY }}>
          Ideas Get Started
        </h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: TEXT_SECONDARY }}>
          Add assets above with the + button or save assets in the Assets tab. Templates will appear here when available.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 896, position: 'relative', paddingTop: '2.5rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: TEXT_PRIMARY }}>
          Discover and remix ideas
        </h2>
      </div>

      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingLeft: showLeft ? FADE_WIDTH : 0,
          paddingRight: showRight ? FADE_WIDTH : 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          transition: 'padding 0.2s ease',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto auto',
            gridAutoFlow: 'column',
            gridAutoColumns: '260px',
            gap: '1rem',
            width: 'fit-content',
            minWidth: '100%',
          }}
        >
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onApply={onApplyIdea} />
          ))}
        </div>
      </div>

      {showLeft && <ScrollArrow direction="left" onClick={scrollLeft} />}
      {showRight && <ScrollArrow direction="right" onClick={scrollRight} />}
    </div>
  );
}
