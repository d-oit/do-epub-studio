import { useState } from 'react';
import { useReaderStore } from '../../../stores/reader';
import type { ReaderPanel } from '../../../stores/reader';
import type { SelectionData } from '../components/annotations';

export type { ReaderPanel };

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
  const togglePanel = useReaderStore((s) => s.togglePanel);

  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [revokedBooks, setRevokedBooks] = useState<Set<string>>(new Set());

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
