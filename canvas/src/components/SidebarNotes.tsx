import { useState, useMemo } from 'react';
import type { Annotation, VariationFile } from '../lib/types';

interface SidebarNotesProps {
  notes: Annotation[];
  variations: VariationFile[];
  onAddNote: (versionPath: string, text: string) => void;
  onClose: () => void;
}

/**
 * Right sidebar panel showing all sidebar-type annotations grouped by variation,
 * with the ability to add new notes.
 */
export function SidebarNotes({ notes, variations, onAddNote, onClose }: SidebarNotesProps) {
  const [newText, setNewText] = useState('');
  const [selectedVariation, setSelectedVariation] = useState(
    variations[0]?.path ?? ''
  );

  // Group notes by variation
  const grouped = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const note of notes) {
      const existing = map.get(note.versionPath) ?? [];
      existing.push(note);
      map.set(note.versionPath, existing);
    }
    return map;
  }, [notes]);

  const handleAdd = () => {
    const text = newText.trim();
    if (!text || !selectedVariation) return;
    onAddNote(selectedVariation, text);
    setNewText('');
  };

  return (
    <div
      data-testid="sidebar-notes"
      style={{
        width: 280,
        backgroundColor: '#111111',
        borderLeft: '1px solid #2a2a2e',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #2a2a2e',
      }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Notes</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
          aria-label="Close notes"
        >
          x
        </button>
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {grouped.size === 0 && (
          <p style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
            No notes yet. Add one below.
          </p>
        )}
        {Array.from(grouped.entries()).map(([varPath, varNotes]) => (
          <div key={varPath} style={{ marginBottom: '1rem' }}>
            <h4 style={{
              margin: '0 0 0.4rem',
              fontSize: '0.75rem',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {varPath}
            </h4>
            {varNotes.map((note) => (
              <div key={note.id} style={{
                backgroundColor: '#1e1e1e',
                borderRadius: 6,
                padding: '0.5rem 0.75rem',
                marginBottom: '0.4rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>
                    {note.author}
                  </span>
                  <span style={{
                    fontSize: '0.6rem',
                    padding: '1px 6px',
                    borderRadius: 9999,
                    backgroundColor: note.authorType === 'agent' ? '#8b5cf622' : '#44B2FF22',
                    color: note.authorType === 'agent' ? '#8b5cf6' : '#44B2FF',
                  }}>
                    {note.authorType}
                  </span>
                </div>
                <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#ddd' }}>
                  {note.text}
                </p>
                <span style={{ fontSize: '0.6rem', color: '#555' }}>
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add note form */}
      <div style={{
        padding: '0.75rem',
        borderTop: '1px solid #2a2a2e',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}>
        <select
          data-testid="note-variation-select"
          value={selectedVariation}
          onChange={(e) => setSelectedVariation(e.target.value)}
          style={{
            backgroundColor: '#1a1a1e',
            border: '1px solid #2a2a2e',
            borderRadius: 4,
            color: '#e0e0e0',
            padding: '4px 8px',
            fontSize: '0.75rem',
          }}
        >
          {variations.map((v) => (
            <option key={v.path} value={v.path}>{v.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            data-testid="note-text-input"
            type="text"
            placeholder="Add a note..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            style={{
              flex: 1,
              backgroundColor: '#1a1a1e',
              border: '1px solid #2a2a2e',
              borderRadius: 4,
              color: '#e0e0e0',
              padding: '4px 8px',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              backgroundColor: '#44B2FF',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
