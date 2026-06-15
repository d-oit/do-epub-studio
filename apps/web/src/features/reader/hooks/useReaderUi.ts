import { useState, useCallback } from 'react';
import { useReaderStore } from '../../../stores';
import type { ReaderPanel } from '../../../stores';
import type { SelectionData } from '../components/annotations';

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
  const activePanel = useReaderStore((s) => s.activePanel);
  const setActivePanel = useReaderStore((s) => s.setActivePanel);

  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [revokedBooks, setRevokedBooks] = useState<Set<string>>(new Set());

  const togglePanel = useCallback((panel: ReaderPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, [setActivePanel]);

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
