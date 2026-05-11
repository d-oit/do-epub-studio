import { useState } from 'react';
import type { SelectionData } from '../components/annotations';

interface UseReaderUIReturn {
  showToc: boolean;
  setShowToc: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  showBookmarks: boolean;
  setShowBookmarks: (show: boolean) => void;
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
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [revokedBooks, setRevokedBooks] = useState<Set<string>>(new Set());

  return {
    showToc,
    setShowToc,
    showSettings,
    setShowSettings,
    showComments,
    setShowComments,
    showBookmarks,
    setShowBookmarks,
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
