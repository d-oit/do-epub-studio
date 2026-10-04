import { useRef } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import { CommentInput } from '../annotations/CommentInput';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';

interface CommentInputModalProps {
  isOpen: boolean;
  selection: { text: string } | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  placeholder: string;
  submitLabel: string;
}

export function CommentInputModal({
  isOpen,
  selection,
  onSubmit,
  onCancel,
  placeholder,
  submitLabel,
}: CommentInputModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen && !!selection, modalRef);
  useKeyboardShortcut('Escape', onCancel, { enabled: isOpen && !!selection });

  if (!isOpen || !selection) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comment-modal-title"
      className="fixed z-50 bg-background rounded-lg shadow-lg border border-border p-4 max-w-md mx-auto"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <h3 id="comment-modal-title" className="text-sm font-medium mb-3">
        {submitLabel}
      </h3>
      <CommentInput
        onSubmit={onSubmit}
        onCancel={onCancel}
        placeholder={placeholder}
        submitLabel={submitLabel}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: comment input should auto-focus for UX
        autoFocus
      />
    </div>
  );
}
