import { useState, useCallback } from 'react';
import type { SelectionData } from '../components/annotations';

export type ReaderPanel = 'toc' | 'settings' | 'comments' | 'bookmarks' | 'info' | 'search' | null;

interface UseReaderUIReturn {
  activePanel: ReaderPanel;
  setActivePanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: ReaderPanel) => void;
  isCommentMode: boolean;
  setIsCommentMode: (mode: boolean) => void;
  showCommentInput: boolean;
  setShowCommentInput: (show: boolean) => void;
  selection: SelectionData | null;
  setSelection: (selection: SelectionData | null) => void;
  revokedBooks: Set<string>;
  setRevokedBooks: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useReaderUI(): UseReaderUIReturn {
  const [activePanel, setActivePanel] = useState<ReaderPanel>(null);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [revokedBooks, setRevokedBooks] = useState<Set<string>>(new Set());

  const togglePanel = useCallback((panel: ReaderPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  return {
    activePanel,
    setActivePanel,
    togglePanel,
    isCommentMode,
    setIsCommentMode,
    showCommentInput,
    setShowCommentInput,
    selection,
    setSelection,
    revokedBooks,
    setRevokedBooks,
  };
}
