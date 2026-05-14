import { useState, memo } from 'react';
import type { Highlight } from '../../../../stores';
import { formatDate } from './formatDate';

export interface HighlightItemProps {
  highlight: Highlight;
  isCurrentChapter: boolean;
  editingHighlight: string | null;
  highlightNote: string;
  setEditingHighlight: (id: string | null) => void;
  setHighlightNote: (text: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
}

export const HighlightItem = memo(function HighlightItem({
  highlight,
  isCurrentChapter,
  editingHighlight,
  highlightNote,
  setEditingHighlight,
  setHighlightNote,
  onEdit,
  onDelete,
  onNavigate,
}: HighlightItemProps) {
  const [showActions, setShowActions] = useState(false);
  const isEditing = editingHighlight === highlight.id;

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isCurrentChapter
          ? 'border-accent/30 bg-accent/5'
          : 'border-border'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onFocus={() => setShowActions(true)}
      onBlur={() => setShowActions(false)}
      tabIndex={0}
    >
      <div
        className="text-sm text-foreground cursor-pointer hover:text-accent"
        onClick={onNavigate}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(); } }}
        tabIndex={0}
        role="button"
        style={{ backgroundColor: highlight.color + '60', padding: '2px 4px', borderRadius: '2px' }}
      >
        {highlight.selectedText.slice(0, 150)}
        {highlight.selectedText.length > 150 ? '...' : ''}
      </div>

      {highlight.note && !isEditing && (
        <p className="mt-2 text-xs text-foreground-muted">{highlight.note}</p>
      )}

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={highlightNote}
            onChange={(e) => setHighlightNote(e.target.value)}
            className="w-full p-2 text-sm border border-border rounded bg-background"
            rows={2}
            placeholder="Add a note..."
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves note-adding workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(highlight.id)}
              className="px-2 py-1 text-xs bg-accent text-white rounded hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => setEditingHighlight(null)}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-background-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-foreground-muted">
              {formatDate(highlight.createdAt)}
            </span>
          </div>
          {showActions && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setEditingHighlight(highlight.id);
                  setHighlightNote(highlight.note || '');
                }}
                className="text-xs text-foreground-muted hover:text-foreground"
              >
                Edit Note
              </button>
              <button
                onClick={() => onDelete(highlight.id)}
                className="text-xs text-accent-error hover:opacity-80"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
